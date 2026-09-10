import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sessionController } from '../controllers/sessionController.js';
import { sessionCreateSchema, sessionUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', sessionController.list);
router.get('/:id', sessionController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(sessionCreateSchema), sessionController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(sessionUpdateSchema), sessionController.update);
router.delete('/:id', authorize(ROLES.ADMIN), sessionController.remove);

export default router;
