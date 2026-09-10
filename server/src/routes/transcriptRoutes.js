import { Router } from 'express';
import { protect, authorize, scopeToDepartment } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { transcriptController } from '../controllers/transcriptController.js';
import { createTranscriptRequestSchema, rejectTranscriptRequestSchema } from '../validators/transcriptValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, scopeToDepartment);

const VIEW_ROLES = [ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD];
const REQUEST_ROLES = [ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER];
const APPROVAL_ROLES = [ROLES.ADMIN, ROLES.HOD];

/**
 * @openapi
 * /transcripts/requests:
 *   post:
 *     tags: [Transcripts]
 *     summary: Open a transcript request for a student (Transcript Officer/Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student]
 *             properties:
 *               student: { type: string }
 *               purpose: { type: string, example: 'Employment verification' }
 *     responses:
 *       201: { description: Request created with status "requested" }
 *       409: { description: An in-progress request already exists for this student }
 *   get:
 *     tags: [Transcripts]
 *     summary: List transcript requests
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [requested, verified, approved, rejected, released] }
 *     responses:
 *       200: { description: Paginated request list }
 */
router.post('/requests', authorize(...REQUEST_ROLES), validate(createTranscriptRequestSchema), transcriptController.createRequest);
router.get('/requests', authorize(...VIEW_ROLES), transcriptController.listRequests);
router.get('/requests/:id', authorize(...VIEW_ROLES), transcriptController.getRequestById);
router.post('/requests/:id/verify', authorize(...REQUEST_ROLES), transcriptController.verifyRequest);

/**
 * @openapi
 * /transcripts/requests/{id}/approve:
 *   post:
 *     tags: [Transcripts]
 *     summary: Approve a verified transcript request (HOD/Admin) - freezes a computed snapshot
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request approved, transcript now exportable }
 *       409: { description: Only a verified request can be approved }
 */
router.post('/requests/:id/approve', authorize(...APPROVAL_ROLES), transcriptController.approveRequest);
router.post('/requests/:id/reject', authorize(...APPROVAL_ROLES), validate(rejectTranscriptRequestSchema), transcriptController.rejectRequest);
router.get('/requests/:id/pdf', authorize(...VIEW_ROLES), transcriptController.downloadPdf);
router.get('/requests/:id/excel', authorize(...VIEW_ROLES), transcriptController.downloadExcel);

/**
 * @openapi
 * /transcripts/{studentId}/preview:
 *   get:
 *     tags: [Transcripts]
 *     summary: Compute a live transcript preview for a student (session -> level -> semester, GPA/CGPA, classification)
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Computed transcript (only counts approved results) }
 */
router.get('/:studentId/preview', authorize(...VIEW_ROLES), transcriptController.getPreview);
router.get('/:studentId/preview/pdf', authorize(...VIEW_ROLES), transcriptController.getPreviewPdf);

export default router;
