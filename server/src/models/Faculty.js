import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  },
  { timestamps: true }
);

export const Faculty = mongoose.model('Faculty', facultySchema);
