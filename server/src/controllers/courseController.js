import { Course } from '../models/Course.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';
import { Semester } from '../models/Semester.js';
import { assertAcademicSemester } from '../services/semesterService.js';

export const courseController = buildCrudController(Course, {
  searchableFields: ['code', 'title'],
  filterableFields: ['department', 'offeringDepartment', 'level', 'semester', 'codePrefix', 'courseType', 'isUndergraduate', 'isActive'],
  populate: [{ path: 'department', populate: 'faculty' }, { path: 'offeringDepartment', populate: 'faculty' }, 'level', 'semester'],
  defaultSort: 'code',
  dependents: [{ Model: Result, field: 'course', label: 'result(s)' }],
  beforeCreate: async (data) => { if (data.semester) await assertAcademicSemester(data.semester); return data; },
  beforeUpdate: async (data, existing) => {
    if (data.semester && String(data.semester) !== String(existing.semester)) await assertAcademicSemester(data.semester);
    return data;
  },
  // Departmental searches include university-wide courses such as special
  // electives, which intentionally have no programme department or level.
  beforeList: async (filter, req) => {
    if (req.query.isActive === 'true') {
      const semesters = await Semester.find({ name: { $in: ['Harmattan', 'Rain'] } }).select('_id');
      filter.$and ||= [];
      filter.$and.push({ $or: [{ semester: { $in: semesters.map((semester) => semester._id) } }, { semester: null }] });
    }
    for (const field of ['department', 'level']) {
      if (!req.query[field]) continue;
      const selectedId = filter[field];
      delete filter[field];
      filter.$and ||= [];
      filter.$and.push({ $or: [{ [field]: selectedId }, { [field]: null }] });
    }
  },
});
