import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSettings, updateSettings } from '../controllers/systemSettingController.js';
import { systemSettingUpdateSchema } from '../validators/systemSettingValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', getSettings);
router.put('/', validate(systemSettingUpdateSchema), updateSettings);

export default router;
