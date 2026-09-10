import { Router } from 'express';
import { protect, authorize, scopeToDepartment } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { studentController } from '../controllers/studentController.js';
import { studentCreateSchema, studentUpdateSchema } from '../validators/studentValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, scopeToDepartment);

const ALL_STAFF = [ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD];

/**
 * @openapi
 * /students:
 *   get:
 *     tags: [Students]
 *     summary: Search/list students
 *     description: Result Officers and HODs are automatically scoped to their own department.
 *     parameters:
 *       - in: query
 *         name: matric
 *         schema: { type: string }
 *         description: Partial, case-insensitive matric number match
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Partial, case-insensitive match against first/last/other names
 *       - in: query
 *         name: entryYear
 *         schema: { type: string, example: '2020' }
 *       - in: query
 *         name: graduationYear
 *         schema: { type: string, example: '2024' }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, graduated, withdrawn, suspended] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated student list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Student' } }
 *                 meta: { type: object, properties: { page: { type: integer }, total: { type: integer } } }
 *   post:
 *     tags: [Students]
 *     summary: Create a student
 *     description: Uses the student's full name and matric number as the identity check; different matric numbers are treated as different students.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Student' }
 *     responses:
 *       201:
 *         description: Student created (meta.duplicatesFlagged indicates whether a review was queued)
 *       409:
 *         description: Duplicate matric/reg number
 */
router.get('/', authorize(...ALL_STAFF), studentController.listStudents);
router.get('/:id', authorize(...ALL_STAFF), studentController.getStudentById);
router.post('/', authorize(ROLES.ADMIN, ROLES.RESULT_OFFICER), validate(studentCreateSchema), studentController.createStudent);
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER),
  validate(studentUpdateSchema),
  studentController.updateStudent
);
router.delete('/:id', authorize(ROLES.ADMIN), studentController.deleteStudent);

export default router;
