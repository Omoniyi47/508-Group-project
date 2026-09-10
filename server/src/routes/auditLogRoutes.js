import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { listAuditLogs } from '../controllers/auditLogController.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', listAuditLogs);

export default router;
