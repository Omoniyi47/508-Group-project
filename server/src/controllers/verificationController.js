import { Verification, VERIFICATION_STATUSES } from '../models/Verification.js';
import { Student } from '../models/Student.js';
import { Result } from '../models/Result.js';
import { TranscriptRequest } from '../models/TranscriptRequest.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { logger } from '../config/logger.js';

// Reassigns the removed student's academic history onto the kept record so a merge
// combines the two students' data instead of silently orphaning it. Result has a unique
// (student, course, session, semester) index, so a genuine clash - both records already
// having a result for the same course/session/semester - means the removed student's row
// is a true duplicate of one the kept student already has, and is dropped rather than kept.
async function reassignStudentReferences(fromId, toId) {
  await TranscriptRequest.updateMany({ student: fromId }, { student: toId });

  const results = await Result.find({ student: fromId });
  let reassigned = 0;
  let droppedAsDuplicate = 0;
  for (const result of results) {
    result.student = toId;
    try {
      await result.save();
      reassigned += 1;
    } catch (err) {
      if (err.code === 11000) {
        await result.deleteOne();
        droppedAsDuplicate += 1;
      } else {
        throw err;
      }
    }
  }
  if (droppedAsDuplicate > 0) {
    logger.info(`Merge: dropped ${droppedAsDuplicate} result(s) as duplicates already present on the kept student record`);
  }
  return { reassigned, droppedAsDuplicate };
}

const POPULATE = [
  { path: 'student', populate: 'department' },
  { path: 'matchedStudent', populate: 'department' },
  'resolvedBy',
];

export const listVerifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status: req.query.status || VERIFICATION_STATUSES.PENDING };

  let query = Verification.find(filter).sort('-createdAt').skip(skip).limit(limit);
  for (const p of POPULATE) query = query.populate(p);

  const [items, total] = await Promise.all([query, Verification.countDocuments(filter)]);
  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

export const resolveVerification = asyncHandler(async (req, res) => {
  const verification = await Verification.findById(req.params.id);
  if (!verification) throw ApiError.notFound('Verification record not found');
  if (verification.status !== VERIFICATION_STATUSES.PENDING) {
    throw ApiError.conflict('This verification has already been resolved');
  }

  const { action, keep = 'matchedStudent', notes } = req.body;

  if (action === 'distinct') {
    verification.status = VERIFICATION_STATUSES.RESOLVED_DISTINCT;
  } else {
    const keepId = keep === 'student' ? verification.student : verification.matchedStudent;
    const removeId = keep === 'student' ? verification.matchedStudent : verification.student;

    const { reassigned, droppedAsDuplicate } = await reassignStudentReferences(removeId, keepId);
    const removed = await Student.findByIdAndDelete(removeId);
    verification.status = VERIFICATION_STATUSES.RESOLVED_MERGED;

    await recordAudit(req, {
      action: AUDIT_ACTIONS.MERGE,
      module: 'Student',
      entityId: keepId,
      entityModel: 'Student',
      oldValue: removed?.toObject() || null,
      reason: notes || `Merged as duplicate student record (${reassigned} result(s) carried over, ${droppedAsDuplicate} dropped as duplicates)`,
    });
  }

  verification.resolvedBy = req.user._id;
  verification.resolvedAt = new Date();
  verification.resolutionNotes = notes || null;
  await verification.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.VERIFY,
    module: 'Verification',
    entityId: verification._id,
    entityModel: 'Verification',
    newValue: verification.toObject(),
    reason: notes || null,
  });

  return sendSuccess(res, { message: 'Verification resolved', data: verification });
});

export const verificationController = { listVerifications, resolveVerification };
