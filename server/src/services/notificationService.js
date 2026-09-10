import { Notification } from '../models/Notification.js';
import { Department } from '../models/Department.js';
import { User, ROLES } from '../models/User.js';
import { Result, RESULT_STATUSES } from '../models/Result.js';
import { TranscriptRequest, TRANSCRIPT_STATUSES } from '../models/TranscriptRequest.js';
import { Verification, VERIFICATION_STATUSES } from '../models/Verification.js';
import { logger } from '../config/logger.js';

export const NOTIFICATION_TYPES = Object.freeze({
  RESULT_SUBMITTED: 'result_submitted',
  RESULT_APPROVED: 'result_approved',
  RESULT_REJECTED: 'result_rejected',
  TRANSCRIPT_REQUESTED: 'transcript_requested',
  TRANSCRIPT_VERIFIED: 'transcript_verified',
  TRANSCRIPT_APPROVED: 'transcript_approved',
  TRANSCRIPT_REJECTED: 'transcript_rejected',
  DUPLICATE_DETECTED: 'duplicate_detected',
  CURRICULUM_INCOMPLETE: 'curriculum_incomplete',
});

export async function notifyUser(recipient, { title, message, type, link = null }) {
  if (!recipient) return;
  try {
    await Notification.create({ recipient, title, message, type, link });
  } catch (err) {
    logger.error(`Failed to create notification: ${err.message}`);
  }
}

export async function notifyDepartmentHod(departmentId, notification) {
  const department = await Department.findById(departmentId).select('hod');
  if (department?.hod) await notifyUser(department.hod, notification);
}

export async function notifyRole(role, notification, { excludeUserId = null } = {}) {
  const users = await User.find({ role, isActive: true }, '_id');
  await Promise.all(
    users
      .filter((user) => !excludeUserId || String(user._id) !== String(excludeUserId))
      .map((user) => notifyUser(user._id, notification))
  );
}

async function syncPendingQueue(recipient, { dedupeKey, count, title, message, type, link }) {
  const filter = { recipient, dedupeKey };
  if (count === 0) {
    await Notification.deleteOne(filter);
    return;
  }
  await Notification.findOneAndUpdate(
    filter,
    { $set: { title, message: message(count), type, link } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

// Creates one live, deduplicated queue alert for older records as well as new
// workflow activity. This makes the bell useful immediately after deployment.
export async function syncPendingNotificationsForUser(user) {
  try {
    const recipient = user._id;
    const jobs = [];

    if (user.role === ROLES.HOD) {
      const [submittedResults, verifiedTranscripts] = await Promise.all([
        Result.countDocuments({ department: user.department, status: RESULT_STATUSES.SUBMITTED }),
        TranscriptRequest.countDocuments({ department: user.department, status: TRANSCRIPT_STATUSES.VERIFIED }),
      ]);
      jobs.push(
        syncPendingQueue(recipient, {
          dedupeKey: `hod-results:${user.department}`,
          count: submittedResults,
          title: 'Results awaiting approval',
          message: (count) =>
            count === 1 ? '1 result needs your departmental approval.' : `${count} results need your departmental approval.`,
          type: NOTIFICATION_TYPES.RESULT_SUBMITTED,
          link: '/results?status=submitted',
        }),
        syncPendingQueue(recipient, {
          dedupeKey: `hod-transcripts:${user.department}`,
          count: verifiedTranscripts,
          title: 'Transcripts awaiting approval',
          message: (count) =>
            count === 1 ? '1 verified transcript request needs your approval.' : `${count} verified transcript requests need your approval.`,
          type: NOTIFICATION_TYPES.TRANSCRIPT_VERIFIED,
          link: '/transcript-requests?status=verified',
        })
      );
    }

    if (user.role === ROLES.RESULT_OFFICER) {
      const rejectedResults = await Result.countDocuments({ enteredBy: recipient, status: RESULT_STATUSES.REJECTED });
      jobs.push(
        syncPendingQueue(recipient, {
          dedupeKey: `officer-rejected:${recipient}`,
          count: rejectedResults,
          title: 'Results need correction',
          message: (count) =>
            count === 1
              ? '1 result was rejected and needs correction before resubmission.'
              : `${count} results were rejected and need correction before resubmission.`,
          type: NOTIFICATION_TYPES.RESULT_REJECTED,
          link: '/results?status=rejected',
        })
      );
    }

    if (user.role === ROLES.TRANSCRIPT_OFFICER || user.role === ROLES.ADMIN) {
      const [duplicates, requestedTranscripts] = await Promise.all([
        Verification.countDocuments({ status: VERIFICATION_STATUSES.PENDING }),
        TranscriptRequest.countDocuments({ status: TRANSCRIPT_STATUSES.REQUESTED }),
      ]);
      jobs.push(
        syncPendingQueue(recipient, {
          dedupeKey: `duplicate-review:${recipient}`,
          count: duplicates,
          title: 'Duplicate records need review',
          message: (count) =>
            count === 1 ? '1 possible duplicate student record needs review.' : `${count} possible duplicate student records need review.`,
          type: NOTIFICATION_TYPES.DUPLICATE_DETECTED,
          link: '/verification-queue',
        }),
        syncPendingQueue(recipient, {
          dedupeKey: `transcript-verification:${recipient}`,
          count: requestedTranscripts,
          title: 'Transcript requests awaiting verification',
          message: (count) =>
            count === 1 ? '1 transcript request is ready for verification.' : `${count} transcript requests are ready for verification.`,
          type: NOTIFICATION_TYPES.TRANSCRIPT_REQUESTED,
          link: '/transcript-requests?status=requested',
        })
      );
    }

    await Promise.all(jobs);
  } catch (err) {
    logger.error(`Failed to synchronize pending notifications: ${err.message}`);
  }
}
