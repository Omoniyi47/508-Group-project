import mongoose from 'mongoose';

const backupSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    errorMessage: { type: String, default: null },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Backup = mongoose.model('Backup', backupSchema);
