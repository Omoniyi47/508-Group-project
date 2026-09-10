import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gradingRuleController } from '../controllers/gradingRuleController.js';
import { gradingRuleCreateSchema, gradingRuleUpdateSchema } from '../validators/academicValidators.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(protect);

router.get('/', gradingRuleController.list);
router.get('/:id', gradingRuleController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(gradingRuleCreateSchema), gradingRuleController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(gradingRuleUpdateSchema), gradingRuleController.update);
router.delete('/:id', authorize(ROLES.ADMIN), gradingRuleController.remove);

export default router;
