import mongoose from 'mongoose';

export const RESULT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true }, // denormalized from student.department for fast dept-scoped queries
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    level: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true },
    gradePoint: { type: Number, required: true },
    status: { type: String, enum: Object.values(RESULT_STATUSES), default: RESULT_STATUSES.DRAFT },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: null },
    sourceType: { type: String, enum: ['manual', 'csv', 'excel', 'ocr'], default: 'manual' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadBatch', default: null },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, course: 1, session: 1, semester: 1 }, { unique: true });
resultSchema.index({ status: 1 });

export const Result = mongoose.model('Result', resultSchema);
