import mongoose, { Schema } from 'mongoose';

export const HOMEWORK_TEST_TYPES = ['homework', 'test'] as const;
export const HOMEWORK_TEST_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

const homeworkTestSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
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
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    instructions: { type: String, trim: true, maxlength: 5000, default: '' },
    type: { type: String, enum: HOMEWORK_TEST_TYPES, required: true },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, min: 0, max: 100000 },
    status: {
      type: String,
      enum: HOMEWORK_TEST_STATUSES,
      default: 'published',
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AuthUser', required: true },
  },
  { timestamps: true, versionKey: false },
);

homeworkTestSchema.index(
  {
    organizationId: 1,
    academicYearId: 1,
    classId: 1,
    sectionId: 1,
    type: 1,
    dueDate: -1,
  },
  { name: 'homework_test_org_class_due' },
);

export const HomeworkTestModel =
  mongoose.models.HomeworkTest ??
  mongoose.model('HomeworkTest', homeworkTestSchema);
