import { GradingRule } from '../models/GradingRule.js';
import { buildCrudController } from '../services/crudFactory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

const base = buildCrudController(GradingRule, { searchableFields: ['name'] });

const remove = asyncHandler(async (req, res, next) => {
  const rule = await GradingRule.findById(req.params.id);
  if (rule?.isActive) {
    throw ApiError.conflict('Cannot delete the active grading rule. Activate a different rule first.');
  }
  return base.remove(req, res, next);
});

export const gradingRuleController = { ...base, remove };
