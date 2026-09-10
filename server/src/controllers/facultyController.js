import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { buildCrudController } from '../services/crudFactory.js';

export const facultyController = buildCrudController(Faculty, {
  searchableFields: ['name', 'code'],
  dependents: [{ Model: Department, field: 'faculty', label: 'department(s)' }],
});
