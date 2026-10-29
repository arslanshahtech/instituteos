import mongoose, { Schema } from 'mongoose';
import type { ExamType, GradeBreakdown } from './examinations.types.js';

const examSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ['midterm', 'final', 'quiz'] satisfies ExamType[],
      required: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    termId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicTerm',
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    resultsPublishedAt: { type: Date, default: null },
    resultsPublishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);
examSchema.index({ organizationId: 1, campusId: 1, academicYearId: 1 });

const examScheduleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      required: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSection',
      required: true,
    },
    date: { type: Date, required: true },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
    totalMarks: { type: Number, required: true, min: 0.01, max: 100000 },
    passingMarks: { type: Number, required: true, min: 0, max: 100000 },
  },
  { timestamps: true, versionKey: false },
);
examScheduleSchema.index(
  { organizationId: 1, examId: 1, classId: 1, sectionId: 1, subjectId: 1 },
  { unique: true, name: 'uniq_exam_section_subject_schedule' },
);

const gradeBreakdownSchema = new Schema<GradeBreakdown>(
  {
    grade: { type: String, required: true, trim: true, maxlength: 10 },
    minPercentage: { type: Number, required: true, min: 0, max: 100 },
    maxPercentage: { type: Number, required: true, min: 0, max: 100 },
    gpa: { type: Number, required: true, min: 0, max: 10 },
  },
  { _id: false },
);
const gradingScaleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    gradeBreakdowns: {
      type: [gradeBreakdownSchema],
      required: true,
      validate: {
        validator: (value: GradeBreakdown[]) => value.length > 0,
        message: 'At least one grade breakdown is required.',
      },
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);
gradingScaleSchema.index({ organizationId: 1, isActive: 1 });

const examMarkSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    examScheduleId: {
      type: Schema.Types.ObjectId,
      ref: 'ExamSchedule',
      required: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    marksObtained: { type: Number, min: 0, max: 100000 },
    isAbsent: { type: Boolean, required: true, default: false },
    remarks: { type: String, trim: true, maxlength: 500 },
    percentage: { type: Number, min: 0, max: 100, default: null },
    grade: { type: String, trim: true, maxlength: 10, default: null },
    gpa: { type: Number, min: 0, max: 10, default: null },
  },
  { timestamps: true, versionKey: false },
);
examMarkSchema.index(
  { organizationId: 1, examScheduleId: 1, studentId: 1 },
  { unique: true, name: 'uniq_exam_mark_per_student' },
);

export const ExamModel =
  mongoose.models.Exam ?? mongoose.model('Exam', examSchema);
export const ExamScheduleModel =
  mongoose.models.ExamSchedule ??
  mongoose.model('ExamSchedule', examScheduleSchema);
export const GradingScaleModel =
  mongoose.models.GradingScale ??
  mongoose.model('GradingScale', gradingScaleSchema);
export const ExamMarkModel =
  mongoose.models.ExamMark ?? mongoose.model('ExamMark', examMarkSchema);
