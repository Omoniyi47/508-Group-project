import mongoose from 'mongoose';

export const TRANSCRIPT_STATUSES = Object.freeze({
  REQUESTED: 'requested',
  VERIFIED: 'verified',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RELEASED: 'released',
});

const transcriptRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true }, // denormalized from student.department for HOD scoping
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, trim: true, default: null },
    status: { type: String, enum: Object.values(TRANSCRIPT_STATUSES), default: TRANSCRIPT_STATUSES.REQUESTED },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    snapshotData: { type: mongoose.Schema.Types.Mixed, default: null },
    issueSerial: { type: String, unique: true, sparse: true, trim: true },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transcriptRequestSchema.index({ student: 1, status: 1 });

export const TranscriptRequest = mongoose.model('TranscriptRequest', transcriptRequestSchema);
