import { readFile } from 'node:fs/promises';
import { Course } from '../models/Course.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Level } from '../models/Level.js';
import { Semester } from '../models/Semester.js';

export async function readOfficialCourses() {
  return JSON.parse(await readFile(new URL('./data/oauOfficialCourses.json', import.meta.url), 'utf8'));
}

// Only assign an offering department where the source department and its own
// course prefix agree. Service courses retain their programme placement, with
// the offering department left unconfirmed rather than guessed.
const OWN_PREFIXES = {
  Accounting: ['ACC'], Microbiology: ['MCB'],
  'Electronic and Electrical Engineering': ['EEE'],
  'Adult Education and Lifelong Learning': ['ALL'],
  Economics: ['ECN'], 'Linguistics and African Languages': ['LIN', 'YOR'],
};

export async function seedOfficialCourses({ dryRun = false } = {}) {
  const [records, departments, levels, semesters] = await Promise.all([
    readOfficialCourses(), Department.find().populate({ path: 'faculty', model: Faculty }), Level.find(), Semester.find(),
  ]);
  const byName = (items) => new Map(items.map((item) => [item.name, item]));
  const deptMap = byName(departments), levelMap = byName(levels), semesterMap = byName(semesters);
  const prepared = [];
  // Preflight the entire import before the first write.
  for (const record of records) {
    const department = deptMap.get(record.departmentName);
    const level = levelMap.get(record.levelName);
    const semester = semesterMap.get(record.semesterName);
    if (!department?.faculty?._id || !level || !semester) {
      throw new Error(`Missing department/faculty, level or semester for ${record.departmentName}: ${record.code}`);
    }
    if (!/^https:\/\/([a-z0-9-]+\.)*oauife\.edu\.ng\//i.test(record.sourceUrl)) {
      throw new Error(`Unapproved source for ${record.code}`);
    }
    const { departmentName, levelName, semesterName, ...data } = record;
    const prefix = record.code.split(' ')[0];
    const course = new Course({ ...data, department: department._id, level: level._id, semester: semester._id,
      offeringDepartment: OWN_PREFIXES[departmentName]?.includes(prefix) ? department._id : null,
      offeringUnit: OWN_PREFIXES[departmentName]?.includes(prefix) ? department.name : '',
      isActive: true, isUndergraduate: true,
    });
    await course.validate();
    prepared.push(course);
  }
  if (dryRun) return { reviewedPlacements: prepared.length, departments: new Set(records.map((r) => r.departmentName)).size };
  let created = 0;
  for (const course of prepared) {
    const now = new Date();
    const data = course.toObject();
    delete data._id;
    const result = await Course.updateOne({ code: data.code, department: data.department, level: data.level,
      semester: data.semester, curriculumContext: data.curriculumContext, curriculumVersion: data.curriculumVersion },
    { $setOnInsert: { ...data, createdAt: now, updatedAt: now } }, { upsert: true, timestamps: false });
    created += result.upsertedCount;
  }
  return { reviewedPlacements: prepared.length, created, preserved: prepared.length - created };
}
