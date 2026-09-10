import { readFile } from 'node:fs/promises';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Course, COURSE_TYPES } from '../models/Course.js';
import { Department } from '../models/Department.js';
import { Level } from '../models/Level.js';
import { Semester } from '../models/Semester.js';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node src/seed/importOauReady43.js <OAU_READY_43_import.json>');

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

const PROGRAMME_DEPARTMENTS = Object.freeze({
  'computer engineering': 'Computer Engineering',
  cybersecurity: 'Computer Science and Cyber Security',
  botany: 'Botany',
  'foreign languages': 'Foreign Languages',
  surveying: 'Surveying and Geoinformatics',
  'food science': 'Food Science and Technology',
  'food engineering': 'Food Science and Technology',
});

const OFFERING_DEPARTMENTS = Object.freeze({
  'computer engineering': 'Computer Engineering',
  'electronic electrical engineering': 'Electronic and Electrical Engineering',
  'biochemistry molecular biology': 'Biochemistry',
  botany: 'Botany', chemistry: 'Chemistry', microbiology: 'Microbiology',
  'foreign languages': 'Foreign Languages',
  'surveying geoinformatics': 'Surveying and Geoinformatics',
  'food science technology': 'Food Science and Technology',
});

function findDepartment(description, byName, mapping) {
  const key = Object.keys(mapping).find((candidate) => normalize(description).includes(candidate));
  return key ? byName.get(normalize(mapping[key])) : null;
}

function typeFrom(value) {
  const text = normalize(value);
  if (text.includes('project')) return COURSE_TYPES.PROJECT;
  if (text.includes('industrial')) return COURSE_TYPES.INDUSTRIAL_TRAINING;
  if (text.includes('restricted') || text.includes('free elective')) return COURSE_TYPES.RESTRICTED_ELECTIVE;
  return COURSE_TYPES.CORE;
}

async function run() {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  if (!Array.isArray(source) || source.length !== 43 || source.some((row) => row.status !== 'READY')) {
    throw new Error('Refusing import: expected exactly 43 records with status READY');
  }

  await connectDB();
  try {
    const [departments, levels, semesters] = await Promise.all([Department.find({}, 'name'), Level.find({}, 'name'), Semester.find({}, 'name')]);
    const departmentsByName = new Map(departments.map((department) => [normalize(department.name), department]));
    const levelsByName = new Map(levels.map((level) => [Number(level.name), level]));
    const semestersByName = new Map(semesters.map((semester) => [normalize(semester.name), semester]));
    const errors = [];
    const records = [];

    for (const row of source) {
      const department = findDepartment(row.programme_scope, departmentsByName, PROGRAMME_DEPARTMENTS);
      const offeringDepartment = findDepartment(row.offering_department_unit, departmentsByName, OFFERING_DEPARTMENTS);
      const semester = semestersByName.get(normalize(row.semester_term).includes('vacation') ? 'long vacation' : normalize(row.semester_term));
      const level = levelsByName.get(Number(row.level));
      if (!department || !semester || !level || !Number.isFinite(Number(row.credit_units))) {
        errors.push({ row: row.source_row_no, code: row.course_code, reason: 'Missing seeded department, level, semester, or credit units' });
        continue;
      }
      const isFoodEngineering = /food engineering/i.test(row.programme_scope);
      records.push({
        code: row.course_code,
        title: row.course_title,
        creditUnit: Number(row.credit_units),
        department: department._id,
        offeringDepartment: offeringDepartment?._id || null,
        offeringUnit: offeringDepartment ? '' : row.offering_department_unit,
        level: level._id,
        semester: semester._id,
        courseType: typeFrom(row.course_type),
        curriculumContext: isFoodEngineering ? 'B.Sc. Food Engineering' : '',
        curriculumVersion: '',
        titleAliases: [],
        isUndergraduate: true,
        isActive: true,
      });
    }
    if (errors.length) throw new Error(`Refusing partial READY-43 import: ${JSON.stringify(errors)}`);

    const indexes = await Course.collection.indexes();
    const oldIndex = indexes.find((index) => index.name === 'code_1_department_1_level_1_semester_1' && index.unique);
    if (oldIndex) await Course.collection.dropIndex(oldIndex.name);
    await Course.createIndexes();
    const operations = records.map((record) => ({
      updateOne: {
        filter: { code: record.code, department: record.department, level: record.level, semester: record.semester, curriculumContext: record.curriculumContext, curriculumVersion: record.curriculumVersion },
        update: { $set: record }, upsert: true,
      },
    }));
    const result = await Course.bulkWrite(operations, { ordered: false });
    logger.info(`READY-43 import complete: ${records.length} verified placements synced. Inserted ${result.upsertedCount || 0}, updated ${result.modifiedCount || 0}.`);
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => { logger.error(`READY-43 import failed: ${error.stack}`); process.exit(1); });
