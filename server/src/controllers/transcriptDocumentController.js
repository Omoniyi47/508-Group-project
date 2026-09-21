import { TranscriptDocument } from '../models/TranscriptDocument.js';
import { Student } from '../models/Student.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { normalizeUpload, MAX_TOTAL_BYTES } from '../services/transcriptDocumentService.js';
import { NOTIFICATION_TYPES, notifyDepartmentHod } from '../services/notificationService.js';

const POPULATE = [
  {
    path: 'student',
    populate: [{ path: 'department', populate: 'faculty' }, 'entrySession', 'currentLevel', 'graduationSession'],
  },
  { path: 'uploadedBy', populate: { path: 'department', populate: 'faculty' } },
];

async function applyPopulate(doc) {
  for (const p of POPULATE) await doc.populate(p);
  return doc;
}

function assertDepartmentAccess(req, departmentId) {
  if (req.departmentFilter && String(req.departmentFilter) !== String(departmentId)) {
    throw ApiError.forbidden('You do not have access to transcript scans outside your department');
  }
}

export const upload = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('At least one photo or file is required');
  }

  const student = await Student.findById(req.body.student);
  if (!student) throw ApiError.notFound('Student not found');
  assertDepartmentAccess(req, student.department);

  const normalized = await Promise.all(req.files.map(normalizeUpload));
  const totalBytes = normalized.reduce((sum, file) => sum + file.buffer.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw ApiError.badRequest('These files are too large together. Remove a page or upload them in a separate batch.');
  }

  const files = normalized.map((file, index) => ({
    filename: req.files[index].originalname,
    mimetype: file.mimetype,
    size: file.buffer.length,
    data: file.buffer,
  }));

  const document = await TranscriptDocument.create({
    student: student._id,
    department: student.department,
    uploadedBy: req.user._id,
    label: req.body.label || '',
    notes: req.body.notes || '',
    files,
  });

  await recordAudit(req, {
    action: AUDIT_ACTIONS.CREATE,
    module: 'TranscriptDocument',
    entityId: document._id,
    entityModel: 'TranscriptDocument',
    newValue: { student: student._id, fileCount: files.length },
  });
  await notifyDepartmentHod(student.department, {
    type: NOTIFICATION_TYPES.TRANSCRIPT_SCAN_UPLOADED,
    title: 'Transcript scan uploaded',
    message: `A scanned transcript was uploaded for ${student.firstName} ${student.lastName} (${student.matricNumber}).`,
    link: '/transcript-scans',
  });

  await applyPopulate(document);
  return sendSuccess(res, { statusCode: 201, message: 'Transcript scan uploaded', data: document });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.departmentFilter) filter.department = req.departmentFilter;
  else if (req.query.department) filter.department = req.query.department;

  if (req.query.student) filter.student = req.query.student;
  if (req.query.uploadedBy) filter.uploadedBy = req.query.uploadedBy;

  let query = TranscriptDocument.find(filter).sort('-createdAt').skip(skip).limit(limit);
  for (const p of POPULATE) query = query.populate(p);

  const [items, total] = await Promise.all([query, TranscriptDocument.countDocuments(filter)]);
  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

export const getById = asyncHandler(async (req, res) => {
  let query = TranscriptDocument.findById(req.params.id);
  for (const p of POPULATE) query = query.populate(p);
  const document = await query;
  if (!document) throw ApiError.notFound('Transcript scan not found');
  assertDepartmentAccess(req, document.department);
  return sendSuccess(res, { data: document });
});

export const downloadFile = asyncHandler(async (req, res) => {
  const document = await TranscriptDocument.findById(req.params.id).select('+files.data');
  if (!document) throw ApiError.notFound('Transcript scan not found');
  assertDepartmentAccess(req, document.department);

  const file = document.files.id(req.params.fileId);
  if (!file) throw ApiError.notFound('File not found in this transcript scan');

  await recordAudit(req, {
    action: AUDIT_ACTIONS.EXPORT,
    module: 'TranscriptDocument',
    entityId: document._id,
    entityModel: 'TranscriptDocument',
    reason: `Downloaded file: ${file.filename}`,
  });

  res.set('Content-Type', file.mimetype);
  res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.send(file.data);
});

export const remove = asyncHandler(async (req, res) => {
  const document = await TranscriptDocument.findById(req.params.id);
  if (!document) throw ApiError.notFound('Transcript scan not found');

  await document.deleteOne();
  await recordAudit(req, {
    action: AUDIT_ACTIONS.DELETE,
    module: 'TranscriptDocument',
    entityId: document._id,
    entityModel: 'TranscriptDocument',
    oldValue: { student: document.student, fileCount: document.files.length },
  });

  return sendSuccess(res, { message: 'Transcript scan deleted' });
});

export const transcriptDocumentController = {
  upload,
  list,
  getById,
  downloadFile,
  remove,
};
