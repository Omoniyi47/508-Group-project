import { Result, RESULT_STATUSES } from '../models/Result.js';
import { GradingRule } from '../models/GradingRule.js';
import { ApiError } from '../utils/ApiError.js';
import { buildAcademicHistory } from './gpaEngine.js';

const POPULATE = ['course', 'session', 'semester', 'level'];

/**
 * Official documents must never omit an entered result or include a result
 * that has not passed the departmental approval workflow. Live previews remain
 * available for checking approved history, but approval/export is blocked until
 * every stored result for the student is approved.
 */
export async function assertTranscriptReadyForOfficialIssue(studentId) {
  const [totalResults, unapprovedResults] = await Promise.all([
    Result.countDocuments({ student: studentId }),
    Result.countDocuments({ student: studentId, status: { $ne: RESULT_STATUSES.APPROVED } }),
  ]);

  if (totalResults === 0) {
    throw ApiError.conflict('An official transcript cannot be issued because this student has no result records yet.');
  }
  if (unapprovedResults > 0) {
    throw ApiError.conflict(
      `An official transcript cannot be issued until all results are approved. ${unapprovedResults} result${unapprovedResults === 1 ? '' : 's'} still require action.`
    );
  }
}

/**
 * Computes a student's live academic history from every APPROVED result on file.
 * This is what powers the on-screen preview; an approved TranscriptRequest instead
 * freezes this same shape into `snapshotData` so later result corrections don't
 * retroactively change an already-issued transcript.
 */
export async function computeStudentTranscript(studentId) {
  const gradingRule = await GradingRule.findOne({ isActive: true });
  if (!gradingRule) {
    throw ApiError.conflict('No active grading rule is configured. Ask an administrator to activate one.');
  }

  let query = Result.find({ student: studentId, status: RESULT_STATUSES.APPROVED });
  for (const p of POPULATE) query = query.populate(p);
  const results = await query;

  const plainResults = results.map((r) => ({
    session: r.session,
    semester: r.semester,
    level: r.level,
    course: r.course,
    score: r.score,
    grade: r.grade,
    gradePoint: r.gradePoint,
  }));

  return buildAcademicHistory(plainResults, gradingRule);
}
