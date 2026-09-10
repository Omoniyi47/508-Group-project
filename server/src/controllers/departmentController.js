import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Student } from '../models/Student.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';

export const departmentController = buildCrudController(Department, {
  searchableFields: ['name', 'code'],
  populate: ['faculty', 'hod'],
  dependents: [
    { Model: User, field: 'department', label: 'user(s)' },
    { Model: Course, field: 'department', label: 'course(s)' },
    { Model: Student, field: 'department', label: 'student(s)' },
    { Model: Result, field: 'department', label: 'result(s)' },
  ],
});
