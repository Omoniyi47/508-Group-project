import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { facultyController } from '../controllers/facultyController.js';
import { facultyCreateSchema, facultyUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', facultyController.list);
router.get('/:id', facultyController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(facultyCreateSchema), facultyController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(facultyUpdateSchema), facultyController.update);
router.delete('/:id', authorize(ROLES.ADMIN), facultyController.remove);

export default router;
