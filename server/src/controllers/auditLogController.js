import { AuditLog } from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { getPagination, buildMeta } from '../utils/pagination.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  for (const field of ['module', 'action', 'actor']) {
    if (req.query[field]) filter[field] = req.query[field];
  }

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('actor', 'name email role'),
    AuditLog.countDocuments(filter),
  ]);

  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});
