import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { courseController } from '../controllers/courseController.js';
import { courseCreateSchema, courseUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', courseController.list);
router.get('/:id', courseController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(courseCreateSchema), courseController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(courseUpdateSchema), courseController.update);
router.delete('/:id', authorize(ROLES.ADMIN), courseController.remove);

export default router;
