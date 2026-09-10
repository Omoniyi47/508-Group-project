import { Student } from '../models/Student.js';
import { Session } from '../models/Session.js';
import { Result } from '../models/Result.js';
import { TranscriptRequest } from '../models/TranscriptRequest.js';
import { Verification, VERIFICATION_STATUSES } from '../models/Verification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { flagPotentialDuplicates } from '../services/duplicateDetectionService.js';
import { ROLES } from '../models/User.js';
import { NOTIFICATION_TYPES, notifyRole } from '../services/notificationService.js';

const POPULATE = [{ path: 'department', populate: 'faculty' }, 'entrySession', 'currentLevel', 'graduationSession'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function sessionIdsForYear(year) {
  const sessions = await Session.find({ name: new RegExp(`^${escapeRegex(year)}/`) }, '_id');
  return sessions.map((s) => s._id);
}

function assertDepartmentAccess(req, departmentId) {
  if (req.departmentFilter && String(req.departmentFilter) !== String(departmentId)) {
    throw ApiError.forbidden('You do not have access to students outside your department');
  }
}

export const listStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.departmentFilter) filter.department = req.departmentFilter;
  if (req.query.department) filter.department = req.query.department;
  if (req.query.status) filter.status = req.query.status;

  if (req.query.matric) filter.matricNumber = new RegExp(escapeRegex(req.query.matric), 'i');
  if (req.query.reg) filter.regNumber = new RegExp(escapeRegex(req.query.reg), 'i');

  if (req.query.name) {
    const regex = new RegExp(escapeRegex(req.query.name), 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { otherNames: regex }];
  }

  if (req.query.entryYear) {
    filter.entrySession = { $in: await sessionIdsForYear(req.query.entryYear) };
  }
  if (req.query.graduationYear) {
    filter.graduationSession = { $in: await sessionIdsForYear(req.query.graduationYear) };
  }

  let query = Student.find(filter).sort('lastName firstName').skip(skip).limit(limit);
  for (const p of POPULATE) query = query.populate(p);

  const [items, total] = await Promise.all([query, Student.countDocuments(filter)]);
  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

export const getStudentById = asyncHandler(async (req, res) => {
  let query = Student.findById(req.params.id);
  for (const p of POPULATE) query = query.populate(p);
  const student = await query;
  if (!student) throw ApiError.notFound('Student not found');

  assertDepartmentAccess(req, student.department._id || student.department);
  return sendSuccess(res, { data: student });
});

export const createStudent = asyncHandler(async (req, res) => {
  const data = { ...req.body, createdBy: req.user._id };

  if (req.user.role === ROLES.RESULT_OFFICER) {
    data.department = req.user.department;
  }
  if (!data.department) {
    throw ApiError.badRequest('Department is required');
  }
  if (!data.regNumber) delete data.regNumber; // keep the field truly absent so the sparse unique index ignores it
  for (const key of ['otherNames', 'gender', 'dateOfBirth', 'graduationSession', 'contactEmail', 'contactPhone']) {
    if (data[key] === null) delete data[key];
  }

  const student = await Student.create(data);
  const duplicates = await flagPotentialDuplicates(student);

  if (duplicates.length > 0) {
    const notification = {
      type: NOTIFICATION_TYPES.DUPLICATE_DETECTED,
      title: 'Possible duplicate student record',
      message: `${student.firstName} ${student.lastName} was flagged against ${duplicates.length} possible matching record${duplicates.length === 1 ? '' : 's'}.`,
      link: '/verification-queue',
    };
    await Promise.all([notifyRole(ROLES.TRANSCRIPT_OFFICER, notification), notifyRole(ROLES.ADMIN, notification)]);
  }

  await recordAudit(req, {
    action: AUDIT_ACTIONS.CREATE,
    module: 'Student',
    entityId: student._id,
    entityModel: 'Student',
    newValue: student.toObject(),
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: duplicates.length > 0 ? 'Student created and flagged for duplicate review' : 'Student created',
    data: student,
    meta: { duplicatesFlagged: duplicates.length },
  });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const existing = await Student.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Student not found');

  assertDepartmentAccess(req, existing.department);
  if (req.user.role === ROLES.RESULT_OFFICER) {
    delete req.body.department; // result officers cannot move a student to another department
  }
  if ('regNumber' in req.body && !req.body.regNumber) {
    req.body.regNumber = undefined; // clears the field so the sparse unique index ignores it, instead of storing null
  }

  const oldValue = existing.toObject();
  Object.assign(existing, req.body);
  await existing.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.UPDATE,
    module: 'Student',
    entityId: existing._id,
    entityModel: 'Student',
    oldValue,
    newValue: existing.toObject(),
  });

  return sendSuccess(res, { message: 'Student updated', data: existing });
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const existing = await Student.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Student not found');

  const [resultCount, transcriptRequestCount, pendingVerificationCount] = await Promise.all([
    Result.countDocuments({ student: existing._id }),
    TranscriptRequest.countDocuments({ student: existing._id }),
    Verification.countDocuments({
      status: VERIFICATION_STATUSES.PENDING,
      $or: [{ student: existing._id }, { matchedStudent: existing._id }],
    }),
  ]);

  if (resultCount > 0 || transcriptRequestCount > 0) {
    throw ApiError.conflict(
      `Cannot delete this student - they have ${resultCount} result(s) and ${transcriptRequestCount} transcript request(s) on file. ` +
        'If this is a duplicate record, resolve it from the Verification Queue instead so the history is merged rather than lost.'
    );
  }
  if (pendingVerificationCount > 0) {
    throw ApiError.conflict('Cannot delete this student while they have a pending duplicate review. Resolve it from the Verification Queue first.');
  }

  await existing.deleteOne();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.DELETE,
    module: 'Student',
    entityId: existing._id,
    entityModel: 'Student',
    oldValue: existing.toObject(),
  });

  return sendSuccess(res, { message: 'Student deleted' });
});

export const studentController = { listStudents, getStudentById, createStudent, updateStudent, deleteStudent };
