import mongoose, { Types } from 'mongoose';
import { StudentModel } from '../people/people.model.js';
import {
  FeeConcessionModel,
  PaymentReceiptModel,
  StudentInvoiceModel,
} from './finance.model.js';
import {
  FinanceExpenseBudgetModel,
  FinanceExpenseModel,
} from './finance-operations.model.js';
import type {
  FinanceConcessionRecord,
  FinanceDateFilters,
  FinanceExpenseBudgetInput,
  FinanceExpenseBudgetRecord,
  FinanceExpenseInput,
  FinanceExpenseRecord,
  FinanceOperationsContext,
  FinanceOperationsRepository,
  FinancePaymentRecord,
} from './finance-operations.types.js';
import type { ExpenseCategory } from './finance-operations.model.js';
import type { PaymentMethod } from './finance.types.js';

const oid = (value: string) => new Types.ObjectId(value);
const decimalNumber = (value: unknown) => Number(value?.toString() ?? 0);
const iso = (value: unknown) => new Date(value as string | Date).toISOString();

function dateQuery(filters: FinanceDateFilters, field: string) {
  const range: Record<string, Date> = {};
  if (filters.dateFrom) range.$gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) range.$lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
  return Object.keys(range).length ? { [field]: range } : {};
}

function expenseRecord(value: Record<string, unknown>): FinanceExpenseRecord {
  return {
    id: String(value._id),
    organizationId: String(value.organizationId),
    campusId: value.campusId ? String(value.campusId) : undefined,
    description: String(value.description),
    category: value.category as ExpenseCategory,
    amount: decimalNumber(value.amount),
    paymentMethod: value.paymentMethod as PaymentMethod,
    expenseDate: iso(value.expenseDate),
    reference: value.reference ? String(value.reference) : undefined,
    recordedBy: String(value.recordedBy),
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
}

function expenseBudgetRecord(value: Record<string, unknown>): FinanceExpenseBudgetRecord {
  return {
    id: String(value._id),
    organizationId: String(value.organizationId),
    campusId: value.campusId ? String(value.campusId) : undefined,
    category: value.category as ExpenseCategory,
    month: String(value.month),
    budgetAmount: decimalNumber(value.budgetAmount),
    recordedBy: String(value.recordedBy),
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
}

export class MongoFinanceOperationsRepository implements FinanceOperationsRepository {
  async listPayments(
    context: FinanceOperationsContext,
    filters: FinanceDateFilters & { paymentMethod?: PaymentMethod },
  ): Promise<FinancePaymentRecord[]> {
    const receiptQuery: Record<string, unknown> = {
      organizationId: oid(context.organizationId),
      ...dateQuery(filters, 'paymentDate'),
    };
    if (filters.paymentMethod) receiptQuery.paymentMethod = filters.paymentMethod;
    const receipts = (await PaymentReceiptModel.find(receiptQuery)
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    if (!receipts.length) return [];

    const invoiceIds = [...new Set(receipts.map((item) => String(item.invoiceId)))];
    const invoiceQuery: Record<string, unknown> = {
      organizationId: oid(context.organizationId),
      _id: { $in: invoiceIds.map(oid) },
    };
    if (filters.campusId) invoiceQuery.campusId = oid(filters.campusId);
    else if (context.campusIds.length) {
      invoiceQuery.campusId = { $in: context.campusIds.map(oid) };
    }
    if (filters.classId) invoiceQuery.classId = oid(filters.classId);
    const invoices = (await StudentInvoiceModel.find(invoiceQuery)
      .select('_id invoiceNumber studentId campusId classId')
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    const invoiceMap = new Map(invoices.map((item) => [String(item._id), item]));
    const studentIds = [...new Set(invoices.map((item) => String(item.studentId)))];
    const students = (await StudentModel.find({
      organizationId: oid(context.organizationId),
      _id: { $in: studentIds.map(oid) },
    })
      .select('_id firstName lastName')
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    const studentMap = new Map(
      students.map((item) => [
        String(item._id),
        [String(item.firstName ?? ''), String(item.lastName ?? '')].filter(Boolean).join(' '),
      ]),
    );

    return receipts.flatMap((receipt) => {
      const invoice = invoiceMap.get(String(receipt.invoiceId));
      if (!invoice) return [];
      return [{
        id: String(receipt._id),
        organizationId: String(receipt.organizationId),
        receiptNumber: String(receipt.receiptNumber),
        invoiceId: String(receipt.invoiceId),
        invoiceNumber: String(invoice.invoiceNumber),
        studentId: String(receipt.studentId),
        studentName: studentMap.get(String(receipt.studentId)) ?? 'Student',
        campusId: String(invoice.campusId),
        classId: String(invoice.classId),
        amountPaid: decimalNumber(receipt.amountPaid),
        paymentMethod: receipt.paymentMethod as PaymentMethod,
        paymentDate: iso(receipt.paymentDate),
        transactionReference: receipt.transactionReference
          ? String(receipt.transactionReference)
          : undefined,
      }];
    });
  }

  async listExpenses(
    context: FinanceOperationsContext,
    filters: FinanceDateFilters & {
      category?: ExpenseCategory;
      paymentMethod?: PaymentMethod;
    },
  ): Promise<FinanceExpenseRecord[]> {
    const query: Record<string, unknown> = {
      organizationId: oid(context.organizationId),
      ...dateQuery(filters, 'expenseDate'),
    };
    if (filters.category) query.category = filters.category;
    if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
    if (filters.campusId) query.campusId = oid(filters.campusId);
    else if (context.campusIds.length) {
      query.campusId = { $in: context.campusIds.map(oid) };
    }
    const records = (await FinanceExpenseModel.find(query)
      .sort({ expenseDate: -1, createdAt: -1 })
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    return records.map(expenseRecord);
  }

  async createExpense(
    context: FinanceOperationsContext,
    input: FinanceExpenseInput,
  ): Promise<FinanceExpenseRecord> {
    const record = await FinanceExpenseModel.create({
      organizationId: oid(context.organizationId),
      campusId: input.campusId ? oid(input.campusId) : null,
      description: input.description,
      category: input.category,
      amount: mongoose.Types.Decimal128.fromString(input.amount.toFixed(2)),
      paymentMethod: input.paymentMethod,
      expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`),
      reference: input.reference,
      recordedBy: oid(context.userId),
    });
    return expenseRecord(record.toObject() as unknown as Record<string, unknown>);
  }

  async deleteExpense(
    context: FinanceOperationsContext,
    expenseId: string,
  ): Promise<boolean> {
    const query: Record<string, unknown> = {
      _id: oid(expenseId),
      organizationId: oid(context.organizationId),
    };
    if (context.campusIds.length) {
      query.campusId = { $in: context.campusIds.map(oid) };
    }
    const result = await FinanceExpenseModel.deleteOne(query).exec();
    return result.deletedCount === 1;
  }

  async listExpenseBudgets(
    context: FinanceOperationsContext,
    filters: { month: string; campusId?: string },
  ): Promise<FinanceExpenseBudgetRecord[]> {
    const query: Record<string, unknown> = {
      organizationId: oid(context.organizationId),
      month: filters.month,
    };
    if (filters.campusId) query.campusId = oid(filters.campusId);
    else if (context.campusIds.length) {
      query.campusId = { $in: context.campusIds.map(oid) };
    }
    const records = (await FinanceExpenseBudgetModel.find(query)
      .sort({ category: 1, campusId: 1 })
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    return records.map(expenseBudgetRecord);
  }

  async saveExpenseBudget(
    context: FinanceOperationsContext,
    input: FinanceExpenseBudgetInput,
  ): Promise<FinanceExpenseBudgetRecord> {
    const campusId = input.campusId ? oid(input.campusId) : null;
    const record = await FinanceExpenseBudgetModel.findOneAndUpdate(
      {
        organizationId: oid(context.organizationId),
        campusId,
        category: input.category,
        month: input.month,
      },
      {
        $set: {
          organizationId: oid(context.organizationId),
          campusId,
          category: input.category,
          month: input.month,
          budgetAmount: mongoose.Types.Decimal128.fromString(input.budgetAmount.toFixed(2)),
          recordedBy: oid(context.userId),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean().exec();
    if (!record) throw new Error('Expense budget could not be saved.');
    return expenseBudgetRecord(record as unknown as Record<string, unknown>);
  }

  async listConcessions(
    context: FinanceOperationsContext,
    filters: { campusId?: string; academicYearId?: string },
  ): Promise<FinanceConcessionRecord[]> {
    const query: Record<string, unknown> = {
      organizationId: oid(context.organizationId),
    };
    if (filters.academicYearId) query.academicYearId = oid(filters.academicYearId);
    if (filters.campusId) {
      const studentsForCampus = await StudentModel.find({
        organizationId: oid(context.organizationId),
        campusId: oid(filters.campusId),
      }).select('_id').lean().exec();
      query.studentId = { $in: studentsForCampus.map((item) => item._id) };
    } else if (context.campusIds.length) {
      const studentsForCampuses = await StudentModel.find({
        organizationId: oid(context.organizationId),
        campusId: { $in: context.campusIds.map(oid) },
      }).select('_id').lean().exec();
      query.studentId = { $in: studentsForCampuses.map((item) => item._id) };
    }
    const records = (await FeeConcessionModel.find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    if (!records.length) return [];
    const studentIds = [...new Set(records.map((item) => String(item.studentId)))];
    const students = (await StudentModel.find({
      organizationId: oid(context.organizationId),
      _id: { $in: studentIds.map(oid) },
    })
      .select('_id firstName lastName campusId')
      .lean()
      .exec()) as unknown as Array<Record<string, unknown>>;
    const studentMap = new Map(students.map((item) => [
      String(item._id),
      {
        name: [String(item.firstName ?? ''), String(item.lastName ?? '')].filter(Boolean).join(' ') || 'Student',
        campusId: item.campusId ? String(item.campusId) : undefined,
      },
    ]));
    return records.flatMap((item) => {
      const student = studentMap.get(String(item.studentId));
      if (!student) return [];
      return [{
        id: String(item._id),
        organizationId: String(item.organizationId),
        studentId: String(item.studentId),
        studentName: student.name,
        campusId: student.campusId,
        academicYearId: item.academicYearId ? String(item.academicYearId) : undefined,
        concessionType: item.concessionType as FinanceConcessionRecord['concessionType'],
        discountType: item.discountType as FinanceConcessionRecord['discountType'],
        discountValue: decimalNumber(item.discountValue),
        reason: item.reason ? String(item.reason) : undefined,
        isActive: Boolean(item.isActive),
        createdAt: iso(item.createdAt),
        updatedAt: iso(item.updatedAt),
      }];
    });
  }
}
