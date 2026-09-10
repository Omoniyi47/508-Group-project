import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Course, COURSE_TYPES } from '../models/Course.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Level } from '../models/Level.js';
import { Semester } from '../models/Semester.js';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node src/seed/importOauCourses.js <path-to-OAU-course-reference.docx>');

// Tables 17-55 in the supplied reference are detailed curriculum placements.
// Most describe one programme. Tables 19 and 36 explicitly describe a
// faculty-wide undergraduate curriculum, so their verified placements are
// expanded to every real student programme in that faculty.
const PROGRAMME_BY_TABLE = Object.freeze({
  16: 'Medicine',
  17: 'Accounting', 18: 'International Relations', 20: 'Foreign Languages', 21: 'History',
  22: 'Medical Rehabilitation', 23: 'Medical Rehabilitation', 24: 'Nursing Sciences',
  25: 'Computer Engineering', 26: 'Computer Science and Cyber Security', 27: 'Computer Science and Cyber Security',
  28: 'Information System', 29: 'Computer Engineering', 30: 'Software Engineering',
  31: 'Adult Education and Lifelong Learning', 32: 'Arts and Social Sciences Education',
  33: 'Science and Technology Education', 34: 'Building', 35: 'Fine and Applied Arts',
  37: 'Biochemistry', 38: 'Botany', 39: 'Geology', 40: 'Demography and Social Statistics',
  41: 'Economics', 42: 'Geography', 43: 'Psychology', 44: 'Sociology and Anthropology',
  45: 'Agricultural and Environmental Engineering', 46: 'Food Science and Technology',
  47: 'Foreign Languages', 48: 'Religious Studies', 49: 'Religious Studies',
  50: 'Oral and Maxillofacial Surgery and Oral Pathology', 53: 'Surveying and Geoinformatics',
  54: 'Electronic and Electrical Engineering', 55: 'Food Science and Technology',
});

const FACULTY_WIDE_PROGRAMMES_BY_TABLE = Object.freeze({
  19: 'Faculty of Agriculture',
  36: 'Faculty of Pharmacy',
});

const TERM_ORDERS = Object.freeze({
  'Long Vacation': 3,
  'Clinical Posting': 4,
});

const NAME_ALIASES = Object.freeze({
  'computer science and cybersecurity': 'Computer Science and Cyber Security',
  'biochemistry and molecular biology': 'Biochemistry',
  'nursing science': 'Nursing Sciences',
  'kinesiology health education and recreation': 'Physical and Health Education',
  'educational foundations and counselling': 'Educational Foundation and Counseling',
  'oral and maxillofacial surgery': 'Oral and Maxillofacial Surgery and Oral Pathology',
  'soil science and land resources management': 'Soil Science',
  'pharmaceutics and pharmaceutical technology': 'Pharmaceutics and Industrial Pharmacy',
  'agricultural and environmental engineering': 'Agricultural and Environmental Engineering',
  'science and technology education': 'Science and Technology Education',
});

const PYTHON_EXTRACTOR = String.raw`
import json, re, sys
from docx import Document

doc = Document(sys.argv[1])
rows = []
for table_index in range(15, 56):
    for row in doc.tables[table_index].rows[1:]:
        cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
        if len(cells) == 7:
            part, semester, code, title, units, requirement, offering = cells
        elif len(cells) == 6:
            part, semester, code, title, units, requirement = cells
            offering = ''
        elif table_index == 15 and len(cells) == 5:
            code, title, semester, units, requirement = cells
            part, offering = '', 'University-wide special electives'
        else:
            continue
        rows.append({
            'table': table_index, 'part': part, 'semester': semester, 'code': code,
            'title': title, 'units': units, 'requirement': requirement, 'offering': offering,
        })
print(json.dumps(rows, ensure_ascii=False))
`;

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function courseType(value) {
  const normalized = normalizeName(value);
  if (normalized.includes('special elective')) return COURSE_TYPES.SPECIAL_ELECTIVE;
  if (normalized.includes('restricted elective')) return COURSE_TYPES.RESTRICTED_ELECTIVE;
  if (normalized.includes('elective') || normalized.includes('option') || normalized.includes('free')) return COURSE_TYPES.ELECTIVE;
  if (normalized.includes('industrial training') || normalized.includes('siwes')) return COURSE_TYPES.INDUSTRIAL_TRAINING;
  if (normalized.includes('project')) return COURSE_TYPES.PROJECT;
  if (normalized.includes('practic') || normalized.includes('report') || normalized.includes('practical')) return COURSE_TYPES.PRACTICUM;
  return COURSE_TYPES.CORE;
}

function levelName(part) {
  const match = String(part).match(/Part\s+([IVX]+)/i);
  const roman = match?.[1]?.toUpperCase();
  return ({ I: '100', II: '200', III: '300', IV: '400', V: '500', VI: '600' })[roman] || null;
}

function semesterName(value) {
  if (/^Harmattan/i.test(value)) return 'Harmattan';
  if (/^Rain/i.test(value)) return 'Rain';
  if (/^Long Vacation/i.test(value)) return 'Long Vacation';
  if (/^Clinical posting/i.test(value)) return 'Clinical Posting';
  return null;
}

function isSupportedCreditUnit(value) {
  return Number.isFinite(value) && value >= 0.5 && value <= 10 && Number.isInteger(value * 2);
}

function comparableTitle(value) {
  return normalizeName(String(value).replace(/\band\b/gi, ''));
}

function isDuplicateCoursePlacement(existing, candidate) {
  return existing.code === candidate.code &&
    existing.creditUnit === candidate.creditUnit &&
    existing.courseType === candidate.courseType &&
    comparableTitle(existing.title) === comparableTitle(candidate.title);
}

function resolveProgrammeDepartments(row, departmentByName, departmentsByFaculty) {
  const facultyName = FACULTY_WIDE_PROGRAMMES_BY_TABLE[row.table];
  if (facultyName) return departmentsByFaculty.get(normalizeName(facultyName)) || [];

  const programmeName = PROGRAMME_BY_TABLE[row.table];
  if (!programmeName) return [];
  return [departmentByName.get(normalizeName(programmeName))].filter(Boolean);
}

function parseRows() {
  const raw = execFileSync('python', ['-c', PYTHON_EXTRACTOR, sourcePath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(raw);
}

async function run() {
  const extracted = parseRows();
  await connectDB();
  try {
    const [departments, faculties, levels, semesters] = await Promise.all([
      Department.find({}, 'name faculty'),
      Faculty.find({}, 'name'),
      Level.find({}, 'name'),
      Semester.find({}, 'name'),
    ]);
    const departmentByName = new Map(departments.map((department) => [normalizeName(department.name), department]));
    const facultyNameById = new Map(faculties.map((faculty) => [String(faculty._id), normalizeName(faculty.name)]));
    const departmentsByFaculty = new Map();
    for (const department of departments) {
      const facultyName = facultyNameById.get(String(department.faculty));
      if (!facultyName) continue;
      const members = departmentsByFaculty.get(facultyName) || [];
      members.push(department);
      departmentsByFaculty.set(facultyName, members);
    }
    const levelByName = new Map(levels.map((level) => [level.name, level]));
    const semesterByName = new Map(semesters.map((semester) => [semester.name, semester]));

    // The source has a small number of verified non-semester placements. Keep
    // them as selectable academic terms rather than relabelling them as
    // Harmattan or Rain and corrupting the historical record.
    let nextTermOrder = Math.max(0, ...semesters.map((semester) => semester.order || 0));
    for (const [termName, preferredOrder] of Object.entries(TERM_ORDERS)) {
      if (semesterByName.has(termName)) continue;
      const order = Math.max(preferredOrder, nextTermOrder + 1);
      const term = await Semester.create({ name: termName, order });
      semesterByName.set(termName, term);
      nextTermOrder = order;
    }

    const unresolved = [];
    const grouped = new Map();
    let sharedProgrammeMappings = 0;

    for (const row of extracted) {
      const level = levelByName.get(levelName(row.part));
      const semester = semesterByName.get(semesterName(row.semester));
      const code = String(row.code).replace(/\s+/g, ' ').trim().toUpperCase();
      const units = Number(row.units);
      const isUniversitySpecialElective = row.table === 15;
      const programmes = isUniversitySpecialElective ? [null] : resolveProgrammeDepartments(row, departmentByName, departmentsByFaculty);
      if ((!programmes.length && !isUniversitySpecialElective) || !semester || !isSupportedCreditUnit(units) || !/^[A-Z]{2,5}\s+\d{3}$/.test(code) || /verify/i.test(row.title)) {
        unresolved.push({ ...row, reason: 'Missing safe programme, level, semester, units, code, or verified title' });
        continue;
      }
      if (!isUniversitySpecialElective && !level) {
        unresolved.push({ ...row, reason: 'Missing safe undergraduate level' });
        continue;
      }

      const offeringKey = normalizeName(row.offering);
      const offeringAlias = NAME_ALIASES[offeringKey] || row.offering;
      const offering = departmentByName.get(normalizeName(offeringAlias)) || null;
      if (programmes.length > 1) sharedProgrammeMappings += programmes.length;

      for (const programme of programmes) {
        const record = {
          code,
          codePrefix: code.match(/^[A-Z]+/)[0],
          title: row.title.replace(/\s+/g, ' ').trim(),
          creditUnit: units,
          department: programme?._id || null,
          offeringDepartment: offering?._id || null,
          offeringUnit: offering ? '' : row.offering,
          level: level?._id || null,
          semester: semester._id,
          courseType: isUniversitySpecialElective ? COURSE_TYPES.SPECIAL_ELECTIVE : courseType(`${row.requirement} ${row.semester}`),
          isUndergraduate: true,
          isActive: true,
        };
        const key = [record.code, record.department || 'university', record.level || 'all-levels', record.semester].map(String).join(':');
        const existing = grouped.get(key);
        if (existing && !isDuplicateCoursePlacement(existing, record)) {
          unresolved.push({ ...row, reason: `Conflicting curriculum placement for ${code}` });
        } else if (!existing) {
          grouped.set(key, record);
        }
      }
    }

    const indexes = await Course.collection.indexes();
    if (indexes.some((index) => index.name === 'code_1' && index.unique)) await Course.collection.dropIndex('code_1');
    await Course.createIndexes();

    const legacyCourses = await Course.find({}, 'code courseType isUndergraduate isActive').lean();
    if (legacyCourses.length) {
      await Course.bulkWrite(
        legacyCourses.map((course) => ({
          updateOne: {
            filter: { _id: course._id },
            update: {
              $set: {
                codePrefix: String(course.code).match(/^[A-Z]+/)?.[0] || '',
                courseType: course.courseType || COURSE_TYPES.CORE,
                isUndergraduate: course.isUndergraduate ?? true,
                isActive: true,
              },
            },
          },
        }))
      );
    }

    const operations = [...grouped.values()].map((record) => ({
      updateOne: {
        filter: { code: record.code, department: record.department, level: record.level, semester: record.semester },
        update: { $set: record },
        upsert: true,
      },
    }));
    const result = operations.length ? await Course.bulkWrite(operations, { ordered: false }) : null;

    if (process.env.OAU_IMPORT_REVIEW_REPORT) {
      await writeFile(
        process.env.OAU_IMPORT_REVIEW_REPORT,
        JSON.stringify(
          {
            source: sourcePath,
            generatedAt: new Date().toISOString(),
            verifiedCurriculumMappings: grouped.size,
            sharedProgrammeMappings,
            heldBackRows: unresolved,
          },
          null,
          2
        )
      );
    }

    logger.info(
      `OAU course import complete: ${grouped.size} verified undergraduate curriculum courses synced; ` +
        `${sharedProgrammeMappings} shared-programme mappings applied; ${unresolved.length} rows held back because their placement could not be safely determined. ` +
        `Inserted ${result?.upsertedCount || 0}, updated ${result?.modifiedCount || 0}.`
    );
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => {
  logger.error(`OAU course import failed: ${error.stack}`);
  process.exit(1);
});
