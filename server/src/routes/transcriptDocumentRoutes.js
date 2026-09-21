import { Router } from 'express';
import { protect, authorize, scopeToDepartment } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadTranscriptScans } from '../middleware/upload.js';
import { transcriptDocumentController } from '../controllers/transcriptDocumentController.js';
import { uploadTranscriptDocumentSchema } from '../validators/transcriptDocumentValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, scopeToDepartment);

const STAFF_ROLES = [ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD];

/**
 * @openapi
 * /transcript-documents:
 *   get:
 *     tags: [TranscriptDocuments]
 *     summary: List stored transcript scans (department-scoped for Result Officers/HODs)
 *     parameters:
 *       - in: query
 *         name: student
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list of transcript scans (metadata only, no file bytes) }
 *   post:
 *     tags: [TranscriptDocuments]
 *     summary: Upload one or more scanned/photographed pages of an old transcript for a student
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [student, files]
 *             properties:
 *               student: { type: string }
 *               label: { type: string }
 *               notes: { type: string }
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Transcript scan stored }
 *       400: { description: Missing files or combined size exceeds the storage limit }
 */
router.get('/', authorize(...STAFF_ROLES), transcriptDocumentController.list);
router.post(
  '/',
  authorize(...STAFF_ROLES),
  uploadTranscriptScans,
  validate(uploadTranscriptDocumentSchema),
  transcriptDocumentController.upload
);
router.get('/:id', authorize(...STAFF_ROLES), transcriptDocumentController.getById);

/**
 * @openapi
 * /transcript-documents/{id}/files/{fileId}:
 *   get:
 *     tags: [TranscriptDocuments]
 *     summary: Download one file from a stored transcript scan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The raw file, streamed as an attachment }
 */
router.get('/:id/files/:fileId', authorize(...STAFF_ROLES), transcriptDocumentController.downloadFile);
router.delete('/:id', authorize(ROLES.ADMIN), transcriptDocumentController.remove);

export default router;
