import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  BulkInvoiceInput,
  FeeStructureInput,
  FinanceContext,
  FinanceRepository,
  InvoiceQuery,
  InvoiceStatus,
  PaymentInput,
  FeeConcessionInput,
  ConcessionType,
  DiscountType,
} from './finance.types.js';
import { StudentSectionPlacementModel } from '../attendance/attendance.model.js';
import { StudentModel } from '../people/people.model.js';

const paymentMethods = [
  'cash',
  'bank_transfer',
  'card',
  'online',
] as const;
const invoiceStatuses = ['unpaid', 'partial', 'paid', 'overdue'] as const;
const concessionTypes = ['sibling', 'staff_child', 'scholarship', 'need_based', 'special'] as const;
const discountTypes = ['percentage', 'fixed'] as const;

function objectId(value: string, field: string): string {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return value;
}

function validDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value;
}

function moneyCents(value: number, field: string): number {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9_999_999_999.99 ||
    Number(value.toFixed(2)) !== value
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Enter a valid ${field} amount with no more than two decimal places.`,
    );
  }
  return Math.round(value * 100);
}

function assertCampus(context: FinanceContext, campusId: string): void {
  if (
    (context.role === 'campus_admin' || context.campusIds.length > 0) &&
    !context.campusIds.includes(campusId)
  ) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
  }
}

function scopedCampusIds(context: FinanceContext): string[] | undefined {
  return context.campusIds.length || context.role === 'campus_admin'
    ? context.campusIds
    : undefined;
}

function structureInput(input: FeeStructureInput): FeeStructureInput {
  objectId(input.academicYearId, 'academic year');
  objectId(input.classId, 'class');
  objectId(input.campusId, 'campus');
  const name = input.name.trim();
  if (!name || name.length > 120 || !Array.isArray(input.feeHeads)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter a valid fee structure name and fee heads.',
    );
  }
  if (input.feeHeads.length < 1 || input.feeHeads.length > 40) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Add between 1 and 40 fee heads.',
    );
  }
  const seen = new Set<string>();
  const feeHeads = input.feeHeads.map((head) => {
    const title = head.title.trim();
    const normalizedTitle = title.toLocaleLowerCase();
    if (
      !title ||
      title.length > 100 ||
      seen.has(normalizedTitle) ||
      typeof head.isOptional !== 'boolean'
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Fee head titles must be unique and each head needs a required or optional setting.',
      );
    }
    seen.add(normalizedTitle);
    return {
      title,
      amount: moneyCents(head.amount, title) / 100,
      isOptional: head.isOptional,
    };
  });
  return {
    name,
    academicYearId: input.academicYearId,
    classId: input.classId,
    campusId: input.campusId,
    feeHeads,
  };
}

function normalizeCycle(value: string): string {
  const cycle = value.trim();
  if (!cycle || cycle.length > 60) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid billing cycle.');
  }
  return cycle;
}

function normalizeInvoiceQuery(query: InvoiceQuery): InvoiceQuery {
  if (query.campusId) objectId(query.campusId, 'campus');
  if (query.classId) objectId(query.classId, 'class');
  if (query.studentId) objectId(query.studentId, 'student');
  if (
    query.status &&
    !invoiceStatuses.includes(query.status as InvoiceStatus)
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid invoice status.');
  }
  const dateFrom = query.dateFrom
    ? validDate(query.dateFrom, 'start date')
    : undefined;
  const dateTo = query.dateTo ? validDate(query.dateTo, 'end date') : undefined;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Start date must not be after end date.',
    );
  }
  return { ...query, dateFrom, dateTo };
}

function validateConcessionInput(input: FeeConcessionInput): FeeConcessionInput {
  const studentId = objectId(input.studentId, 'student');
  const academicYearId = input.academicYearId ? objectId(input.academicYearId, 'academic year') : undefined;

  if (!concessionTypes.includes(input.concessionType as ConcessionType)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid concession type.');
  }

  if (!discountTypes.includes(input.discountType as DiscountType)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid discount type (percentage or fixed).');
  }

  if (input.discountType === 'percentage') {
    if (!Number.isFinite(input.discountValue) || input.discountValue <= 0 || input.discountValue > 100) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Percentage discount must be between 1 and 100.');
    }
  } else {
    moneyCents(input.discountValue, 'discount value');
  }

  return {
    studentId,
    academicYearId,
    concessionType: input.concessionType,
    discountType: input.discountType,
    discountValue: input.discountValue,
    reason: input.reason?.trim() ? input.reason.trim().slice(0, 160) : undefined,
    isActive: typeof input.isActive === 'boolean' ? input.isActive : true,
  };
}

export class FinanceService {
  constructor(private readonly repository: FinanceRepository) {}

  async listFeeStructures(context: FinanceContext) {
    return this.repository.listFeeStructures(
      context.organizationId,
      scopedCampusIds(context),
    );
  }

  async createFeeStructure(context: FinanceContext, raw: FeeStructureInput) {
    const input = structureInput(raw);
    assertCampus(context, input.campusId);
    if (
      !(await this.repository.validateFeeStructureContext(
        context.organizationId,
        input,
      ))
    ) {
      throw new AppError(
        404,
        'ACADEMIC_RESOURCE_NOT_FOUND',
        'The selected academic year, class, or campus was not found.',
      );
    }
    return this.repository.createFeeStructure(context.organizationId, input);
  }

  async updateFeeStructure(
    context: FinanceContext,
    id: string,
    raw: FeeStructureInput,
  ) {
    objectId(id, 'fee structure');
    const input = structureInput(raw);
    assertCampus(context, input.campusId);
    if (
      !(await this.repository.validateFeeStructureContext(
        context.organizationId,
        input,
      ))
    ) {
      throw new AppError(
        404,
        'ACADEMIC_RESOURCE_NOT_FOUND',
        'The selected academic year, class, or campus was not found.',
      );
    }
    const updated = await this.repository.updateFeeStructure(
      context.organizationId,
      id,
      input,
    );
    if (!updated) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Fee structure not found.');
    }
    return updated;
  }

  async deleteFeeStructure(context: FinanceContext, id: string) {
    objectId(id, 'fee structure');
    const existing = await this.repository.getFeeStructure(
      context.organizationId,
      id,
    );
    if (!existing) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Fee structure not found.');
    }
    assertCampus(context, existing.campusId);
    if (!(await this.repository.deleteFeeStructure(context.organizationId, id))) {
      throw new AppError(
        409,
        'FEE_STRUCTURE_IN_USE',
        'A fee structure with generated invoices cannot be deleted.',
      );
    }
  }

  async listInvoices(context: FinanceContext, rawQuery: InvoiceQuery) {
    const query = normalizeInvoiceQuery(rawQuery);
    if (query.campusId) assertCampus(context, query.campusId);
    return this.repository.listInvoices(
      context.organizationId,
      query,
      scopedCampusIds(context),
    );
  }

  async generateInvoices(context: FinanceContext, raw: BulkInvoiceInput) {
    const input: BulkInvoiceInput = {
      classId: objectId(raw.classId, 'class'),
      academicYearId: objectId(raw.academicYearId, 'academic year'),
      feeStructureId: objectId(raw.feeStructureId, 'fee structure'),
      dueDate: validDate(raw.dueDate, 'due date'),
      billingCycle: normalizeCycle(raw.billingCycle),
    };
    const feeStructure = await this.repository.getFeeStructure(
      context.organizationId,
      input.feeStructureId,
    );
    if (!feeStructure) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Fee structure not found.');
    }
    assertCampus(context, feeStructure.campusId);
    if (
      feeStructure.classId !== input.classId ||
      feeStructure.academicYearId !== input.academicYearId
    ) {
      throw new AppError(
        400,
        'FEE_STRUCTURE_MISMATCH',
        'The fee structure must belong to the selected class and academic year.',
      );
    }
    if (
      !feeStructure.feeHeads.some(
        (head) => !head.isOptional && moneyCents(head.amount, head.title) > 0,
      )
    ) {
      throw new AppError(
        400,
        'INVALID_FEE_STRUCTURE',
        'Add at least one non-optional fee head with an amount greater than zero.',
      );
    }
    const issueDate = new Date().toISOString().slice(0, 10);
    const totalCents = feeStructure.feeHeads
      .filter((head) => !head.isOptional)
      .reduce((sum, head) => sum + moneyCents(head.amount, head.title), 0);
    let studentIds = await this.repository.listActiveClassStudents(
      context.organizationId,
      input,
    );
    if (studentIds.length === 0) {
      const organizationObjectId = new mongoose.Types.ObjectId(
        context.organizationId,
      );
      const placements = await StudentSectionPlacementModel.find({
        organizationId: organizationObjectId,
        campusId: new mongoose.Types.ObjectId(feeStructure.campusId),
        classId: new mongoose.Types.ObjectId(input.classId),
        academicYearId: new mongoose.Types.ObjectId(input.academicYearId),
        status: 'active',
      })
        .select({ studentId: 1 })
        .lean();
      const placedStudentIds = placements.map((placement) => placement.studentId);
      const activeStudents = await StudentModel.find({
        organizationId: organizationObjectId,
        status: 'active',
        _id: { $in: placedStudentIds },
      })
        .select({ _id: 1 })
        .lean();
      studentIds = activeStudents.map((student) => String(student._id));
    }
    const invoices = await this.repository.createInvoices(
      context.organizationId,
      input,
      feeStructure,
      studentIds,
      issueDate,
      totalCents / 100,
    );
    return {
      createdCount: invoices.length,
      skippedCount: studentIds.length - invoices.length,
      invoices,
    };
  }

  async recordPayment(
    context: FinanceContext,
    invoiceId: string,
    raw: PaymentInput,
  ) {
    const id = objectId(invoiceId, 'invoice');
    const amountCents = moneyCents(raw.amountPaid, 'payment');
    if (amountCents <= 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Payment amount must be greater than zero.',
      );
    }
    if (
      !paymentMethods.includes(
        raw.paymentMethod as (typeof paymentMethods)[number],
      )
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid payment method.');
    }
    const paymentDate = validDate(raw.paymentDate, 'payment date');
    if (paymentDate > new Date().toISOString().slice(0, 10)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Payment date cannot be in the future.');
    }
    const transactionReference = raw.transactionReference?.trim();
    if (transactionReference && transactionReference.length > 160) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Transaction reference cannot exceed 160 characters.',
      );
    }
    const invoice = await this.repository.getInvoice(
      context.organizationId,
      id,
      scopedCampusIds(context),
    );
    if (!invoice) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Invoice not found.');
    }
    assertCampus(context, invoice.campusId);
    const totalCents = moneyCents(invoice.totalAmount, 'invoice');
    const paidCents = moneyCents(invoice.paidAmount, 'paid');
    if (paidCents + amountCents > totalCents) {
      throw new AppError(
        400,
        'PAYMENT_EXCEEDS_BALANCE',
        'Payment amount cannot exceed the remaining invoice balance.',
      );
    }
    const input: PaymentInput = {
      amountPaid: amountCents / 100,
      paymentMethod: raw.paymentMethod,
      paymentDate,
      ...(transactionReference ? { transactionReference } : {}),
    };
    const result = await this.repository.recordPayment(
      context.organizationId,
      invoice,
      input,
      context.userId,
    );
    if (!result) {
      throw new AppError(
        409,
        'INVOICE_BALANCE_CHANGED',
        'The invoice balance changed. Refresh the invoice and try again.',
      );
    }
    return result;
  }

  async getStudentFeeLedger(context: FinanceContext, rawStudentId: string) {
    const studentId = objectId(rawStudentId, 'student');
    const ledger = await this.repository.getStudentFeeLedger(
      context.organizationId,
      studentId,
    );
    if (!ledger) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Student record not found.');
    }
    return ledger;
  }

  async listStudentConcessions(
    context: FinanceContext,
    rawStudentId: string,
    rawAcademicYearId?: string,
  ) {
    const studentId = objectId(rawStudentId, 'student');
    const academicYearId = rawAcademicYearId ? objectId(rawAcademicYearId, 'academic year') : undefined;
    return this.repository.listActiveStudentConcessions(
      context.organizationId,
      [studentId],
      academicYearId,
    );
  }

  async saveFeeConcession(
    context: FinanceContext,
    raw: FeeConcessionInput,
    id?: string,
  ) {
    const concessionId = id ? objectId(id, 'concession') : undefined;
    const input = validateConcessionInput(raw);
    return this.repository.saveFeeConcession(
      context.organizationId,
      input,
      concessionId,
    );
  }

  private static deleteOtpStore = new Map<
    string,
    { otp: string; expiresAt: number }
  >();

  async deleteFeeConcession(context: FinanceContext, rawId: string) {
    const id = objectId(rawId, 'concession');
    const deleted = await this.repository.deleteFeeConcession(
      context.organizationId,
      id,
    );
    if (!deleted) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Fee concession not found.');
    }
    return { success: true };
  }

  async requestInvoiceDeleteOtp(context: FinanceContext, rawInvoiceId: string, ownerPhone?: string) {
    const invoiceId = objectId(rawInvoiceId, 'invoice');
    const invoice = await this.repository.getInvoice(
      context.organizationId,
      invoiceId,
      scopedCampusIds(context),
    );
    if (!invoice) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Invoice not found.');
    }
    assertCampus(context, invoice.campusId);

    const challenge = await this.repository.requestInvoiceDeleteOtp(
      context.organizationId,
      invoice,
      context.userId,
      ownerPhone,
    );

    if (challenge.devOtpPreview) {
      FinanceService.deleteOtpStore.set(
        `${context.organizationId}:${invoiceId}`,
        {
          otp: challenge.devOtpPreview,
          expiresAt: Date.now() + challenge.expiresInMinutes * 60 * 1000,
        },
      );
    }

    return challenge;
  }

  async deleteInvoice(
    context: FinanceContext,
    rawInvoiceId: string,
    otpCode?: string,
  ) {
    const invoiceId = objectId(rawInvoiceId, 'invoice');
    const invoice = await this.repository.getInvoice(
      context.organizationId,
      invoiceId,
      scopedCampusIds(context),
    );
    if (!invoice) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Invoice not found.');
    }
    assertCampus(context, invoice.campusId);

    if (invoice.paidAmount > 0) {
      const key = `${context.organizationId}:${invoiceId}`;
      const record = FinanceService.deleteOtpStore.get(key);
      const cleanOtp = otpCode?.trim();

      if (!cleanOtp) {
        throw new AppError(
          403,
          'OWNER_OTP_REQUIRED',
          'This invoice has recorded payments. Owner approval OTP is required to delete it.',
        );
      }

      if (!record || Date.now() > record.expiresAt || record.otp !== cleanOtp) {
        throw new AppError(
          403,
          'INVALID_DELETE_OTP',
          'Invalid or expired Owner OTP. Please request a new OTP from the institute owner.',
        );
      }

      FinanceService.deleteOtpStore.delete(key);
    }

    const deleted = await this.repository.deleteInvoice(
      context.organizationId,
      invoiceId,
    );
    if (!deleted) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Invoice not found.');
    }
    return { success: true };
  }

  async setInvoiceDiscount(
    context: FinanceContext,
    rawInvoiceId: string,
    applyDiscount: boolean,
  ) {
    const invoiceId = objectId(rawInvoiceId, 'invoice');
    const invoice = await this.repository.getInvoice(
      context.organizationId,
      invoiceId,
      scopedCampusIds(context),
    );
    if (!invoice) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Invoice not found.');
    }
    assertCampus(context, invoice.campusId);

    const updated = await this.repository.setInvoiceDiscount(
      context.organizationId,
      invoiceId,
      applyDiscount,
    );
    if (!updated) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Invoice not found.');
    }
    return updated;
  }
}