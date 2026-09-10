import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return new ApiError(400, 'Validation failed', details);
  }

  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return new ApiError(400, 'Validation failed', details);
  }

  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid value for field "${err.path}"`);
  }

  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ');
    return new ApiError(409, `A record with this ${fields} already exists`, err.keyValue);
  }

  if (err.name === 'JsonWebTokenError') {
    return new ApiError(401, 'Invalid authentication token');
  }

  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Authentication token has expired');
  }

  if (err.name === 'MulterError') {
    return new ApiError(400, `File upload error: ${err.message}`);
  }

  return new ApiError(500, env.isProduction ? 'Internal server error' : err.message || 'Internal server error');
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${apiError.message}`);
  }

  const body = {
    success: false,
    message: apiError.message,
  };
  if (apiError.details) body.errors = apiError.details;
  if (!env.isProduction && apiError.statusCode >= 500) body.stack = err.stack;

  res.status(apiError.statusCode).json(body);
}
