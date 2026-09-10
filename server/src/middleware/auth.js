import { User, DEPARTMENT_SCOPED_ROLES } from '../models/User.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired authentication token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  req.user = user;
  next();
});

export function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

export function scopeToDepartment(req, res, next) {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }
  req.departmentFilter = DEPARTMENT_SCOPED_ROLES.includes(req.user.role) ? req.user.department : null;
  return next();
}
