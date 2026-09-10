import mongoose from 'mongoose';

const rowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, required: true },
    matricNumber: { type: String, required: true },
    score: { type: mongoose.Schema.Types.Mixed, default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    studentName: { type: String, default: null },
    extractedName: { type: String, default: null },
    ocrConfidence: { type: Number, default: null, min: 0, max: 100 },
    status: { type: String, enum: ['valid', 'error', 'warning'], required: true },
    messages: { type: [String], default: [] },
  },
  { _id: false }
);

const uploadBatchSchema = new mongoose.Schema(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Captured when the preview is created so department-scoped staff can never
    // enumerate another department's import history.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    fileName: { type: String, required: true },
    sourceType: { type: String, enum: ['spreadsheet', 'ocr'], default: 'spreadsheet' },
    ocr: {
      provider: { type: String, default: null },
      pageCount: { type: Number, default: null },
      tableCount: { type: Number, default: null },
      averageConfidence: { type: Number, default: null },
    },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    level: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
    status: { type: String, enum: ['previewed', 'committed', 'failed'], default: 'previewed' },
    rows: { type: [rowSchema], default: [] },
    summary: {
      total: { type: Number, default: 0 },
      validCount: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
    },
    committedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const UploadBatch = mongoose.model('UploadBatch', uploadBatchSchema);
