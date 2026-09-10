import { Router } from 'express';
import { protect, authorize, scopeToDepartment } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadResultFile, uploadOcrResultFile } from '../middleware/upload.js';
import { resultController } from '../controllers/resultController.js';
import {
  resultCreateSchema,
  resultUpdateSchema,
  rejectResultSchema,
  submitBatchSchema,
  uploadContextSchema,
  ocrBatchRowUpdateSchema,
} from '../validators/resultValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, scopeToDepartment);

const ALL_STAFF = [ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD];
const ENTRY_ROLES = [ROLES.ADMIN, ROLES.RESULT_OFFICER];
const APPROVAL_ROLES = [ROLES.ADMIN, ROLES.HOD];

/**
 * @openapi
 * /results:
 *   get:
 *     tags: [Results]
 *     summary: List results (department-scoped for Result Officers/HODs)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, submitted, approved, rejected] }
 *       - in: query
 *         name: student
 *         schema: { type: string }
 *       - in: query
 *         name: course
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated result list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Result' } }
 *   post:
 *     tags: [Results]
 *     summary: Manually enter a single result (created as draft)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student, course, session, semester, level, score]
 *             properties:
 *               student: { type: string }
 *               course: { type: string }
 *               session: { type: string }
 *               semester: { type: string }
 *               level: { type: string }
 *               score: { type: number, minimum: 0, maximum: 100 }
 *     responses:
 *       201: { description: Draft result created, grade/gradePoint computed from the active grading rule }
 *       409: { description: A result already exists for this student/course/session/semester }
 */
router.get('/', authorize(...ALL_STAFF), resultController.listResults);
router.get('/upload-batches', authorize(...ENTRY_ROLES), resultController.listUploadBatches);
router.get('/upload-batches/:id', authorize(...ENTRY_ROLES), resultController.getUploadBatch);
router.post(
  '/upload-batches/preview',
  authorize(...ENTRY_ROLES),
  uploadResultFile,
  validate(uploadContextSchema),
  resultController.previewUpload
);
router.post(
  '/upload-batches/ocr-preview',
  authorize(...ENTRY_ROLES),
  uploadOcrResultFile,
  validate(uploadContextSchema),
  resultController.previewOcrUpload
);
router.post('/upload-batches/:id/confirm', authorize(...ENTRY_ROLES), resultController.confirmUpload);
router.patch(
  '/upload-batches/:id/rows/:rowNumber',
  authorize(...ENTRY_ROLES),
  validate(ocrBatchRowUpdateSchema),
  resultController.updateOcrBatchRow
);

router.get('/stats/grade-distribution', authorize(...ALL_STAFF), resultController.gradeDistribution);
router.get('/entry-safeguards', authorize(...ENTRY_ROLES), resultController.getEntrySafeguards);
router.get('/:id', authorize(...ALL_STAFF), resultController.getResultById);
router.post('/', authorize(...ENTRY_ROLES), validate(resultCreateSchema), resultController.createResult);
router.put('/:id', authorize(...ENTRY_ROLES), validate(resultUpdateSchema), resultController.updateResult);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESULT_OFFICER), resultController.deleteResult);

router.post('/:id/submit', authorize(...ENTRY_ROLES), resultController.submitResult);
router.post('/submit-batch', authorize(...ENTRY_ROLES), validate(submitBatchSchema), resultController.submitResultBatch);

/**
 * @openapi
 * /results/{id}/approve:
 *   post:
 *     tags: [Results]
 *     summary: Approve a submitted result (HOD/Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Result approved }
 *       409: { description: Only submitted results can be approved }
 */
router.post('/:id/approve', authorize(...APPROVAL_ROLES), resultController.approveResult);
router.post('/:id/reject', authorize(...APPROVAL_ROLES), validate(rejectResultSchema), resultController.rejectResult);

export default router;
