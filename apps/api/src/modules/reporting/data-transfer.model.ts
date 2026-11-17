import mongoose, { Schema } from 'mongoose';

export const DATA_TRANSFER_TYPES = [
  'students',
  'staff',
  'classes',
  'sections',
  'subjects',
  'attendance',
  'finance',
  'payments',
  'expenses',
  'payroll',
  'advances',
  'exams',
  'results',
  'admissions',
  'admission-inquiries',
  'organization',
  'audit',
] as const;
export type DataTransferType = (typeof DATA_TRANSFER_TYPES)[number];
export type DataTransferDirection = 'import' | 'export';
export type DataTransferFormat = 'xlsx' | 'csv' | 'pdf' | 'json';

const dataTransferHistorySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', default: null },
    actorId: { type: Schema.Types.ObjectId, ref: 'AuthUser', required: true },
    direction: { type: String, enum: ['import', 'export'], required: true },
    dataType: { type: String, enum: DATA_TRANSFER_TYPES, required: true },
    format: {
      type: String,
      enum: ['xlsx', 'csv', 'pdf', 'json'],
      required: true,
    },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    status: {
      type: String,
      enum: ['completed', 'partial', 'failed'],
      required: true,
    },
    totalRows: { type: Number, min: 0, max: 1000000, required: true },
    createdRows: {
      type: Number,
      min: 0,
      max: 1000000,
      required: true,
      default: 0,
    },
    skippedRows: {
      type: Number,
      min: 0,
      max: 1000000,
      required: true,
      default: 0,
    },
    failedRows: {
      type: Number,
      min: 0,
      max: 1000000,
      required: true,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

dataTransferHistorySchema.index(
  { organizationId: 1, createdAt: -1 },
  { name: 'data_transfer_history_by_organization' },
);
dataTransferHistorySchema.index(
  { organizationId: 1, campusId: 1, createdAt: -1 },
  { name: 'data_transfer_history_by_campus' },
);

export const DataTransferHistoryModel =
  mongoose.models.DataTransferHistory ??
  mongoose.model('DataTransferHistory', dataTransferHistorySchema);
