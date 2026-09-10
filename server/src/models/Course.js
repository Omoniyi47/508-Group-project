import mongoose from 'mongoose';

export const COURSE_TYPES = Object.freeze({
  CORE: 'core',
  ELECTIVE: 'elective',
  RESTRICTED_ELECTIVE: 'restricted_elective',
  SPECIAL_ELECTIVE: 'special_elective',
  PRACTICUM: 'practicum',
  INDUSTRIAL_TRAINING: 'industrial_training',
  PROJECT: 'project',
  OTHER: 'other',
});

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    codePrefix: { type: String, required: true, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true },
    // Some verified professional curricula use half-credit courses (for
    // example, 1.5 units). Store them precisely rather than rounding them.
    creditUnit: { type: Number, required: true, min: 0, max: 10 },
    // The student's programme department. This drives result-officer access and
    // makes cross-department courses appear in the correct curriculum.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    // The academic unit that teaches the course. It can differ from the student's
    // programme department for shared, faculty-wide, and service courses.
    offeringDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    offeringUnit: { type: String, trim: true, default: '' },
    level: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', default: null },
    // A reference-only course can be known before Registry confirms its
    // placement. Such records stay inactive until a semester is supplied.
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', default: null },
    curriculumContext: { type: String, trim: true, default: '' },
    curriculumVersion: { type: String, trim: true, default: '' },
    titleAliases: [{ type: String, trim: true }],
    courseType: { type: String, enum: Object.values(COURSE_TYPES), default: COURSE_TYPES.CORE, index: true },
    isElective: { type: Boolean, default: false },
    isUndergraduate: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseSchema.index({ department: 1, level: 1, semester: 1 });
courseSchema.index({ code: 1, department: 1, level: 1, semester: 1, curriculumContext: 1, curriculumVersion: 1 }, { unique: true });

courseSchema.pre('validate', function setCodePrefix() {
  const match = String(this.code || '').trim().toUpperCase().match(/^[A-Z]+/);
  this.codePrefix = match ? match[0] : '';
  this.isElective = [COURSE_TYPES.ELECTIVE, COURSE_TYPES.RESTRICTED_ELECTIVE, COURSE_TYPES.SPECIAL_ELECTIVE].includes(this.courseType);
});

export const Course = mongoose.model('Course', courseSchema);
