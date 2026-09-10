import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { triggerBackup, listBackups, downloadBackup } from '../controllers/backupController.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', listBackups);
router.post('/', triggerBackup);
router.get('/:id/download', downloadBackup);

export default router;
