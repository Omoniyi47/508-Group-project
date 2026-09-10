import { Student } from '../models/Student.js';
import { TranscriptRequest, TRANSCRIPT_STATUSES } from '../models/TranscriptRequest.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { assertTranscriptReadyForOfficialIssue, computeStudentTranscript } from '../services/transcriptService.js';
import { renderTranscriptHtml } from '../templates/transcriptTemplate.js';
import { renderHtmlToPdf } from '../services/pdfService.js';
import { buildTranscriptWorkbook } from '../services/transcriptExcelService.js';
import { ROLES } from '../models/User.js';
import { NOTIFICATION_TYPES, notifyDepartmentHod, notifyRole, notifyUser } from '../services/notificationService.js';

const REQUEST_POPULATE = ['requestedBy', 'verifiedBy', 'approvedBy', { path: 'student', populate: ['department', 'entrySession', 'currentLevel', 'graduationSession'] }];

function assertDepartmentAccess(req, departmentId) {
  if (req.departmentFilter && String(req.departmentFilter) !== String(departmentId)) {
    throw ApiError.forbidden('You do not have access to transcripts outside your department');
  }
}

async function institutionContext() {
  const settings = await SystemSetting.getSingleton();
  return {
    institutionName: settings.institutionName,
    institutionAddress: settings.institutionAddress,
    registrarName: settings.registrarName,
    registrarEmail: settings.registrarEmail,
    registrarPhone: settings.registrarPhone,
    footerNote: settings.transcriptFooterNote,
    officialTranscriptWatermarkText: settings.officialTranscriptWatermarkText,
    officialTranscriptSealLabel: settings.officialTranscriptSealLabel,
  };
}

async function computeTranscriptWithRequirements(studentId) {
  const [history, settings] = await Promise.all([computeStudentTranscript(studentId), SystemSetting.getSingleton()]);
  const specialElectiveRequiredUnits = settings.specialElectiveRequiredUnits;
  return {
    ...history,
    specialElectiveRequiredUnits,
    specialElectiveUnitsRemaining: Math.max(0, specialElectiveRequiredUnits - history.specialElectiveCreditUnits),
  };
}

async function loadStudentForDisplay(studentId) {
  const student = await Student.findById(studentId).populate([
    { path: 'department', populate: 'faculty' },
    'entrySession',
    'currentLevel',
    'graduationSession',
  ]);
  if (!student) throw ApiError.notFound('Student not found');
  return student;
}

export const getPreview = asyncHandler(async (req, res) => {
  const student = await loadStudentForDisplay(req.params.studentId);
  assertDepartmentAccess(req, student.department._id);
  const history = await computeTranscriptWithRequirements(student._id);
  return sendSuccess(res, { data: { student, history } });
});

export const getPreviewPdf = asyncHandler(async (req, res) => {
  const student = await loadStudentForDisplay(req.params.studentId);
  assertDepartmentAccess(req, student.department._id);
  const history = await computeTranscriptWithRequirements(student._id);

  const html = renderTranscriptHtml({ student, history, transcriptRequest: null, ...(await institutionContext()) });
  const pdfBuffer = await renderHtmlToPdf(html);

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${student.matricNumber}-unofficial-transcript.pdf"`);
  return res.send(pdfBuffer);
});

export const createRequest = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.body.student);
  if (!student) throw ApiError.notFound('Student not found');

  const existing = await TranscriptRequest.findOne({
    student: student._id,
    status: { $in: [TRANSCRIPT_STATUSES.REQUESTED, TRANSCRIPT_STATUSES.VERIFIED] },
  });
  if (existing) throw ApiError.conflict('A transcript request is already in progress for this student');

  const transcriptRequest = await TranscriptRequest.create({
    student: student._id,
    department: student.department,
    requestedBy: req.user._id,
    purpose: req.body.purpose || null,
  });

  await recordAudit(req, {
    action: AUDIT_ACTIONS.CREATE,
    module: 'TranscriptRequest',
    entityId: transcriptRequest._id,
    entityModel: 'TranscriptRequest',
    newValue: transcriptRequest.toObject(),
  });
  await notifyRole(
    ROLES.TRANSCRIPT_OFFICER,
    {
      type: NOTIFICATION_TYPES.TRANSCRIPT_REQUESTED,
      title: 'New transcript request',
      message: 'A transcript request is ready for record verification.',
      link: '/transcript-requests',
    },
    { excludeUserId: req.user._id }
  );

  return sendSuccess(res, { statusCode: 201, message: 'Transcript request created', data: transcriptRequest });
});

export const listRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.departmentFilter) filter.department = req.departmentFilter;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.student) filter.student = req.query.student;

  let query = TranscriptRequest.find(filter).sort('-createdAt').skip(skip).limit(limit);
  for (const p of REQUEST_POPULATE) query = query.populate(p);

  const [items, total] = await Promise.all([query, TranscriptRequest.countDocuments(filter)]);
  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

export const getRequestById = asyncHandler(async (req, res) => {
  let query = TranscriptRequest.findById(req.params.id);
  for (const p of REQUEST_POPULATE) query = query.populate(p);
  const transcriptRequest = await query;
  if (!transcriptRequest) throw ApiError.notFound('Transcript request not found');
  assertDepartmentAccess(req, transcriptRequest.department);
  return sendSuccess(res, { data: transcriptRequest });
});

export const verifyRequest = asyncHandler(async (req, res) => {
  const transcriptRequest = await TranscriptRequest.findById(req.params.id);
  if (!transcriptRequest) throw ApiError.notFound('Transcript request not found');
  assertDepartmentAccess(req, transcriptRequest.department);
  if (transcriptRequest.status !== TRANSCRIPT_STATUSES.REQUESTED) {
    throw ApiError.conflict('Only newly requested transcripts can be verified');
  }

  transcriptRequest.status = TRANSCRIPT_STATUSES.VERIFIED;
  transcriptRequest.verifiedBy = req.user._id;
  transcriptRequest.verifiedAt = new Date();
  await transcriptRequest.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.VERIFY,
    module: 'TranscriptRequest',
    entityId: transcriptRequest._id,
    entityModel: 'TranscriptRequest',
    newValue: { status: transcriptRequest.status },
  });
  await notifyDepartmentHod(transcriptRequest.department, {
    type: NOTIFICATION_TYPES.TRANSCRIPT_VERIFIED,
    title: 'Transcript ready for approval',
    message: 'A transcript request has been verified and needs your approval.',
    link: '/transcript-requests?status=verified',
  });

  return sendSuccess(res, { message: 'Transcript request verified', data: transcriptRequest });
});

export const approveRequest = asyncHandler(async (req, res) => {
  const transcriptRequest = await TranscriptRequest.findById(req.params.id);
  if (!transcriptRequest) throw ApiError.notFound('Transcript request not found');
  assertDepartmentAccess(req, transcriptRequest.department);
  if (transcriptRequest.status !== TRANSCRIPT_STATUSES.VERIFIED) {
    throw ApiError.conflict('Only verified transcript requests can be approved');
  }

  await assertTranscriptReadyForOfficialIssue(transcriptRequest.student);
  const history = await computeTranscriptWithRequirements(transcriptRequest.student);

  transcriptRequest.status = TRANSCRIPT_STATUSES.APPROVED;
  transcriptRequest.issueSerial ||= `TR-${new Date().getUTCFullYear()}-${String(transcriptRequest._id).slice(-8).toUpperCase()}`;
  transcriptRequest.approvedBy = req.user._id;
  transcriptRequest.approvedAt = new Date();
  transcriptRequest.snapshotData = history;
  await transcriptRequest.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.APPROVE,
    module: 'TranscriptRequest',
    entityId: transcriptRequest._id,
    entityModel: 'TranscriptRequest',
    newValue: { status: transcriptRequest.status },
  });
  await notifyUser(transcriptRequest.requestedBy, {
    type: NOTIFICATION_TYPES.TRANSCRIPT_APPROVED,
    title: 'Transcript approved',
    message: 'The transcript is approved and can now be exported as an official PDF or Excel file.',
    link: `/transcripts/${transcriptRequest.student}`,
  });

  return sendSuccess(res, { message: 'Transcript approved', data: transcriptRequest });
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const transcriptRequest = await TranscriptRequest.findById(req.params.id);
  if (!transcriptRequest) throw ApiError.notFound('Transcript request not found');
  assertDepartmentAccess(req, transcriptRequest.department);
  if (![TRANSCRIPT_STATUSES.REQUESTED, TRANSCRIPT_STATUSES.VERIFIED].includes(transcriptRequest.status)) {
    throw ApiError.conflict('This request cannot be rejected in its current state');
  }

  transcriptRequest.status = TRANSCRIPT_STATUSES.REJECTED;
  transcriptRequest.rejectionReason = req.body.reason;
  await transcriptRequest.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.REJECT,
    module: 'TranscriptRequest',
    entityId: transcriptRequest._id,
    entityModel: 'TranscriptRequest',
    newValue: { status: transcriptRequest.status },
    reason: req.body.reason,
  });
  await notifyUser(transcriptRequest.requestedBy, {
    type: NOTIFICATION_TYPES.TRANSCRIPT_REJECTED,
    title: 'Transcript request needs attention',
    message: `The transcript request was rejected: ${req.body.reason}`,
    link: `/transcripts/${transcriptRequest.student}`,
  });

  return sendSuccess(res, { message: 'Transcript request rejected', data: transcriptRequest });
});

async function loadApprovedRequestForExport(req) {
  let query = TranscriptRequest.findById(req.params.id);
  for (const p of REQUEST_POPULATE) query = query.populate(p);
  const transcriptRequest = await query;
  if (!transcriptRequest) throw ApiError.notFound('Transcript request not found');
  assertDepartmentAccess(req, transcriptRequest.department);
  if (![TRANSCRIPT_STATUSES.APPROVED, TRANSCRIPT_STATUSES.RELEASED].includes(transcriptRequest.status)) {
    throw ApiError.conflict('Only an approved transcript can be exported');
  }
  await assertTranscriptReadyForOfficialIssue(transcriptRequest.student);
  let changed = false;
  if (!transcriptRequest.issueSerial) {
    transcriptRequest.issueSerial = `TR-${new Date().getUTCFullYear()}-${String(transcriptRequest._id).slice(-8).toUpperCase()}`;
    changed = true;
  }
  if (transcriptRequest.status === TRANSCRIPT_STATUSES.APPROVED) {
    transcriptRequest.status = TRANSCRIPT_STATUSES.RELEASED;
    transcriptRequest.releasedAt = new Date();
    changed = true;
  }
  if (changed) await transcriptRequest.save();
  return transcriptRequest;
}

export const downloadPdf = asyncHandler(async (req, res) => {
  const transcriptRequest = await loadApprovedRequestForExport(req);
  const student = await loadStudentForDisplay(transcriptRequest.student._id);
  const html = renderTranscriptHtml({ student, history: transcriptRequest.snapshotData, transcriptRequest, ...(await institutionContext()) });
  const pdfBuffer = await renderHtmlToPdf(html);

  await recordAudit(req, {
    action: AUDIT_ACTIONS.EXPORT,
    module: 'TranscriptRequest',
    entityId: transcriptRequest._id,
    entityModel: 'TranscriptRequest',
    reason: 'PDF export',
  });

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${student.matricNumber}-transcript.pdf"`);
  return res.send(pdfBuffer);
});

export const downloadExcel = asyncHandler(async (req, res) => {
  const transcriptRequest = await loadApprovedRequestForExport(req);
  const student = await loadStudentForDisplay(transcriptRequest.student._id);
  const workbook = await buildTranscriptWorkbook({ student, history: transcriptRequest.snapshotData, transcriptRequest, ...(await institutionContext()) });

  await recordAudit(req, {
    action: AUDIT_ACTIONS.EXPORT,
    module: 'TranscriptRequest',
    entityId: transcriptRequest._id,
    entityModel: 'TranscriptRequest',
    reason: 'Excel export',
  });

  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="${student.matricNumber}-transcript.xlsx"`);
  await workbook.xlsx.write(res);
  return res.end();
});

export const transcriptController = {
  getPreview,
  getPreviewPdf,
  createRequest,
  listRequests,
  getRequestById,
  verifyRequest,
  approveRequest,
  rejectRequest,
  downloadPdf,
  downloadExcel,
};
