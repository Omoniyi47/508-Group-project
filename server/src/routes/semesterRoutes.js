import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { semesterController } from '../controllers/semesterController.js';
import { semesterCreateSchema, semesterUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', semesterController.list);
router.get('/:id', semesterController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(semesterCreateSchema), semesterController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(semesterUpdateSchema), semesterController.update);
router.delete('/:id', authorize(ROLES.ADMIN), semesterController.remove);

export default router;
