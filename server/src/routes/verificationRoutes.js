import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verificationController } from '../controllers/verificationController.js';
import { verificationResolveSchema } from '../validators/studentValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER));

router.get('/', verificationController.listVerifications);
router.post('/:id/resolve', validate(verificationResolveSchema), verificationController.resolveVerification);

export default router;
