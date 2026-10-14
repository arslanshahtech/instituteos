import mongoose, { Schema } from 'mongoose';
import type { InvoiceStatus, PaymentMethod } from './finance.types.js';

const feeHeadSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Schema.Types.Decimal128, required: true, min: 0 },
    isOptional: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const feeStructureSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
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
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    feeHeads: {
      type: [feeHeadSchema],
      required: true,
      validate: {
        validator: (heads: unknown[]) => heads.length > 0,
        message: 'At least one fee head is required.',
      },
    },
  },
  { timestamps: true, versionKey: false },
);
feeStructureSchema.index(
  { organizationId: 1, campusId: 1, academicYearId: 1, classId: 1, name: 1 },
  { unique: true, name: 'uniq_fee_structure_name_per_class_year' },
);

const studentInvoiceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    invoiceNumber: { type: String, required: true, trim: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    feeStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'FeeStructure',
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      required: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    billingCycle: { type: String, required: true, trim: true, maxlength: 60 },
    dueDate: { type: Date, required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true, min: 0 },
    currentAmount: { type: Schema.Types.Decimal128, default: '0.00', min: 0 },
    discountAmount: { type: Schema.Types.Decimal128, default: '0.00', min: 0 },
    discountReason: { type: String, trim: true, maxlength: 120 },
    arrearsAmount: { type: Schema.Types.Decimal128, default: '0.00', min: 0 },
    paidAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: '0.00',
      min: 0,
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue'] satisfies InvoiceStatus[],
      required: true,
      default: 'unpaid',
    },
    issueDate: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);
studentInvoiceSchema.index(
  { organizationId: 1, invoiceNumber: 1 },
  { unique: true, name: 'uniq_invoice_number_per_organization' },
);
studentInvoiceSchema.index(
  {
    organizationId: 1,
    studentId: 1,
    feeStructureId: 1,
    billingCycle: 1,
  },
  { unique: true, name: 'uniq_student_invoice_per_billing_cycle' },
);
studentInvoiceSchema.index({
  organizationId: 1,
  campusId: 1,
  classId: 1,
  issueDate: -1,
});

const paymentReceiptSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    receiptNumber: { type: String, required: true, trim: true },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'StudentInvoice',
      required: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    amountPaid: { type: Schema.Types.Decimal128, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: [
        'cash',
        'bank_transfer',
        'card',
        'online',
      ] satisfies PaymentMethod[],
      required: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    paymentDate: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
paymentReceiptSchema.index(
  { organizationId: 1, receiptNumber: 1 },
  { unique: true, name: 'uniq_receipt_number_per_organization' },
);
paymentReceiptSchema.index({ organizationId: 1, invoiceId: 1, paymentDate: 1 });

const feeConcessionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
    },
    concessionType: {
      type: String,
      enum: ['sibling', 'staff_child', 'scholarship', 'need_based', 'special'],
      required: true,
      default: 'special',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
      default: 'fixed',
    },
    discountValue: {
      type: Schema.Types.Decimal128,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

feeConcessionSchema.index(
  { organizationId: 1, studentId: 1, isActive: 1 },
  { name: 'idx_student_active_concessions' },
);

export const FeeStructureModel =
  mongoose.models.FeeStructure ??
  mongoose.model('FeeStructure', feeStructureSchema);
export const StudentInvoiceModel =
  mongoose.models.StudentInvoice ??
  mongoose.model('StudentInvoice', studentInvoiceSchema);
export const PaymentReceiptModel =
  mongoose.models.PaymentReceipt ??
  mongoose.model('PaymentReceipt', paymentReceiptSchema);
export const FeeConcessionModel =
  mongoose.models.FeeConcession ??
  mongoose.model('FeeConcession', feeConcessionSchema);
