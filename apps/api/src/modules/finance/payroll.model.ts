import mongoose, { Schema } from 'mongoose';

const payrollSalaryHistorySchema = new Schema(
  {
    monthlySalary: { type: Schema.Types.Decimal128, required: true, min: 0.01 },
    effectiveFrom: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const payrollSalaryProfileSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', default: null },
    monthlySalary: { type: Schema.Types.Decimal128, required: true, min: 0.01 },
    effectiveFrom: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    salaryHistory: { type: [payrollSalaryHistorySchema], default: [] },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
payrollSalaryProfileSchema.index(
  { organizationId: 1, staffId: 1 },
  { unique: true },
);

const payrollMonthSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', default: null },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    staffName: { type: String, required: true, trim: true },
    employeeCode: { type: String, trim: true },
    grossSalary: { type: Schema.Types.Decimal128, required: true, min: 0 },
    advanceAdjusted: { type: Schema.Types.Decimal128, default: '0.00', min: 0 },
    paidAmount: { type: Schema.Types.Decimal128, default: '0.00', min: 0 },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
    payments: [
      {
        amount: { type: Schema.Types.Decimal128, required: true, min: 0.01 },
        paymentMethod: {
          type: String,
          enum: ['cash', 'bank_transfer', 'card', 'online'],
          required: true,
        },
        paymentDate: { type: Date, required: true },
        reference: { type: String, trim: true, maxlength: 160 },
        recordedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      },
    ],
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
payrollMonthSchema.index(
  { organizationId: 1, staffId: 1, month: 1 },
  { unique: true },
);

const payrollAdvanceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', default: null },
    staffName: { type: String, required: true, trim: true },
    amount: { type: Schema.Types.Decimal128, required: true, min: 0.01 },
    adjustedAmount: { type: Schema.Types.Decimal128, default: '0.00', min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'online'],
      required: true,
    },
    advanceDate: { type: Date, required: true },
    reference: { type: String, trim: true, maxlength: 160 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
payrollAdvanceSchema.index({ organizationId: 1, staffId: 1, advanceDate: -1 });

export const PayrollSalaryProfileModel =
  mongoose.models.PayrollSalaryProfile ??
  mongoose.model('PayrollSalaryProfile', payrollSalaryProfileSchema);
export const PayrollMonthModel =
  mongoose.models.PayrollMonth ??
  mongoose.model('PayrollMonth', payrollMonthSchema);
export const PayrollAdvanceModel =
  mongoose.models.PayrollAdvance ??
  mongoose.model('PayrollAdvance', payrollAdvanceSchema);
