import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { syncPendingNotificationsForUser } from '../services/notificationService.js';

export const listNotifications = asyncHandler(async (req, res) => {
  await syncPendingNotificationsForUser(req.user);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 12, maxLimit: 50 });
  const filter = { recipient: req.user._id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.read === 'unread') filter.readAt = null;
  if (req.query.read === 'read') filter.readAt = { $ne: null };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  return sendSuccess(res, { data: items, meta: { ...buildMeta({ page, limit, total }), unread } });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw ApiError.notFound('Notification not found');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return sendSuccess(res, { data: notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { readAt: new Date() });
  return sendSuccess(res, { message: 'Notifications marked as read' });
});
