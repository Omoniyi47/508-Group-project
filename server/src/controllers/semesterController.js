import { Semester } from '../models/Semester.js';
import { Course } from '../models/Course.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const semesterController = buildCrudController(Semester, {
  searchableFields: ['name'],
  defaultSort: 'order',
  beforeList: (filter) => { filter.name = { $in: ['Harmattan', 'Rain'] }; },
  beforeCreate: (data) => ({ ...data, order: data.name === 'Harmattan' ? 1 : 2 }),
  beforeUpdate: (data, existing) => {
    if (!['Harmattan', 'Rain'].includes(existing.name)) throw ApiError.conflict('Historical terms are read-only');
    if (data.name && data.name !== existing.name) throw ApiError.conflict('Semester names are fixed: Harmattan and Rain');
    return { ...data, order: existing.name === 'Harmattan' ? 1 : 2 };
  },
  dependents: [
    { Model: Course, field: 'semester', label: 'course(s)' },
    { Model: Result, field: 'semester', label: 'result(s)' },
  ],
});

semesterController.remove = asyncHandler(async () => { throw ApiError.conflict('The two academic semesters cannot be deleted'); });
