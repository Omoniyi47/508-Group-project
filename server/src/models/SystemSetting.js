import mongoose from 'mongoose';
import { env } from '../config/env.js';

const systemSettingSchema = new mongoose.Schema(
  {
    institutionName: { type: String, default: env.systemSettings.institutionName, trim: true },
    institutionAddress: { type: String, default: env.systemSettings.institutionAddress, trim: true },
    registrarName: { type: String, default: env.systemSettings.registrarName, trim: true },
    registrarEmail: { type: String, default: env.systemSettings.registrarEmail, trim: true },
    registrarPhone: { type: String, default: env.systemSettings.registrarPhone, trim: true },
    transcriptFooterNote: {
      type: String,
      default: env.systemSettings.transcriptFooterNote,
      trim: true,
    },
    // Kept configurable instead of embedding institutional marks in source.
    // The administrator can leave these blank until the Registrar supplies
    // approved wording and seal details.
    officialTranscriptWatermarkText: { type: String, default: '', trim: true },
    officialTranscriptSealLabel: { type: String, default: '', trim: true },
    specialElectiveRequiredUnits: { type: Number, default: 12, min: 0, max: 60 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

systemSettingSchema.statics.getSingleton = async function getSingleton() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
