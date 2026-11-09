import mongoose, { Schema } from 'mongoose';

const promotionStudentSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true, trim: true },
    registrationNumber: { type: String, trim: true },
    sourceClassId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      required: true,
    },
    sourceSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSection',
      required: true,
    },
    targetClassId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      default: null,
    },
    targetSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSection',
      default: null,
    },
    feeStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'FeeStructure',
      default: null,
    },
    feeOverrideAmount: { type: Schema.Types.Decimal128, min: 0 },
    feeOverrideMode: { type: String, enum: ['custom', 'current'] },
    outcome: {
      type: String,
      enum: ['promoted', 'repeated', 'graduated'],
      required: true,
    },
  },
  { _id: false },
);

const promotionRunSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    sourceAcademicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    targetAcademicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    effectiveDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['completed'],
      default: 'completed',
      required: true,
    },
    promotedCount: { type: Number, min: 0, required: true },
    graduatedCount: { type: Number, min: 0, required: true },
    students: { type: [promotionStudentSchema], required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

promotionRunSchema.index({ organizationId: 1, campusId: 1, createdAt: -1 });
promotionRunSchema.index({
  organizationId: 1,
  sourceAcademicYearId: 1,
  targetAcademicYearId: 1,
});

export const PromotionRunModel =
  mongoose.models.PromotionRun ??
  mongoose.model('PromotionRun', promotionRunSchema);
