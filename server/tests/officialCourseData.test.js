import { describe, expect, it } from 'vitest';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';
import { Course } from '../src/models/Course.js';
import { ACADEMIC_STRUCTURE } from '../src/seed/academicStructureData.js';
import { seedStudentReferenceData } from '../src/seed/studentReferenceData.js';
import { readOfficialCourses, seedOfficialCourses } from '../src/seed/officialCourseData.js';

describe('official OAU course catalogue', () => {
  it('refuses an incomplete academic structure before inserting any courses', async () => {
    await expect(seedOfficialCourses()).rejects.toThrow('Missing department/faculty');
    expect(await Course.countDocuments()).toBe(0);
  });

  it('links real placements to their department/faculty and preserves edits on repeat imports', async () => {
    const records = await readOfficialCourses();
    const names = new Set(records.map((record) => record.departmentName));
    for (const structure of ACADEMIC_STRUCTURE) {
      const relevant = structure.departments.filter(([name]) => names.has(name));
      if (!relevant.length) continue;
      const faculty = await Faculty.create({ name: structure.name, code: structure.code });
      for (const [name, code] of relevant) await Department.create({ name, code, faculty: faculty._id });
    }
    await seedStudentReferenceData();
    expect(await seedOfficialCourses({ dryRun: true })).toEqual({ reviewedPlacements: records.length, departments: 6 });
    expect(await Course.countDocuments()).toBe(0);
    expect((await seedOfficialCourses()).created).toBe(records.length);
    const accounting = await Course.findOne({ code: 'ACC 101' }).populate({ path: 'department', populate: 'faculty' }).populate('semester level');
    expect(accounting.department.name).toBe('Accounting');
    expect(accounting.department.faculty.name).toBe('Faculty of Administration');
    expect(accounting.semester.name).toBe('Harmattan');
    expect(accounting.level.name).toBe('100');
    expect(accounting.creditUnit).toBe(3);
    expect(accounting.sourceUrl).toBe('https://accounting.oauife.edu.ng/course-content/');
    accounting.isActive = false;
    await accounting.save();
    const savedDate = accounting.updatedAt;
    expect((await seedOfficialCourses()).created).toBe(0);
    const preserved = await Course.findById(accounting._id);
    expect(preserved.isActive).toBe(false);
    expect(preserved.updatedAt).toEqual(savedDate);
    expect(await Course.countDocuments()).toBe(records.length);
  });
});
