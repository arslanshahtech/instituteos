import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { AcademicClassModel, AcademicYearModel } from '../academics/academics.model.js';
import {
  EnrollmentModel,
  StudentModel,
} from '../people/people.model.js';
import { StudentSectionPlacementModel } from '../attendance/attendance.model.js';
import type {
  FeeStructureInput,
  FeeStructureRecord,
  FinanceRepository,
  InvoiceQuery,
  PaymentInput,
  PaymentReceiptRecord,
  StudentInvoiceRecord,
  BulkInvoiceInput,
} from './finance.types.js';
import {
  FeeStructureModel,
  PaymentReceiptModel,
  StudentInvoiceModel,
} from './finance.model.js';

const oid = (id: string) => new Types.ObjectId(id);
const money = (amount: number) =>
  mongoose.Types.Decimal128.fromString(amount.toFixed(2));
const decimalNumber = (value: unknown) => Number(value?.toString() ?? 0);
const iso = (value: Date | string) => new Date(value).toISOString();
const randomNumber = (prefix: string) =>
  `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

function isTransactionUnsupported(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: number;
    codeName?: string;
    message?: string;
  };
  const message = candidate.message ?? '';
  return (
    (candidate.code === 20 &&
      /transaction numbers are only allowed|transactions? (?:are )?not supported/i.test(
        message,
      )) ||
    /transaction numbers are only allowed on a replica set member or mongos|transactions? are not supported by this deployment|topology does not support sessions|sessions are not supported by this deployment/i.test(
      message,
    )
  );
}

function feeStructureRecord(record: Record<string, unknown>): FeeStructureRecord {
  const heads = record.feeHeads as Array<Record<string, unknown>>;
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    name: String(record.name),
    academicYearId: String(record.academicYearId),
    classId: String(record.classId),
    campusId: String(record.campusId),
    feeHeads: heads.map((head) => ({
      title: String(head.title),
      amount: decimalNumber(head.amount),
      isOptional: Boolean(head.isOptional),
    })),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function invoiceRecord(record: Record<string, unknown>): StudentInvoiceRecord {
  const student = record.studentId as
    | Record<string, unknown>
    | Types.ObjectId
    | undefined;
  const structure = record.feeStructureId as
    | Record<string, unknown>
    | Types.ObjectId
    | undefined;
  const studentObject =
    student && !(student instanceof Types.ObjectId) ? student : undefined;
  const structureObject =
    structure && !(structure instanceof Types.ObjectId) ? structure : undefined;
  const paidAmount = decimalNumber(record.paidAmount);
  const totalAmount = decimalNumber(record.totalAmount);
  const dueDate = iso(record.dueDate as Date);
  const calculatedStatus =
    paidAmount >= totalAmount
      ? 'paid'
      : new Date(dueDate).getTime() < Date.now()
        ? 'overdue'
        : paidAmount > 0
          ? 'partial'
          : 'unpaid';
  return {
    id: String(record._id),
    invoiceNumber: String(record.invoiceNumber),
    studentId: studentObject
      ? String(studentObject._id)
      : String(record.studentId),
    studentName: studentObject
      ? `${String(studentObject.firstName)} ${String(studentObject.lastName)}`
      : '',
    feeStructureId: structureObject
      ? String(structureObject._id)
      : String(record.feeStructureId),
    feeStructureName: structureObject ? String(structureObject.name) : '',
    classId: String(record.classId),
    academicYearId: String(record.academicYearId),
    campusId: String(record.campusId),
    organizationId: String(record.organizationId),
    billingCycle: String(record.billingCycle),
    dueDate,
    totalAmount,
    paidAmount,
    status: calculatedStatus,
    issueDate: iso(record.issueDate as Date),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

export class MongoFinanceRepository implements FinanceRepository {
  async validateFeeStructureContext(
    organizationId: string,
    input: FeeStructureInput,
  ): Promise<boolean> {
    const [year, academicClass] = await Promise.all([
      AcademicYearModel.exists({
        _id: oid(input.academicYearId),
        organizationId: oid(organizationId),
      }),
      AcademicClassModel.exists({
        _id: oid(input.classId),
        organizationId: oid(organizationId),
        campusId: oid(input.campusId),
      }),
    ]);
    return Boolean(year && academicClass);
  }

  async listFeeStructures(
    organizationId: string,
    campusIds?: string[],
  ): Promise<FeeStructureRecord[]> {
    const records = await FeeStructureModel.find({
      organizationId: oid(organizationId),
      ...(campusIds ? { campusId: { $in: campusIds.map(oid) } } : {}),
    })
      .sort({ name: 1 })
      .lean();
    return records.map((record) =>
      feeStructureRecord(record as unknown as Record<string, unknown>),
    );
  }

  async getFeeStructure(
    organizationId: string,
    id: string,
  ): Promise<FeeStructureRecord | null> {
    const record = await FeeStructureModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record
      ? feeStructureRecord(record as unknown as Record<string, unknown>)
      : null;
  }

  async createFeeStructure(
    organizationId: string,
    input: FeeStructureInput,
  ): Promise<FeeStructureRecord> {
    const [record] = await FeeStructureModel.create([
      {
        ...input,
        organizationId: oid(organizationId),
        academicYearId: oid(input.academicYearId),
        classId: oid(input.classId),
        campusId: oid(input.campusId),
        feeHeads: input.feeHeads.map((head) => ({
          ...head,
          amount: money(head.amount),
        })),
      },
    ]);
    return feeStructureRecord(record.toObject() as Record<string, unknown>);
  }

  async updateFeeStructure(
    organizationId: string,
    id: string,
    input: FeeStructureInput,
  ): Promise<FeeStructureRecord | null> {
    const record = await FeeStructureModel.findOneAndUpdate(
      { _id: oid(id), organizationId: oid(organizationId) },
      {
        ...input,
        academicYearId: oid(input.academicYearId),
        classId: oid(input.classId),
        campusId: oid(input.campusId),
        feeHeads: input.feeHeads.map((head) => ({
          ...head,
          amount: money(head.amount),
        })),
      },
      { new: true, runValidators: true },
    ).lean();
    return record
      ? feeStructureRecord(record as unknown as Record<string, unknown>)
      : null;
  }

  async deleteFeeStructure(
    organizationId: string,
    id: string,
  ): Promise<boolean> {
    const hasInvoices = await StudentInvoiceModel.exists({
      organizationId: oid(organizationId),
      feeStructureId: oid(id),
    });
    if (hasInvoices) return false;
    const result = await FeeStructureModel.deleteOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    });
    return result.deletedCount === 1;
  }

  async listInvoices(
    organizationId: string,
    query: InvoiceQuery,
    campusIds?: string[],
  ): Promise<StudentInvoiceRecord[]> {
    const now = new Date();
    const statusFilter =
      query.status === 'overdue'
        ? { status: { $ne: 'paid' }, dueDate: { $lt: now } }
        : query.status
          ? {
              status: query.status,
              ...(query.status === 'unpaid' || query.status === 'partial'
                ? { dueDate: { $gte: now } }
                : {}),
            }
          : {};
    const records = await StudentInvoiceModel.find({
      organizationId: oid(organizationId),
      ...(campusIds ? { campusId: { $in: campusIds.map(oid) } } : {}),
      ...(query.campusId ? { campusId: oid(query.campusId) } : {}),
      ...(query.classId ? { classId: oid(query.classId) } : {}),
      ...(query.studentId ? { studentId: oid(query.studentId) } : {}),
      ...statusFilter,
      ...(query.dateFrom || query.dateTo
        ? {
            issueDate: {
              ...(query.dateFrom
                ? { $gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
                : {}),
              ...(query.dateTo
                ? { $lte: new Date(`${query.dateTo}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    })
      .populate('studentId', 'firstName lastName')
      .populate('feeStructureId', 'name')
      .sort({ issueDate: -1, invoiceNumber: 1 })
      .lean();
    return records.map((record) =>
      invoiceRecord(record as unknown as Record<string, unknown>),
    );
  }

  async getInvoice(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<StudentInvoiceRecord | null> {
    const record = await StudentInvoiceModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
      ...(campusIds ? { campusId: { $in: campusIds.map(oid) } } : {}),
    })
      .populate('studentId', 'firstName lastName')
      .populate('feeStructureId', 'name')
      .lean();
    return record
      ? invoiceRecord(record as unknown as Record<string, unknown>)
      : null;
  }

  async listActiveClassStudents(
    organizationId: string,
    input: BulkInvoiceInput,
  ): Promise<string[]> {
    const academicClass = await AcademicClassModel.findOne({
      _id: oid(input.classId),
      organizationId: oid(organizationId),
    })
      .select({ campusId: 1 })
      .lean();
    if (!academicClass) return [];
    const placements = await StudentSectionPlacementModel.find({
      organizationId: oid(organizationId),
      classId: oid(input.classId),
      academicYearId: oid(input.academicYearId),
      campusId: academicClass.campusId,
      status: 'active',
    })
      .select({ studentId: 1 })
      .lean();
    const placedIds = placements.map((placement) => placement.studentId);
    const enrolled = await EnrollmentModel.find({
      organizationId: oid(organizationId),
      studentId: { $in: placedIds },
      campusId: academicClass.campusId,
      status: 'active',
    })
      .select({ studentId: 1 })
      .lean();
    const enrolledIds = enrolled.map((item) => item.studentId);
    const students = await StudentModel.find({
      organizationId: oid(organizationId),
      status: 'active',
      _id: { $in: enrolledIds },
    })
      .select({ _id: 1 })
      .lean();
    return students.map((student) => String(student._id));
  }

  async createInvoices(
    organizationId: string,
    input: BulkInvoiceInput,
    feeStructure: FeeStructureRecord,
    studentIds: string[],
    issueDate: string,
    totalAmount: number,
  ): Promise<StudentInvoiceRecord[]> {
    if (!studentIds.length) return [];
    const existing = await StudentInvoiceModel.find({
      organizationId: oid(organizationId),
      feeStructureId: oid(feeStructure.id),
      billingCycle: input.billingCycle,
      studentId: { $in: studentIds.map(oid) },
    })
      .select({ studentId: 1 })
      .lean();
    const existingIds = new Set(existing.map((item) => String(item.studentId)));
    const storedTotal = money(totalAmount);
    const due = new Date(`${input.dueDate}T00:00:00.000Z`);
    const issued = new Date(`${issueDate}T00:00:00.000Z`);
    const status = due < issued ? 'overdue' : 'unpaid';
    const documents = studentIds
      .filter((studentId) => !existingIds.has(studentId))
      .map((studentId) => ({
        organizationId: oid(organizationId),
        invoiceNumber: randomNumber('INV'),
        studentId: oid(studentId),
        feeStructureId: oid(feeStructure.id),
        classId: oid(input.classId),
        academicYearId: oid(input.academicYearId),
        campusId: oid(feeStructure.campusId),
        billingCycle: input.billingCycle,
        dueDate: due,
        totalAmount: storedTotal,
        paidAmount: money(0),
        status,
        issueDate: issued,
      }));
    if (!documents.length) return [];
    const created = await StudentInvoiceModel.insertMany(documents);
    return created.map((record) =>
      invoiceRecord(record.toObject() as Record<string, unknown>),
    );
  }

 async recordPayment(
    organizationId: string,
    invoice: StudentInvoiceRecord,
    input: PaymentInput,
    recordedBy: string,
  ): Promise<{
    receipt: PaymentReceiptRecord;
    invoice: StudentInvoiceRecord;
  } | null> {
    const amount = money(input.amountPaid);
    const newPaidAmountNum = invoice.paidAmount + input.amountPaid;
    const newPaidAmountDecimal = money(newPaidAmountNum);

    const now = new Date();
    const dueDateObj = new Date(invoice.dueDate);
    let calculatedStatus: 'paid' | 'overdue' | 'partial' | 'unpaid' = 'unpaid';

    if (newPaidAmountNum >= invoice.totalAmount) {
      calculatedStatus = 'paid';
    } else if (dueDateObj.getTime() < now.getTime()) {
      calculatedStatus = 'overdue';
    } else if (newPaidAmountNum > 0) {
      calculatedStatus = 'partial';
    }

    // 1. Invoice update
    const record = await StudentInvoiceModel.findOneAndUpdate(
      {
        _id: oid(invoice.id),
        organizationId: oid(organizationId),
      },
      {
        $set: {
          paidAmount: newPaidAmountDecimal,
          status: calculatedStatus,
          updatedAt: now,
        },
      },
      { new: true },
    )
      .populate('studentId', 'firstName lastName')
      .populate('feeStructureId', 'name')
      .lean();

    if (!record) return null;

    // 2. Receipt create
    const [receiptRecord] = await PaymentReceiptModel.create([
      {
        organizationId: oid(organizationId),
        receiptNumber: randomNumber('RCT'),
        invoiceId: oid(invoice.id),
        studentId: oid(invoice.studentId),
        amountPaid: amount,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        paymentDate: new Date(`${input.paymentDate}T00:00:00.000Z`),
        recordedBy: oid(recordedBy),
      },
    ]);

    return {
      invoice: invoiceRecord(record as unknown as Record<string, unknown>),
      receipt: {
        id: String(receiptRecord._id),
        receiptNumber: receiptRecord.receiptNumber,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amountPaid: input.amountPaid,
        paymentMethod: input.paymentMethod,
        ...(input.transactionReference
          ? { transactionReference: input.transactionReference }
          : {}),
        paymentDate: iso(receiptRecord.paymentDate),
        recordedBy,
        organizationId,
        createdAt: iso(receiptRecord.createdAt),
      },
    };
  }
}
