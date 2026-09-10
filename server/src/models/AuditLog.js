import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: { type: String, default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    entityModel: { type: String, default: null },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const IMMUTABLE_ERROR = 'Audit log entries are immutable and cannot be modified or removed';

for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany', 'findOneAndRemove']) {
  auditLogSchema.pre(op, function blockMutation() {
    throw new Error(IMMUTABLE_ERROR);
  });
}

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
