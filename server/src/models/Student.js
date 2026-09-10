import mongoose from 'mongoose';

export const STUDENT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  GRADUATED: 'graduated',
  WITHDRAWN: 'withdrawn',
  SUSPENDED: 'suspended',
});

const studentSchema = new mongoose.Schema(
  {
    matricNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    regNumber: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    otherNames: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
    dateOfBirth: { type: Date, default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    entrySession: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    currentLevel: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
    graduationSession: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    status: { type: String, enum: Object.values(STUDENT_STATUSES), default: STUDENT_STATUSES.ACTIVE },
    contactEmail: { type: String, trim: true, lowercase: true, default: null },
    contactPhone: { type: String, trim: true, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

studentSchema.index({ department: 1, status: 1 });
studentSchema.index({ firstName: 1, lastName: 1 });

studentSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.otherNames, this.lastName].filter(Boolean).join(' ');
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

export const Student = mongoose.model('Student', studentSchema);
