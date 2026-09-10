import mongoose from 'mongoose';

const gradeBandSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true, uppercase: true },
    minScore: { type: Number, required: true, min: 0, max: 100 },
    maxScore: { type: Number, required: true, min: 0, max: 100 },
    point: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const classificationBandSchema = new mongoose.Schema(
  {
    classification: { type: String, required: true, trim: true },
    minCgpa: { type: Number, required: true, min: 0 },
    maxCgpa: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const gradingRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
    gradeBands: {
      type: [gradeBandSchema],
      required: true,
      validate: {
        validator: (bands) => bands.length > 0,
        message: 'At least one grade band is required',
      },
    },
    classificationBands: {
      type: [classificationBandSchema],
      required: true,
      validate: {
        validator: (bands) => bands.length > 0,
        message: 'At least one classification band is required',
      },
    },
  },
  { timestamps: true }
);

function findOverlapError(bands, minKey, maxKey, label) {
  const sorted = [...bands].sort((a, b) => a[minKey] - b[minKey]);
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    if (band[minKey] > band[maxKey]) {
      return `${label} band "${band.grade || band.classification}" has minimum greater than maximum`;
    }
    const nextBand = sorted[i + 1];
    if (nextBand && band[maxKey] >= nextBand[minKey]) {
      return `${label} bands overlap between "${band.grade || band.classification}" and "${nextBand.grade || nextBand.classification}"`;
    }
  }
  return null;
}

// Grade bands (unlike classification bands) must fully cover every whole-number score
// from 0-100 with no gaps, otherwise a legitimately entered score could fall into a gap
// and have no grade at all.
function findGradeCoverageGapError(bands) {
  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  if (sorted[0].minScore > 0) {
    return `Grade bands must start at 0 (lowest band "${sorted[0].grade}" starts at ${sorted[0].minScore})`;
  }
  const last = sorted[sorted.length - 1];
  if (last.maxScore < 100) {
    return `Grade bands must end at 100 (highest band "${last.grade}" ends at ${last.maxScore})`;
  }
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const band = sorted[i];
    const nextBand = sorted[i + 1];
    if (nextBand.minScore > band.maxScore + 1) {
      return `Grade bands have a gap between "${band.grade}" (ends at ${band.maxScore}) and "${nextBand.grade}" (starts at ${nextBand.minScore})`;
    }
  }
  return null;
}

gradingRuleSchema.pre('validate', function checkBands() {
  const gradeError = findOverlapError(this.gradeBands, 'minScore', 'maxScore', 'Grade');
  if (gradeError) this.invalidate('gradeBands', gradeError);
  else {
    const coverageError = findGradeCoverageGapError(this.gradeBands);
    if (coverageError) this.invalidate('gradeBands', coverageError);
  }

  const classificationError = findOverlapError(this.classificationBands, 'minCgpa', 'maxCgpa', 'Classification');
  if (classificationError) this.invalidate('classificationBands', classificationError);
});

gradingRuleSchema.pre('save', async function unsetOtherActiveRules() {
  if (this.isActive && this.isModified('isActive')) {
    await this.constructor.updateMany({ _id: { $ne: this._id } }, { isActive: false });
  }
});

export const GradingRule = mongoose.model('GradingRule', gradingRuleSchema);
