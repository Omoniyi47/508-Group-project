import mongoose from 'mongoose';

const transcriptFileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: false }
);

const transcriptDocumentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true }, // denormalized from student.department for fast dept-scoped queries
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    files: {
      type: [transcriptFileSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0 && value.length <= 5,
        message: 'A transcript scan must have between 1 and 5 files',
      },
    },
  },
  { timestamps: true }
);

transcriptDocumentSchema.index({ student: 1, createdAt: -1 });
transcriptDocumentSchema.index({ department: 1 });

transcriptDocumentSchema.set('toJSON', {
  transform(doc, ret) {
    if (Array.isArray(ret.files)) {
      ret.files = ret.files.map((file) => ({
        _id: file._id,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      }));
    }
    return ret;
  },
});

export const TranscriptDocument = mongoose.model('TranscriptDocument', transcriptDocumentSchema);
