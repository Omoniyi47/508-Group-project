import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, match: [/^\d{4}\/\d{4}$/, 'Session name must be in the form YYYY/YYYY'] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sessionSchema.pre('save', async function unsetOtherCurrentSessions() {
  if (this.isCurrent && this.isModified('isCurrent')) {
    await this.constructor.updateMany({ _id: { $ne: this._id } }, { isCurrent: false });
  }
});

export const Session = mongoose.model('Session', sessionSchema);
