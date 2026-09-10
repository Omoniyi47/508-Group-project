import { Result, RESULT_STATUSES } from '../models/Result.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Session } from '../models/Session.js';
import { Semester } from '../models/Semester.js';
import { Level } from '../models/Level.js';
import { GradingRule } from '../models/GradingRule.js';
import { UploadBatch } from '../models/UploadBatch.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import { scoreToGrade } from '../services/gpaEngine.js';
import { parseUploadedFile, validateRows } from '../services/fileImportService.js';
import { extractResultRowsFromScan } from '../services/ocrService.js';
import { ROLES } from '../models/User.js';
import { NOTIFICATION_TYPES, notifyDepartmentHod, notifyUser } from '../services/notificationService.js';

const POPULATE = ['student', 'course', 'session', 'semester', 'level', 'enteredBy', 'approvedBy'];

async function getActiveGradingRule() {
  const rule = await GradingRule.findOne({ isActive: true });
  if (!rule) throw ApiError.conflict('No active grading rule is configured. Ask an administrator to activate one.');
  return rule;
}

function assertDepartmentAccess(req, departmentId) {
  if (req.departmentFilter && String(req.departmentFilter) !== String(departmentId)) {
    throw ApiError.forbidden('You do not have access to results outside your department');
  }
}

function assertCoursePlacement(course, { departmentId, semesterId, levelId }) {
  if (!course.isActive || !course.isUndergraduate) {
    throw ApiError.conflict('This course is not available for undergraduate result entry');
  }
  if (course.department && String(course.department) !== String(departmentId)) {
    throw ApiError.conflict('This course is not mapped to the selected student programme');
  }
  if (course.semester && String(course.semester) !== String(semesterId)) {
    throw ApiError.conflict('The selected course belongs to a different semester');
  }
  if (course.level && String(course.level) !== String(levelId)) {
    throw ApiError.conflict('The selected course belongs to a different level');
  }
}

export const listResults = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.departmentFilter) filter.department = req.departmentFilter;
  else if (req.query.department) filter.department = req.query.department;

  for (const field of ['student', 'course', 'session', 'semester', 'level', 'status']) {
    if (req.query[field]) filter[field] = req.query[field];
  }

  let query = Result.find(filter).sort('-createdAt').skip(skip).limit(limit);
  for (const p of POPULATE) query = query.populate(p);

  const [items, total] = await Promise.all([query, Result.countDocuments(filter)]);
  return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

export const gradeDistribution = asyncHandler(async (req, res) => {
  const filter = { status: RESULT_STATUSES.APPROVED };
  if (req.departmentFilter) filter.department = req.departmentFilter;
  else if (req.query.department) filter.department = req.query.department;

  const rows = await Result.aggregate([
    { $match: filter },
    { $group: { _id: '$grade', count: { $sum: 1 } } },
  ]);

  const countsByGrade = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const gradingRule = await GradingRule.findOne({ isActive: true });
  const orderedGrades = gradingRule ? gradingRule.gradeBands.map((b) => b.grade) : Object.keys(countsByGrade);

  const data = orderedGrades.map((grade) => ({ grade, count: countsByGrade[grade] || 0 }));
  return sendSuccess(res, { data });
});

export const getResultById = asyncHandler(async (req, res) => {
  let query = Result.findById(req.params.id);
  for (const p of POPULATE) query = query.populate(p);
  const result = await query;
  if (!result) throw ApiError.notFound('Result not found');
  assertDepartmentAccess(req, result.department);
  return sendSuccess(res, { data: result });
});

export const createResult = asyncHandler(async (req, res) => {
  const { student: studentId, course: courseId, session: sessionId, semester: semesterId, level: levelId, score } = req.body;

  const [student, course] = await Promise.all([Student.findById(studentId), Course.findById(courseId)]);
  if (!student) throw ApiError.notFound('Student not found');
  if (!course) throw ApiError.notFound('Course not found');
  assertDepartmentAccess(req, student.department);
  assertCoursePlacement(course, { departmentId: student.department, semesterId, levelId });

  const existingAttempt = await Result.findOne({ student: student._id, course: course._id, session: sessionId, semester: semesterId });
  if (existingAttempt) {
    throw ApiError.conflict(`A ${existingAttempt.status} result already exists for this student, course, session, and semester.`);
  }

  const gradingRule = await getActiveGradingRule();
  const { grade, point } = scoreToGrade(score, gradingRule);

  const result = await Result.create({
    student: student._id,
    department: student.department,
    course: courseId,
    session: sessionId,
    semester: semesterId,
    level: levelId,
    score,
    grade,
    gradePoint: point,
    enteredBy: req.user._id,
    sourceType: 'manual',
  });

  await recordAudit(req, {
    action: AUDIT_ACTIONS.CREATE,
    module: 'Result',
    entityId: result._id,
    entityModel: 'Result',
    newValue: result.toObject(),
  });

  return sendSuccess(res, { statusCode: 201, message: 'Result saved as draft', data: result });
});

export const getEntrySafeguards = asyncHandler(async (req, res) => {
  const { student: studentId, session: sessionId, semester: semesterId, level: levelId, course: courseId } = req.query;
  if (!studentId || !sessionId || !semesterId || !levelId) {
    throw ApiError.badRequest('Student, session, semester, and level are required for result-entry checks');
  }
  const student = await Student.findById(studentId);
  if (!student) throw ApiError.notFound('Student not found');
  assertDepartmentAccess(req, student.department);

  const placementFilter = {
    isActive: true,
    isUndergraduate: true,
    $and: [
      { $or: [{ department: student.department }, { department: null }] },
      { $or: [{ level: levelId }, { level: null }] },
      { $or: [{ semester: semesterId }, { semester: null }] },
    ],
  };
  const [mappedCourses, existingResults] = await Promise.all([
    Course.find(placementFilter, 'code title creditUnit courseType').sort('code'),
    Result.find({ student: student._id, session: sessionId, semester: semesterId, level: levelId }).populate('course', 'code title'),
  ]);
  const enteredCourseIds = new Set(existingResults.map((result) => String(result.course?._id || result.course)));
  const coreCourses = mappedCourses.filter((course) => course.courseType === 'core');
  const missingCoreCourses = coreCourses.filter((course) => !enteredCourseIds.has(String(course._id)));
  const selectedAttempt = courseId ? existingResults.find((result) => String(result.course?._id || result.course) === String(courseId)) : null;

  return sendSuccess(res, {
    data: {
      mappedCourseCount: mappedCourses.length,
      enteredCourseCount: existingResults.length,
      missingCoreCourses: missingCoreCourses.map((course) => ({ _id: course._id, code: course.code, title: course.title, creditUnit: course.creditUnit })),
      incompleteSemester: missingCoreCourses.length > 0,
      duplicateAttempt: selectedAttempt
        ? { resultId: selectedAttempt._id, status: selectedAttempt.status, course: selectedAttempt.course }
        : null,
    },
  });
});

export const updateResult = asyncHandler(async (req, res) => {
  const existing = await Result.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Result not found');
  assertDepartmentAccess(req, existing.department);

  if (![RESULT_STATUSES.DRAFT, RESULT_STATUSES.REJECTED].includes(existing.status)) {
    throw ApiError.conflict('Only draft or rejected results can be edited');
  }

  const gradingRule = await getActiveGradingRule();
  const { grade, point } = scoreToGrade(req.body.score, gradingRule);

  const oldValue = existing.toObject();
  existing.score = req.body.score;
  existing.grade = grade;
  existing.gradePoint = point;
  if (existing.status === RESULT_STATUSES.REJECTED) {
    existing.status = RESULT_STATUSES.DRAFT;
    existing.rejectionReason = null;
  }
  await existing.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.UPDATE,
    module: 'Result',
    entityId: existing._id,
    entityModel: 'Result',
    oldValue,
    newValue: existing.toObject(),
  });

  return sendSuccess(res, { message: 'Result updated', data: existing });
});

export const deleteResult = asyncHandler(async (req, res) => {
  const existing = await Result.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Result not found');
  assertDepartmentAccess(req, existing.department);

  if (existing.status !== RESULT_STATUSES.DRAFT && req.user.role !== ROLES.ADMIN) {
    throw ApiError.conflict('Only draft results can be deleted');
  }

  await existing.deleteOne();
  await recordAudit(req, {
    action: AUDIT_ACTIONS.DELETE,
    module: 'Result',
    entityId: existing._id,
    entityModel: 'Result',
    oldValue: existing.toObject(),
  });

  return sendSuccess(res, { message: 'Result deleted' });
});

async function submitOne(req, id) {
  const result = await Result.findById(id);
  if (!result) throw ApiError.notFound(`Result ${id} not found`);
  assertDepartmentAccess(req, result.department);
  if (![RESULT_STATUSES.DRAFT, RESULT_STATUSES.REJECTED].includes(result.status)) {
    throw ApiError.conflict(`Result for this entry is already ${result.status} and cannot be resubmitted`);
  }
  result.status = RESULT_STATUSES.SUBMITTED;
  result.rejectionReason = null;
  await result.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.SUBMIT,
    module: 'Result',
    entityId: result._id,
    entityModel: 'Result',
    newValue: { status: result.status },
  });
  await notifyDepartmentHod(result.department, {
    type: NOTIFICATION_TYPES.RESULT_SUBMITTED,
    title: 'Result awaiting approval',
    message: 'A result has been submitted and needs your departmental review.',
    link: '/results?status=submitted',
  });
  return result;
}

export const submitResult = asyncHandler(async (req, res) => {
  const result = await submitOne(req, req.params.id);
  return sendSuccess(res, { message: 'Result submitted for approval', data: result });
});

export const submitResultBatch = asyncHandler(async (req, res) => {
  const results = [];
  const errors = [];
  for (const id of req.body.ids) {
    try {
      results.push(await submitOne(req, id));
    } catch (err) {
      errors.push({ id, message: err.message });
    }
  }
  return sendSuccess(res, {
    message: `Submitted ${results.length} of ${req.body.ids.length} result(s)`,
    data: { submitted: results.map((r) => r._id), errors },
  });
});

export const approveResult = asyncHandler(async (req, res) => {
  const result = await Result.findById(req.params.id);
  if (!result) throw ApiError.notFound('Result not found');
  assertDepartmentAccess(req, result.department);
  if (result.status !== RESULT_STATUSES.SUBMITTED) {
    throw ApiError.conflict('Only submitted results can be approved');
  }

  result.status = RESULT_STATUSES.APPROVED;
  result.approvedBy = req.user._id;
  await result.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.APPROVE,
    module: 'Result',
    entityId: result._id,
    entityModel: 'Result',
    newValue: { status: result.status },
  });
  await notifyUser(result.enteredBy, {
    type: NOTIFICATION_TYPES.RESULT_APPROVED,
    title: 'Result approved',
    message: 'A result you entered has been approved and is now included in official calculations.',
    link: '/results?status=approved',
  });

  return sendSuccess(res, { message: 'Result approved', data: result });
});

export const rejectResult = asyncHandler(async (req, res) => {
  const result = await Result.findById(req.params.id);
  if (!result) throw ApiError.notFound('Result not found');
  assertDepartmentAccess(req, result.department);
  if (result.status !== RESULT_STATUSES.SUBMITTED) {
    throw ApiError.conflict('Only submitted results can be rejected');
  }

  result.status = RESULT_STATUSES.REJECTED;
  result.rejectionReason = req.body.reason;
  await result.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.REJECT,
    module: 'Result',
    entityId: result._id,
    entityModel: 'Result',
    newValue: { status: result.status },
    reason: req.body.reason,
  });
  await notifyUser(result.enteredBy, {
    type: NOTIFICATION_TYPES.RESULT_REJECTED,
    title: 'Result needs correction',
    message: `A submitted result was rejected: ${req.body.reason}`,
    link: '/results?status=rejected',
  });

  return sendSuccess(res, { message: 'Result rejected', data: result });
});

async function loadUploadContext(body) {
  const [course, session, semester, level] = await Promise.all([
    Course.findById(body.course),
    Session.findById(body.session),
    Semester.findById(body.semester),
    Level.findById(body.level),
  ]);
  if (!course) throw ApiError.notFound('Course not found');
  if (!session) throw ApiError.notFound('Session not found');
  if (!semester) throw ApiError.notFound('Semester not found');
  if (!level) throw ApiError.notFound('Level not found');
  return { course, session, semester, level };
}

export const previewUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A CSV or Excel file is required');

  const { course, session, semester, level } = await loadUploadContext(req.body);
  if (req.departmentFilter) {
    assertCoursePlacement(course, { departmentId: req.departmentFilter, semesterId: semester._id, levelId: level._id });
  }

  const rawRows = await parseUploadedFile(req.file.buffer, req.file.originalname);
  if (rawRows.length === 0) {
    throw ApiError.badRequest('The uploaded file has no data rows');
  }

  const { rows, summary } = await validateRows(rawRows, {
    course,
    session,
    semester,
    departmentId: req.departmentFilter,
  });

  const batch = await UploadBatch.create({
    uploadedBy: req.user._id,
    department: req.departmentFilter || course.department,
    fileName: req.file.originalname,
    course: course._id,
    session: session._id,
    semester: semester._id,
    level: level._id,
    status: 'previewed',
    rows,
    summary,
  });

  return sendSuccess(res, { statusCode: 201, message: 'File parsed and validated', data: batch });
});

/**
 * OCR is intentionally a preview-only path. The provider's output is passed
 * through exactly the same student, duplicate and score validation as a CSV,
 * then staff must review/correct it and explicitly confirm the draft batch.
 */
export const previewOcrUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A scanned PDF or image is required');

  const { course, session, semester, level } = await loadUploadContext(req.body);
  if (req.departmentFilter) {
    assertCoursePlacement(course, { departmentId: req.departmentFilter, semesterId: semester._id, levelId: level._id });
  }

  const ocr = await extractResultRowsFromScan(req.file);
  const { rows, summary } = await validateRows(ocr.rows, {
    course,
    session,
    semester,
    departmentId: req.departmentFilter,
  });
  const batch = await UploadBatch.create({
    uploadedBy: req.user._id,
    department: req.departmentFilter || course.department,
    fileName: req.file.originalname,
    sourceType: 'ocr',
    ocr: {
      provider: ocr.provider,
      pageCount: ocr.pageCount,
      tableCount: ocr.tableCount,
      averageConfidence: ocr.averageConfidence,
    },
    course: course._id,
    session: session._id,
    semester: semester._id,
    level: level._id,
    status: 'previewed',
    rows,
    summary,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Scan read and validated. Review every OCR row before saving.',
    data: batch,
  });
});

export const updateOcrBatchRow = asyncHandler(async (req, res) => {
  const batch = await UploadBatch.findById(req.params.id).populate('course session semester');
  if (!batch) throw ApiError.notFound('Upload batch not found');
  if (batch.sourceType !== 'ocr') throw ApiError.conflict('Only OCR preview rows can be corrected here');
  if (batch.status !== 'previewed') throw ApiError.conflict('This OCR batch has already been processed');
  assertDepartmentAccess(req, batch.department || batch.course?.department);

  const rowNumber = Number(req.params.rowNumber);
  const rowIndex = batch.rows.findIndex((row) => row.rowNumber === rowNumber);
  if (rowIndex < 0) throw ApiError.notFound('OCR row not found');

  const rawRows = batch.rows.map((row, index) => ({
    matric: index === rowIndex && req.body.matricNumber !== undefined ? req.body.matricNumber : row.matricNumber,
    score: index === rowIndex && req.body.score !== undefined ? req.body.score : row.score,
    name: row.extractedName || undefined,
    ocrConfidence: row.ocrConfidence,
  }));
  const { rows, summary } = await validateRows(rawRows, {
    course: batch.course,
    session: batch.session,
    semester: batch.semester,
    departmentId: req.departmentFilter,
  });

  const oldRow = batch.rows[rowIndex].toObject();
  batch.rows = rows;
  batch.summary = summary;
  await batch.save();
  await recordAudit(req, {
    action: AUDIT_ACTIONS.UPDATE,
    module: 'UploadBatch',
    entityId: batch._id,
    entityModel: 'UploadBatch',
    oldValue: oldRow,
    newValue: batch.rows[rowIndex].toObject(),
    reason: 'OCR extraction correction before result import',
  });

  return sendSuccess(res, { message: 'OCR row corrected and revalidated', data: batch });
});

export const getUploadBatch = asyncHandler(async (req, res) => {
  const batch = await UploadBatch.findById(req.params.id).populate('course session semester level uploadedBy');
  if (!batch) throw ApiError.notFound('Upload batch not found');
  assertDepartmentAccess(req, batch.department || batch.course?.department);
  return sendSuccess(res, { data: batch });
});

export const listUploadBatches = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.departmentFilter) filter.department = req.departmentFilter;

  const batches = await UploadBatch.find(filter)
    .sort('-createdAt')
    .skip(skip)
    .limit(limit)
    .populate('course session semester level uploadedBy');
  const total = await UploadBatch.countDocuments(filter);
  return sendSuccess(res, { data: batches, meta: buildMeta({ page, limit, total }) });
});

export const confirmUpload = asyncHandler(async (req, res) => {
  const batch = await UploadBatch.findById(req.params.id).populate('course session semester');
  if (!batch) throw ApiError.notFound('Upload batch not found');
  if (batch.status !== 'previewed') throw ApiError.conflict('This batch has already been processed');

  const course = await Course.findById(batch.course._id);
  if (!course) throw ApiError.notFound('Course not found');
  assertDepartmentAccess(req, batch.department || course.department);

  // re-validate against current DB state in case data changed since the preview was generated
  const rawRows = batch.rows.map((r) => ({ matric: r.matricNumber, score: r.score }));
  const { rows: freshRows } = await validateRows(rawRows, {
    course: batch.course,
    session: batch.session,
    semester: batch.semester,
    departmentId: req.departmentFilter,
  });

  const gradingRule = await getActiveGradingRule();
  let created = 0;
  let updated = 0;
  const skipped = [];

  for (const row of freshRows) {
    if (row.status === 'error') {
      skipped.push({ matricNumber: row.matricNumber, messages: row.messages });
      continue;
    }

    const { grade, point } = scoreToGrade(row.score, gradingRule);
    const existing = await Result.findOne({
      student: row.studentId,
      course: batch.course._id,
      session: batch.session._id,
      semester: batch.semester._id,
    });

    if (existing) {
      // validateRows only permits draft/rejected records. Keep the controller
      // defensive as well, so a concurrent approval cannot be overwritten.
      if (![RESULT_STATUSES.DRAFT, RESULT_STATUSES.REJECTED].includes(existing.status)) {
        skipped.push({ matricNumber: row.matricNumber, messages: [`An existing ${existing.status} result cannot be overwritten`] });
        continue;
      }
      const oldValue = existing.toObject();
      existing.score = row.score;
      existing.grade = grade;
      existing.gradePoint = point;
      existing.status = RESULT_STATUSES.SUBMITTED;
      existing.rejectionReason = null;
      existing.sourceType = batch.sourceType === 'ocr' ? 'ocr' : 'csv';
      existing.batchId = batch._id;
      await existing.save();
      await recordAudit(req, {
        action: AUDIT_ACTIONS.UPDATE,
        module: 'Result',
        entityId: existing._id,
        entityModel: 'Result',
        oldValue,
        newValue: existing.toObject(),
      reason: `${batch.sourceType === 'ocr' ? 'OCR-assisted' : 'Bulk'} import ${batch.fileName}`,
      });
      updated += 1;
    } else {
      const student = await Student.findById(row.studentId);
      if (!student) {
        skipped.push({ matricNumber: row.matricNumber, messages: ['Student record is no longer available'] });
        continue;
      }
      const createdResult = await Result.create({
        student: row.studentId,
        department: student.department,
        course: batch.course._id,
        session: batch.session._id,
        semester: batch.semester._id,
        level: batch.level,
        score: row.score,
        grade,
        gradePoint: point,
        enteredBy: req.user._id,
        status: RESULT_STATUSES.SUBMITTED,
        sourceType: batch.sourceType === 'ocr' ? 'ocr' : 'csv',
        batchId: batch._id,
      });
      await recordAudit(req, {
        action: AUDIT_ACTIONS.CREATE,
        module: 'Result',
        entityId: createdResult._id,
        entityModel: 'Result',
        newValue: createdResult.toObject(),
        reason: `${batch.sourceType === 'ocr' ? 'OCR-assisted' : 'Bulk'} import ${batch.fileName}`,
      });
      created += 1;
    }
  }

  batch.status = 'committed';
  batch.committedAt = new Date();
  await batch.save();

  await recordAudit(req, {
    action: AUDIT_ACTIONS.IMPORT_COMMIT,
    module: 'UploadBatch',
    entityId: batch._id,
    entityModel: 'UploadBatch',
    newValue: { created, updated, skipped: skipped.length },
  });
  if (created + updated > 0) {
    await notifyDepartmentHod(batch.department, {
      type: NOTIFICATION_TYPES.RESULT_SUBMITTED,
      title: 'Bulk results awaiting approval',
      message: `${created + updated} result${created + updated === 1 ? '' : 's'} from ${batch.fileName} need departmental review.`,
      link: '/results?status=submitted',
    });
  }

  return sendSuccess(res, {
    message: `Import complete: ${created} created, ${updated} updated, ${skipped.length} skipped`,
    data: { created, updated, skipped },
  });
});

export const resultController = {
  listResults,
  getEntrySafeguards,
  gradeDistribution,
  getResultById,
  createResult,
  updateResult,
  deleteResult,
  submitResult,
  submitResultBatch,
  approveResult,
  rejectResult,
  previewUpload,
  previewOcrUpload,
  updateOcrBatchRow,
  confirmUpload,
  getUploadBatch,
  listUploadBatches,
};
