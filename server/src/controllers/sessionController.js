import { Session } from '../models/Session.js';
import { Student } from '../models/Student.js';
import { Result } from '../models/Result.js';
import { buildCrudController } from '../services/crudFactory.js';

export const sessionController = buildCrudController(Session, {
  searchableFields: ['name'],
  defaultSort: '-startDate',
  dependents: [
    { Model: Student, field: 'entrySession', label: 'student(s) with this entry session' },
    { Model: Student, field: 'graduationSession', label: 'student(s) with this graduation session' },
    { Model: Result, field: 'session', label: 'result(s)' },
  ],
});
