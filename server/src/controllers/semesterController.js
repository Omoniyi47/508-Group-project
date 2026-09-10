import { Semester } from '../models/Semester.js';
import { Course } from '../models/Course.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';

export const semesterController = buildCrudController(Semester, {
  searchableFields: ['name'],
  defaultSort: 'order',
  dependents: [
    { Model: Course, field: 'semester', label: 'course(s)' },
    { Model: Result, field: 'semester', label: 'result(s)' },
  ],
});
