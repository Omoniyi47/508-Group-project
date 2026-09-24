import { readFile } from 'node:fs/promises';
import { Course } from '../models/Course.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Level } from '../models/Level.js';
import { Semester } from '../models/Semester.js';

export async function readCseHandbook() {
  return JSON.parse(await readFile(new URL('./data/cseHandbookCourses.json', import.meta.url), 'utf8'));
}

export async function seedCseHandbook({ dryRun = false } = {}) {
  const catalogue = await readCseHandbook();
  const [department, levels, semesters] = await Promise.all([
    Department.findOne({ code: 'CSENG' }).populate({ path: 'faculty', model: Faculty }),
    Level.find(), Semester.find({ name: { $in: ['Harmattan', 'Rain'] } }),
  ]);
  if (department?.name !== catalogue.source.sourceDepartment || department?.faculty?.code !== 'TEC') {
    throw new Error('The handbook requires Computer Science and Engineering (CSENG), Faculty of Technology (TEC)');
  }
  const prepared = [];
  for (const record of catalogue.records) {
    const level = record.levelName ? levels.find((item) => item.name === record.levelName) : null;
    const semester = semesters.find((item) => item.name === record.semesterName);
    if ((record.levelName && !level) || (['Harmattan', 'Rain'].includes(record.semesterName) && !semester)) {
      throw new Error(`Missing academic reference for ${record.code}`);
    }
    if (record.isActive && (!semester || record.sourceNotes)) throw new Error(`Unreviewed active placement: ${record.code}`);
    const ownCourse = /^(CSC|CPE) /.test(record.code);
    const course = new Course({ code: record.code, title: record.title, creditUnit: record.creditUnit,
      department: department._id, offeringDepartment: ownCourse ? department._id : null,
      offeringUnit: ownCourse ? department.name : '', level: level?._id || null, semester: semester?._id || null,
      courseType: record.courseType, curriculumContext: record.curriculumContext, curriculumVersion: record.curriculumVersion,
      isActive: record.isActive, isUndergraduate: true, sourceDocument: catalogue.source.fileName,
      sourceSha256: catalogue.source.sha256, sourceLocation: record.sourceLocation, sourceNotes: record.sourceNotes ||
        (record.semesterName === 'Long Vacation' ? 'Vacation-only placement retained as inactive reference; no third semester created.' : ''),
    });
    await course.validate();
    prepared.push(course);
  }
  const summary = { placements: prepared.length, active: prepared.filter((course) => course.isActive).length,
    referenceOnly: prepared.filter((course) => !course.isActive).length, programmes: catalogue.programmes };
  if (dryRun) return summary;
  let created = 0;
  for (const course of prepared) {
    const data = course.toObject();
    delete data._id;
    const now = new Date();
    const result = await Course.updateOne({ code: data.code, department: data.department, level: data.level,
      semester: data.semester, curriculumContext: data.curriculumContext, curriculumVersion: data.curriculumVersion },
    { $setOnInsert: { ...data, createdAt: now, updatedAt: now } }, { upsert: true, timestamps: false });
    created += result.upsertedCount;
  }
  return { ...summary, created, preserved: prepared.length - created };
}
