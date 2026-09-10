import mongoose from 'mongoose';

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    order: { type: Number, required: true, unique: true },
  },
  { timestamps: true }
);

export const Semester = mongoose.model('Semester', semesterSchema);
