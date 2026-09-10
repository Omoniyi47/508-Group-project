import { execFileSync } from 'node:child_process';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Course, COURSE_TYPES } from '../models/Course.js';
import { Department } from '../models/Department.js';
import { Level } from '../models/Level.js';
import { Semester } from '../models/Semester.js';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node src/seed/importOauResolvedRegister.js <resolved-register.docx>');

const PYTHON_EXTRACTOR = String.raw`
import json, sys
from docx import Document
doc = Document(sys.argv[1])
rows = []
for row in doc.tables[1].rows[1:]:
    cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
    if len(cells) == 11:
        rows.append(cells)
print(json.dumps(rows, ensure_ascii=False))
`;

const PROGRAMMES = Object.freeze({
  'computer engineering': 'Computer Engineering', cybersecurity: 'Computer Science and Cyber Security',
  'information and communication technology': 'Computer Engineering', botany: 'Botany',
  'foreign languages': 'Foreign Languages', 'adult education': 'Adult Education and Lifelong Learning',
  surveying: 'Surveying and Geoinformatics', 'food engineering': 'Food Science and Technology',
  'food science': 'Food Science and Technology', 'medical rehabilitation': 'Medical Rehabilitation',
});
const OFFERING_ALIASES = Object.freeze({
  'electronic electrical engineering': 'Electronic and Electrical Engineering',
  'biochemistry molecular biology': 'Biochemistry', 'educational foundations counselling': 'Educational Foundation and Counseling',
  'science technology education': 'Science and Technology Education',
  'department of foreign languages': 'Foreign Languages', 'department of surveying geoinformatics': 'Surveying and Geoinformatics',
});

function normalized(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function termName(value) {
  if (/harmattan/i.test(value)) return 'Harmattan';
  if (/rain/i.test(value)) return 'Rain';
  if (/vacation|long vacation/i.test(value)) return 'Long Vacation';
  return null;
}
function levelName(value) { return String(value || '').match(/(?:Part\s*)?(600|500|400|300|200|100|VI|IV|III|II|V|I)/i)?.[1].replace(/^I$/i, '100').replace(/^II$/i, '200').replace(/^III$/i, '300').replace(/^IV$/i, '400').replace(/^V$/i, '500').replace(/^VI$/i, '600'); }
function courseType(value) {
  const v = normalized(value);
  if (v.includes('project')) return COURSE_TYPES.PROJECT;
  if (v.includes('industrial')) return COURSE_TYPES.INDUSTRIAL_TRAINING;
  if (v.includes('restricted') || v.includes('free elective')) return COURSE_TYPES.RESTRICTED_ELECTIVE;
  return COURSE_TYPES.CORE;
}
function scopeDepartment(scope, byName) {
  const key = Object.keys(PROGRAMMES).find((name) => normalized(scope).includes(name));
  return key ? byName.get(normalized(PROGRAMMES[key])) : null;
}
function offeringDepartment(value, byName) {
  const n = normalized(value);
  const alias = OFFERING_ALIASES[n] || value;
  return byName.get(normalized(alias)) || null;
}
function parseCourse(value) {
  const match = String(value).match(/([A-Z]{2,5}\s*\d{3})\s*(?:\u2014|\u2013|-)\s*(.+)/);
  return match ? { code: match[1], title: match[2] } : null;
}

async function run() {
  const raw = JSON.parse(execFileSync('python', ['-c', PYTHON_EXTRACTOR, sourcePath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
  await connectDB();
  try {
    const [departments, levels, semesters] = await Promise.all([Department.find({}, 'name'), Level.find({}, 'name'), Semester.find({}, 'name')]);
    const byName = new Map(departments.map((item) => [normalized(item.name), item]));
    const levelsByName = new Map(levels.map((item) => [item.name, item]));
    const semestersByName = new Map(semesters.map((item) => [item.name, item]));
    const records = [];
    let skipped = 0;
    const skippedByReason = new Map();
    const hold = (reason) => { skipped += 1; skippedByReason.set(reason, (skippedByReason.get(reason) || 0) + 1); };
    for (const cells of raw) {
      const [number, status, scope, definition, unitsText, levelText, termText, typeText, offeringText, action] = cells;
      if (!status.startsWith('READY') && status !== 'VERSIONED CONFLICT') { hold(status); continue; }
      const parsed = parseCourse(definition);
      const level = levelsByName.get(levelName(levelText));
      const semester = semestersByName.get(termName(termText));
      const units = Number(unitsText);
      const department = scopeDepartment(scope, byName);
      const context = /information and communication technology/i.test(scope) ? 'B.Sc. Information and Communication Technology' : /physiotherapy/i.test(scope) ? 'Medical Rehabilitation Physiotherapy historical curriculum' : /food engineering/i.test(scope) ? 'B.Sc. Food Engineering' : '';
      if (status === 'READY - DEPARTMENT-PREFIXED') {
        const pharmacyProjects = [['PHA', 'Pharmaceutics and Industrial Pharmacy'], ['PCG', 'Pharmacognosy'], ['PCL', 'Pharmacology'], ['PHC', 'Pharmaceutical Chemistry'], ['PCA', 'Clinical Pharmacy and Pharmacy Administration']];
        for (const [prefix, name] of pharmacyProjects) for (const term of ['Harmattan', 'Rain']) records.push({ code: `${prefix} 510`, title: 'Final Year Project in the various Departments', creditUnit: 2, department: byName.get(normalized(name))._id, offeringDepartment: byName.get(normalized(name))._id, level: levelsByName.get('500')._id, semester: semestersByName.get(term)._id, courseType: COURSE_TYPES.PROJECT, curriculumContext: 'Bachelor of Pharmacy', curriculumVersion: '', titleAliases: [], isUndergraduate: true, isActive: true });
        continue;
      }
      if (!parsed || !department || !level || !semester || !Number.isFinite(units)) {
        hold(!parsed ? 'invalid course code/title' : !department ? 'programme context not represented as a seeded department' : !level ? 'no confirmed level' : !semester ? 'no confirmed semester/term' : 'no confirmed credit units');
        continue;
      }
      const aliases = [];
      if (parsed.code === 'FDE 499') aliases.push('Food Process Technology Lab II');
      if (parsed.code === 'FDE 504') aliases.push('Food Process Plant Design');
      records.push({ code: parsed.code, title: parsed.title, creditUnit: units, department: department._id, offeringDepartment: offeringDepartment(offeringText, byName)?._id || null, offeringUnit: offeringText, level: level._id, semester: semester._id, courseType: courseType(typeText), curriculumContext: context, curriculumVersion: status === 'VERSIONED CONFLICT' ? 'Historical Physiotherapy curriculum' : '', titleAliases: aliases, isUndergraduate: true, isActive: true });
    }
    const indexes = await Course.collection.indexes();
    const oldIndex = indexes.find((index) => index.name === 'code_1_department_1_level_1_semester_1' && index.unique);
    if (oldIndex) await Course.collection.dropIndex(oldIndex.name);
    await Course.createIndexes();
    const operations = records.map((record) => ({ updateOne: { filter: { code: record.code, department: record.department, level: record.level, semester: record.semester, curriculumContext: record.curriculumContext, curriculumVersion: record.curriculumVersion }, update: { $set: record }, upsert: true } }));
    const result = operations.length ? await Course.bulkWrite(operations, { ordered: false }) : null;
    logger.info(`Resolved OAU register: ${records.length} verified placements synced; ${skipped} rows deliberately not injected. Inserted ${result?.upsertedCount || 0}, updated ${result?.modifiedCount || 0}. ${JSON.stringify(Object.fromEntries(skippedByReason))}`);
  } finally { await disconnectDB(); }
}
run().catch((error) => { logger.error(`Resolved OAU register import failed: ${error.stack}`); process.exit(1); });
