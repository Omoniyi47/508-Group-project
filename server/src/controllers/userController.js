import { User } from '../models/User.js';
import { buildCrudController } from '../services/crudFactory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { normalize, nameSimilarity } from '../utils/stringSimilarity.js';

const NAME_SIMILARITY_THRESHOLD = 0.92;

const base = buildCrudController(User, {
  searchableFields: ['name', 'email'],
  filterableFields: ['role', 'department', 'isActive'],
  populate: ['department'],
  beforeCreate: async (data, req) => {
    const { password, confirmDuplicate, ...rest } = data;
    return {
      ...rest,
      passwordHash: await User.hashPassword(password),
      createdBy: req.user._id,
    };
  },
});

async function findSimilarUsers(name) {
  const candidateName = normalize(name);
  const others = await User.find({}, 'name email role isActive');

  return others
    .map((other) => ({ other, similarity: nameSimilarity(candidateName, normalize(other.name)) }))
    .filter(({ similarity }) => similarity >= NAME_SIMILARITY_THRESHOLD)
    .map(({ other, similarity }) => ({
      id: other._id,
      name: other.name,
      email: other.email,
      role: other.role,
      isActive: other.isActive,
      similarity: Math.round(similarity * 100) / 100,
    }));
}

const create = asyncHandler(async (req, res, next) => {
  // Case-insensitive/trimmed email pre-check, independent of the DB unique index, so we can
  // return a clean, specific error instead of a generic duplicate-key failure.
  const normalizedEmail = req.body.email.trim().toLowerCase();
  const emailClash = await User.findOne({ email: normalizedEmail });
  if (emailClash) {
    throw ApiError.conflict('A user with this email address already exists');
  }

  if (!req.body.confirmDuplicate) {
    const similarUsers = await findSimilarUsers(req.body.name);
    if (similarUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'One or more existing users have a very similar name. Confirm this is a different person to proceed.',
        duplicates: similarUsers,
      });
    }
  }

  return base.create(req, res, next);
});

const update = asyncHandler(async (req, res, next) => {
  if (req.params.id === req.user._id.toString() && req.body.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  return base.update(req, res, next);
});

const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  user.passwordHash = await User.hashPassword(req.body.newPassword);
  user.mustChangePassword = true;
  await user.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    module: 'User',
    entityId: user._id,
    entityModel: 'User',
    reason: 'Password reset by administrator',
  });

  return sendSuccess(res, { message: 'Password reset successfully' });
});

export const userController = { ...base, create, update, resetPassword };
