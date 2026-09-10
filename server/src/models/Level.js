import mongoose from 'mongoose';

const levelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    order: { type: Number, required: true, unique: true },
  },
  { timestamps: true }
);

export const Level = mongoose.model('Level', levelSchema);
