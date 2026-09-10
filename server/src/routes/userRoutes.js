import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { userController } from '../controllers/userController.js';
import { userCreateSchema, userUpdateSchema, resetPasswordSchema } from '../validators/userValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', userController.list);
router.get('/:id', userController.getById);
router.post('/', validate(userCreateSchema), userController.create);
router.put('/:id', validate(userUpdateSchema), userController.update);
router.post('/:id/reset-password', validate(resetPasswordSchema), userController.resetPassword);

export default router;
