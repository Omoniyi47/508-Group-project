import { describe, expect, it } from 'vitest';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';
import { Course } from '../src/models/Course.js';
import { Semester } from '../src/models/Semester.js';
import { seedStudentReferenceData } from '../src/seed/studentReferenceData.js';
import { readCseHandbook, seedCseHandbook } from '../src/seed/cseHandbookData.js';

describe('Supplied CSE handbook', () => {
  it('requires the source department and faculty before making any writes', async () => {
    await expect(seedCseHandbook()).rejects.toThrow('Faculty of Technology');
    expect(await Course.countDocuments()).toBe(0);
  });

  it('imports all three pathways, preserves differing units, and holds conflicts and vacation placements', async () => {
    const faculty = await Faculty.create({ name: 'Faculty of Technology', code: 'TEC' });
    const department = await Department.create({ name: 'Computer Science and Engineering', code: 'CSENG', faculty: faculty._id });
    await seedStudentReferenceData();
    const catalogue = await readCseHandbook();
    const preview = await seedCseHandbook({ dryRun: true });
    expect(preview).toMatchObject({ placements: 231, active: 208, referenceOnly: 23 });
    expect(preview.programmes).toHaveLength(3);
    expect(await Course.countDocuments()).toBe(0);
    expect((await seedCseHandbook()).created).toBe(231);
    expect(await Course.countDocuments({ department: department._id })).toBe(231);
    const maths = await Course.findOne({ code: 'CSC 312', curriculumContext: 'B.Sc. Computer Science (Mathematics)' });
    const economics = await Course.findOne({ code: 'CSC 312', curriculumContext: 'B.Sc. Computer Science with Economics' });
    expect(maths).toMatchObject({ creditUnit: 3, isActive: true });
    expect(economics).toMatchObject({ creditUnit: 2, isActive: false });
    expect(economics.sourceNotes).toContain('lists 3');
    expect(economics.sourceSha256).toBe(catalogue.source.sha256);
    const vacation = await Course.findOne({ code: 'CPE 200' });
    expect(vacation).toMatchObject({ creditUnit: 3, semester: null, isActive: false });
    expect((await Semester.find()).map((item) => item.name).sort()).toEqual(['Harmattan','Rain']);
    expect(await Course.countDocuments({ code: 'SE' })).toBe(0);
    maths.title = 'Administrator-reviewed title';
    await maths.save();
    const savedDate = maths.updatedAt;
    expect((await seedCseHandbook()).created).toBe(0);
    const preserved = await Course.findById(maths._id);
    expect(preserved.title).toBe('Administrator-reviewed title');
    expect(preserved.updatedAt).toEqual(savedDate);
  });
});
