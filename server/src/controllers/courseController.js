import { Course } from '../models/Course.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';

export const courseController = buildCrudController(Course, {
  searchableFields: ['code', 'title'],
  filterableFields: ['department', 'offeringDepartment', 'level', 'semester', 'codePrefix', 'courseType', 'isUndergraduate', 'isActive'],
  populate: ['department', 'offeringDepartment', 'level', 'semester'],
  defaultSort: 'code',
  dependents: [{ Model: Result, field: 'course', label: 'result(s)' }],
  // Departmental searches include university-wide courses such as special
  // electives, which intentionally have no programme department or level.
  beforeList: (filter, req) => {
    for (const field of ['department', 'level']) {
      if (!req.query[field]) continue;
      const selectedId = filter[field];
      delete filter[field];
      filter.$and ||= [];
      filter.$and.push({ $or: [{ [field]: selectedId }, { [field]: null }] });
    }
  },
});
