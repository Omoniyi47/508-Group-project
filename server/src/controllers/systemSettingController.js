import { SystemSetting } from '../models/SystemSetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSetting.getSingleton();
  return sendSuccess(res, { data: settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSetting.getSingleton();
  const oldValue = settings.toObject();

  Object.assign(settings, req.body, { updatedBy: req.user._id });
  await settings.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    module: 'SystemSetting',
    entityId: settings._id,
    entityModel: 'SystemSetting',
    oldValue,
    newValue: settings.toObject(),
  });

  return sendSuccess(res, { message: 'Settings updated', data: settings });
});
