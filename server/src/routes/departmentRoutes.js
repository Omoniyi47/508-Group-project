import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { departmentController } from '../controllers/departmentController.js';
import { departmentCreateSchema, departmentUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', departmentController.list);
router.get('/:id', departmentController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(departmentCreateSchema), departmentController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(departmentUpdateSchema), departmentController.update);
router.delete('/:id', authorize(ROLES.ADMIN), departmentController.remove);

export default router;
