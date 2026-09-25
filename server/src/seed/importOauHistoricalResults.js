import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { readOauHistoricalResults } from './oauHistoricalResultsData.js';
import { nameForKey } from './nigerianNamesData.js';
import { Department } from '../models/Department.js';
import { Session } from '../models/Session.js';
import { Semester } from '../models/Semester.js';
import { Level } from '../models/Level.js';
import { Course, COURSE_TYPES } from '../models/Course.js';
import { Student } from '../models/Student.js';
import { Result } from '../models/Result.js';
import { User } from '../models/User.js';

// Usage:
//   node src/seed/importOauHistoricalResults.js --entered-by <userId> [--apply]
//
// Without --apply this only previews counts (like seedOfficialCourses.js's
// dryRun default) and writes nothing. --entered-by must be a real, existing
// User's id: Result.enteredBy is required, and this script does not invent
// an account to attribute historical data entry to.
//
// Every source row's matric number is real; no student name exists in any
// source file. Student.firstName/otherNames/lastName are filled with a
// generic Nigerian name deterministically generated from the matric number
// (see nigerianNamesData.js) -- these are display placeholders, not real
// names, and should be corrected from a real name roster before these
// records are treated as authoritative.
//
// docs/transcript-retrieval.md: "OCR never approves a result automatically."
// This script honours that: every Result it creates is left at status
// 'submitted' for a result officer/HOD to review and approve, never 'approved'.

const HISTORICAL_DEPARTMENT_NAME = 'Computer Science and Engineering'; // Faculty of Technology; printed verbatim on OAU_Results_Extraction.csv's header for this exact dataset.
const CURRICULUM_CONTEXT = 'OAU historical transcript archive (Computer Science and Engineering, pre-2010)';

function parseArgs(argv) {
  const enteredByIndex = argv.indexOf('--entered-by');
  const enteredBy = enteredByIndex >= 0 ? argv[enteredByIndex + 1] : null;
  return { enteredBy, apply: argv.includes('--apply') };
}

function sessionNameForYear(year) {
  return year ? `${year}/${year + 1}` : null;
}

async function run() {
  const { enteredBy, apply } = parseArgs(process.argv.slice(2));
  if (!enteredBy || !mongoose.Types.ObjectId.isValid(enteredBy)) {
    throw new Error('Usage: node src/seed/importOauHistoricalResults.js --entered-by <existing-user-id> [--apply]');
  }

  const records = await readOauHistoricalResults();
  await connectDB();
  try {
    const department = await Department.findOne({ name: HISTORICAL_DEPARTMENT_NAME });
    const semester = await Semester.findOne({ name: 'Rain' });
    if (!department) throw new Error(`Seed academic structure first: Department "${HISTORICAL_DEPARTMENT_NAME}" not found`);
    if (!semester) throw new Error('Seed student reference data first: Semester "Rain" not found');
    if (!(await User.findById(enteredBy))) throw new Error(`--entered-by user ${enteredBy} does not exist`);

    const levels = await Level.find();
    const levelByNumber = new Map(levels.map((level) => [Number(level.name), level]));
    const sessions = await Session.find();
    const sessionByName = new Map(sessions.map((session) => [session.name, session]));

    const held = { noLevel: 0, noEntrySession: 0 };

    // --- 1) Preflight + upsert historical Course records, scoped so they never collide with the live catalogue ---
    const courseKey = (code, levelNum, semesterId) => `${code}__${levelNum}__${semesterId}`;
    const courseUpserts = new Map(); // courseKey -> course data (last-seen units/title wins; conflicts are logged)
    const courseUnitConflicts = [];
    for (const record of records) {
      const level = levelByNumber.get(record.level);
      if (!level) { held.noLevel += 1; continue; }
      for (const course of record.courses) {
        if (!course.code) continue;
        const key = courseKey(course.code, record.level, semester._id.toString());
        const existing = courseUpserts.get(key);
        if (existing && Number.isFinite(existing.creditUnit) && Number.isFinite(course.units) && existing.creditUnit !== course.units) {
          courseUnitConflicts.push(`${course.code} @ level ${record.level}: ${existing.creditUnit} vs ${course.units} units (kept ${course.units})`);
        }
        courseUpserts.set(key, {
          code: course.code,
          title: course.title || course.code,
          creditUnit: Number.isFinite(course.units) ? course.units : (existing?.creditUnit ?? 0),
          department: department._id,
          offeringDepartment: null,
          offeringUnit: '',
          level: level._id,
          semester: semester._id,
          curriculumContext: CURRICULUM_CONTEXT,
          curriculumVersion: '',
          // Derived from this row's own "Counts toward TNU" flag, not the course
          // code: TPD/SSC-prefixed codes are graded core courses in this dataset,
          // while only the ungraded pass/fail GS courses (SEM/SEE/SEL/SEH/SEP/SEA/SEO
          // 002) have countsTowardTNU === false.
          courseType: course.countsTowardTNU === false ? COURSE_TYPES.OTHER : COURSE_TYPES.CORE,
          titleAliases: [],
          isUndergraduate: true,
          isActive: true,
        });
      }
    }

    const courseIdByKey = new Map();
    if (apply) {
      for (const [key, data] of courseUpserts) {
        const now = new Date();
        const result = await Course.findOneAndUpdate(
          { code: data.code, department: data.department, level: data.level, semester: data.semester, curriculumContext: data.curriculumContext, curriculumVersion: data.curriculumVersion },
          { $set: data, $setOnInsert: { createdAt: now } },
          { upsert: true, returnDocument: 'after', timestamps: true }
        );
        courseIdByKey.set(key, result._id);
      }
    }

    // --- 2) Upsert one Student per matric number (placeholder name = matric number), then Results for graded courses ---
    let studentsSeen = 0;
    let resultsSeen = 0;
    let ungradedCoursesSkipped = 0;
    const skippedStudents = [];

    for (const record of records) {
      const level = levelByNumber.get(record.level);
      if (!level) continue; // already counted in held.noLevel above

      const entrySessionName = sessionNameForYear(record.entryYear) || record.session;
      const entrySession = sessionByName.get(entrySessionName) || sessionByName.get(record.session);
      const recordSession = sessionByName.get(record.session);
      if (!entrySession || !recordSession) {
        held.noEntrySession += 1;
        skippedStudents.push({ matric: record.matricNumber, reason: `no Session document for ${entrySessionName || record.session}` });
        continue;
      }

      const matricNumber = record.matricNumber.trim().toUpperCase();
      studentsSeen += 1;
      let student = null;
      if (apply) {
        const now = new Date();
        // Placeholder name: no name exists in any source row (see file header).
        // Deterministic from the matric number so re-running this import
        // doesn't reshuffle an existing student's placeholder name.
        const { firstName, otherNames, lastName } = nameForKey(matricNumber);
        student = await Student.findOneAndUpdate(
          { matricNumber },
          {
            $setOnInsert: {
              matricNumber,
              firstName,
              otherNames,
              lastName,
              department: department._id,
              entrySession: entrySession._id,
              currentLevel: level._id,
              createdAt: now,
            },
          },
          { upsert: true, returnDocument: 'after', timestamps: true }
        );
      }

      for (const course of record.courses) {
        if (!Number.isFinite(course.score) || !Number.isFinite(course.gradePoint)) {
          ungradedCoursesSkipped += 1; // pass/fail General Studies course (P/F/AR), no numeric score to store
          continue;
        }
        const key = courseKey(course.code, record.level, semester._id.toString());
        resultsSeen += 1;
        if (!apply) continue;
        const courseId = courseIdByKey.get(key);
        if (!student || !courseId) continue;
        const now = new Date();
        await Result.findOneAndUpdate(
          { student: student._id, course: courseId, session: recordSession._id, semester: semester._id },
          {
            $set: {
              department: department._id,
              level: level._id,
              score: course.score,
              grade: course.grade,
              gradePoint: course.gradePoint,
              sourceType: 'ocr',
              enteredBy,
            },
            $setOnInsert: { status: 'submitted', createdAt: now },
          },
          { upsert: true, timestamps: true }
        );
      }
    }

    logger.info(`OAU historical results import (${apply ? 'APPLIED' : 'DRY RUN — pass --apply to write'}): ` +
      `${records.length} archived semester records, ${courseUpserts.size} historical course placements, ` +
      `${studentsSeen} students, ${resultsSeen} graded results, ${ungradedCoursesSkipped} pass/fail rows skipped (no schema field for an ungraded score). ` +
      `Held: ${JSON.stringify(held)}. Course unit conflicts: ${courseUnitConflicts.length}. Students skipped: ${skippedStudents.length}.`);
    if (courseUnitConflicts.length) logger.warn(`Course unit conflicts (last value kept): ${JSON.stringify(courseUnitConflicts)}`);
    if (skippedStudents.length) logger.warn(`Students skipped: ${JSON.stringify(skippedStudents)}`);
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => { logger.error(`OAU historical results import failed: ${error.stack}`); process.exit(1); });
