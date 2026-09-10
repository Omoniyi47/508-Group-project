import { Level } from '../models/Level.js';
import { Course } from '../models/Course.js';
import { Student } from '../models/Student.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';

export const levelController = buildCrudController(Level, {
  searchableFields: ['name'],
  defaultSort: 'order',
  dependents: [
    { Model: Course, field: 'level', label: 'course(s)' },
    { Model: Student, field: 'currentLevel', label: 'student(s)' },
    { Model: Result, field: 'level', label: 'result(s)' },
  ],
});
