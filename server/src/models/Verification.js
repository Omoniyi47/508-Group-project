import mongoose from 'mongoose';

export const VERIFICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  RESOLVED_MERGED: 'resolved_merged',
  RESOLVED_DISTINCT: 'resolved_distinct',
  RESOLVED_REJECTED: 'resolved_rejected',
});

const verificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['duplicate_student'], default: 'duplicate_student' },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    matchedStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 1 },
    status: { type: String, enum: Object.values(VERIFICATION_STATUSES), default: VERIFICATION_STATUSES.PENDING },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: null },
  },
  { timestamps: true }
);

verificationSchema.index({ status: 1 });

export const Verification = mongoose.model('Verification', verificationSchema);
