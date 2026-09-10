import fs from 'node:fs';
import { Backup } from '../models/Backup.js';
import { createBackupArchive, getBackupFilePath } from '../services/backupService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { logger } from '../config/logger.js';

export const triggerBackup = asyncHandler(async (req, res) => {
  let backup;
  try {
    const { fileName, sizeBytes } = await createBackupArchive();
    backup = await Backup.create({ fileName, sizeBytes, status: 'completed', triggeredBy: req.user._id });
  } catch (err) {
    logger.error(`Backup creation failed: ${err.stack}`);
    backup = await Backup.create({
      fileName: 'n/a',
      sizeBytes: 0,
      status: 'failed',
      errorMessage: err.message,
      triggeredBy: req.user._id,
    });
    await recordAudit(req, { action: AUDIT_ACTIONS.BACKUP_CREATED, module: 'Backup', entityId: backup._id, entityModel: 'Backup', newValue: { status: 'failed' } });
    throw ApiError.internal('Backup failed. Check server logs for details.');
  }

  await recordAudit(req, {
    action: AUDIT_ACTIONS.BACKUP_CREATED,
    module: 'Backup',
    entityId: backup._id,
    entityModel: 'Backup',
    newValue: { fileName: backup.fileName, sizeBytes: backup.sizeBytes },
  });

  return sendSuccess(res, { statusCode: 201, message: 'Backup created successfully', data: backup });
});

export const listBackups = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Backup.find().sort('-createdAt').skip(skip).limit(limit).populate('triggeredBy', 'name email'),
    Backup.countDocuments(),
  ]);
  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

export const downloadBackup = asyncHandler(async (req, res) => {
  const backup = await Backup.findById(req.params.id);
  if (!backup || backup.status !== 'completed') throw ApiError.notFound('Backup not found');

  const filePath = getBackupFilePath(backup.fileName);
  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('Backup file is no longer available on the server');
  }

  await recordAudit(req, { action: AUDIT_ACTIONS.EXPORT, module: 'Backup', entityId: backup._id, entityModel: 'Backup', reason: 'Backup download' });

  return res.download(filePath, backup.fileName);
});
