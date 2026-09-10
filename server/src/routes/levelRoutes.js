import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { levelController } from '../controllers/levelController.js';
import { levelCreateSchema, levelUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', levelController.list);
router.get('/:id', levelController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(levelCreateSchema), levelController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(levelUpdateSchema), levelController.update);
router.delete('/:id', authorize(ROLES.ADMIN), levelController.remove);

export default router;
