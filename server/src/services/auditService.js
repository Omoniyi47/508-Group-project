import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

export const AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_CHANGED: 'password_changed',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REJECT: 'reject',
  VERIFY: 'verify',
  MERGE: 'merge',
  EXPORT: 'export',
  IMPORT_COMMIT: 'import_commit',
  BACKUP_CREATED: 'backup_created',
  SETTINGS_UPDATED: 'settings_updated',
});

function requestContext(req) {
  return {
    ipAddress: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
  };
}

export async function recordAudit(req, { action, module, entityId = null, entityModel = null, oldValue = null, newValue = null, reason = null, actorOverride = null }) {
  try {
    const actor = actorOverride ?? req?.user ?? null;
    const { ipAddress, userAgent } = requestContext(req);

    await AuditLog.create({
      actor: actor?._id || actor?.id || null,
      actorEmail: actor?.email || req?.body?.email || null,
      actorRole: actor?.role || null,
      action,
      module,
      entityId,
      entityModel,
      oldValue,
      newValue,
      reason,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logger.error(`Failed to record audit log for action=${action} module=${module}: ${err.message}`);
  }
}
