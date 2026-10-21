import mongoose, { Types, type PipelineStage } from 'mongoose';
import {
  AcademicClassModel,
  AcademicYearModel,
} from '../academics/academics.model.js';
import {
  StudentModel,
  GuardianModel,
  StudentGuardianLinkModel,
} from '../people/people.model.js';
import { StudentSectionPlacementModel } from '../attendance/attendance.model.js';
import type {
  FeeStructureInput,
  FeeStructureRecord,
  FinanceRepository,
  InvoiceQuery,
  DailyCollectionRecord,
  PaymentInput,
  PaymentReceiptRecord,
  PaymentNotificationPayload,
  StudentInvoiceRecord,
  BulkInvoiceInput,
  StudentLedgerSummary,
  StudentLedgerEntry,
  FeeConcessionInput,
  FeeConcessionRecord,
  InvoiceDeleteOtpChallenge,
} from './finance.types.js';
import {
  FeeStructureModel,
  PaymentReceiptModel,
  StudentInvoiceModel,
  FeeConcessionModel,
  FinanceSequenceModel,
} from './finance.model.js';

const oid = (id: string) => new Types.ObjectId(id);
const money = (amount: number) =>
  mongoose.Types.Decimal128.fromString(amount.toFixed(2));
const decimalNumber = (value: unknown) => Number(value?.toString() ?? 0);
const iso = (value: Date | string) => new Date(value).toISOString();
function feeStructureRecord(
  record: Record<string, unknown>,
): FeeStructureRecord {
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

function feeConcessionRecord(
  record: Record<string, unknown>,
): FeeConcessionRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    studentId: String(record.studentId),
    academicYearId: record.academicYearId
      ? String(record.academicYearId)
      : undefined,
    concessionType:
      record.concessionType as FeeConcessionRecord['concessionType'],
    discountType: record.discountType as FeeConcessionRecord['discountType'],
    discountValue: decimalNumber(record.discountValue),
    reason: record.reason ? String(record.reason) : undefined,
    isActive: Boolean(record.isActive),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function invoiceRecord(record: Record<string, unknown>): StudentInvoiceRecord {
  const student = record.studentId as
    Record<string, unknown> | Types.ObjectId | undefined;
  const structure = record.feeStructureId as
    Record<string, unknown> | Types.ObjectId | undefined;
  const studentObject =
    student && !(student instanceof Types.ObjectId) ? student : undefined;
  const structureObject =
    structure && !(structure instanceof Types.ObjectId) ? structure : undefined;
  const paidAmount = decimalNumber(record.paidAmount);
  const totalAmount = decimalNumber(record.totalAmount);
  const arrearsAmount = record.arrearsAmount
    ? decimalNumber(record.arrearsAmount)
    : 0;
  const currentAmount = record.currentAmount
    ? decimalNumber(record.currentAmount)
    : totalAmount;
  const discountAmount = record.discountAmount
    ? decimalNumber(record.discountAmount)
    : 0;
  const discountReason = record.discountReason
    ? String(record.discountReason)
    : undefined;
  const dueDate = iso(record.dueDate as Date);
  const calculatedStatus =
    paidAmount >= totalAmount
      ? 'paid'
      : new Date(dueDate).getTime() < Date.now()
        ? 'overdue'
        : paidAmount > 0
          ? 'partial'
          : 'unpaid';

  const rawPhone =
    studentObject && typeof studentObject.phone === 'string'
      ? studentObject.phone
      : '';

  return {
    id: String(record._id),
    invoiceNumber: String(record.invoiceNumber),
    studentId: studentObject
      ? String(studentObject._id)
      : String(record.studentId),
    studentName: studentObject
      ? `${String(studentObject.firstName)} ${String(studentObject.lastName)}`
      : '',
    guardianPhone: rawPhone,
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
    currentAmount,
    discountAmount,
    discountReason,
    arrearsAmount,
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
      .populate('studentId', 'firstName lastName phone')
      .populate('feeStructureId', 'name')
      .sort({ issueDate: -1, invoiceNumber: 1 })
      .lean();
    return records.map((record) =>
      invoiceRecord(record as unknown as Record<string, unknown>),
    );
  }

  async listDailyCollections(
    organizationId: string,
    dateFrom: string,
    dateTo: string,
    campusIds?: string[],
  ): Promise<DailyCollectionRecord[]> {
    if (campusIds && campusIds.length === 0) return [];
    const start = new Date(`${dateFrom}T00:00:00.000Z`);
    const end = new Date(`${dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          organizationId: oid(organizationId),
          paymentDate: { $gte: start, $lt: end },
        },
      },
      {
        $lookup: {
          from: StudentInvoiceModel.collection.name,
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      { $unwind: '$invoice' },
      ...(campusIds
        ? [{ $match: { 'invoice.campusId': { $in: campusIds.map(oid) } } }]
        : []),
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$paymentDate',
              timezone: 'UTC',
            },
          },
          amountCollected: { $sum: { $toDouble: '$amountPaid' } },
          paymentCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const records = await PaymentReceiptModel.aggregate<{
      _id: string;
      amountCollected: number;
      paymentCount: number;
    }>(pipeline).exec();
    return records.map((record) => ({
      date: record._id,
      amountCollected: Number(record.amountCollected ?? 0),
      paymentCount: Number(record.paymentCount ?? 0),
    }));
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
      .populate('studentId', 'firstName lastName phone')
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
    // Class placement for the selected academic year is the source of truth
    // for class membership. Do not require a second active Enrollment record:
    // legacy students may have a valid placement but an absent/stale enrollment.
    if (!placedIds.length) return [];
    const students = await StudentModel.find({
      organizationId: oid(organizationId),
      status: 'active',
      _id: { $in: placedIds },
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
    const targetStudentIds = studentIds.filter((id) => !existingIds.has(id));

    // Active student concessions تلاش کریں اور جمع کریں
    const concessions = targetStudentIds.length
      ? await FeeConcessionModel.find({
          organizationId: oid(organizationId),
          studentId: { $in: targetStudentIds.map(oid) },
          isActive: true,
          $or: [
            { academicYearId: oid(input.academicYearId) },
            { academicYearId: { $exists: false } },
            { academicYearId: null },
          ],
        }).lean()
      : [];

    const concessionMap = new Map<
      string,
      { discountAmount: number; reason: string }
    >();

    for (const conc of concessions) {
      const sid = String(conc.studentId);
      const val = decimalNumber(conc.discountValue);
      let calculatedDiscount = 0;
      if (conc.discountType === 'percentage') {
        calculatedDiscount = (totalAmount * val) / 100;
      } else {
        calculatedDiscount = val;
      }
      const label =
        conc.reason ||
        `${conc.concessionType.replace('_', ' ').toUpperCase()} (${conc.discountType === 'percentage' ? `${val}%` : `Rs. ${val}`})`;

      const prev = concessionMap.get(sid);
      const combinedDiscount = Math.min(
        totalAmount,
        Math.max(0, (prev?.discountAmount ?? 0) + calculatedDiscount),
      );
      const combinedReason = prev ? `${prev.reason} + ${label}` : label;

      concessionMap.set(sid, {
        discountAmount: combinedDiscount,
        reason: combinedReason,
      });
    }

    const due = new Date(`${input.dueDate}T00:00:00.000Z`);
    const issued = new Date(`${issueDate}T00:00:00.000Z`);
    const status = due < issued ? 'overdue' : 'unpaid';

    if (!targetStudentIds.length) return [];

    const sequence = await FinanceSequenceModel.findOneAndUpdate(
      { organizationId: oid(organizationId), name: 'invoice' },
      { $inc: { value: targetStudentIds.length } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    const sequenceEnd = Number(sequence?.value ?? targetStudentIds.length);
    const sequenceStart = sequenceEnd - targetStudentIds.length + 1;
    const year = String(new Date().getFullYear()).slice(-2);

    const documents = targetStudentIds.map((studentId, index) => {
      const conc = concessionMap.get(studentId);
      const discount = conc ? conc.discountAmount : 0;
      const netTotal = Math.max(0, totalAmount - discount);

      return {
        organizationId: oid(organizationId),
        invoiceNumber: `INV-${year}-${String(sequenceStart + index).padStart(6, '0')}`,
        studentId: oid(studentId),
        feeStructureId: oid(feeStructure.id),
        classId: oid(input.classId),
        academicYearId: oid(input.academicYearId),
        campusId: oid(feeStructure.campusId),
        billingCycle: input.billingCycle,
        dueDate: due,
        currentAmount: money(totalAmount),
        discountAmount: money(discount),
        discountReason: conc ? conc.reason : undefined,
        arrearsAmount: money(0),
        totalAmount: money(netTotal),
        paidAmount: money(0),
        status: netTotal === 0 ? 'paid' : status,
        issueDate: issued,
      };
    });
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
    notification?: PaymentNotificationPayload;
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

    const receiptSequence = await FinanceSequenceModel.findOneAndUpdate(
      { organizationId: oid(organizationId), name: 'receipt' },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    const receiptNumber = `RCT-${String(new Date().getFullYear()).slice(-2)}-${String(
      Number(receiptSequence?.value ?? 1),
    ).padStart(6, '0')}`;

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
      .populate('studentId', 'firstName lastName phone')
      .populate('feeStructureId', 'name')
      .lean();

    if (!record) return null;

    const [receiptRecord] = await PaymentReceiptModel.create([
      {
        organizationId: oid(organizationId),
        receiptNumber,
        invoiceId: oid(invoice.id),
        studentId: oid(invoice.studentId),
        amountPaid: amount,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        paymentDate: new Date(`${input.paymentDate}T00:00:00.000Z`),
        recordedBy: oid(recordedBy),
      },
    ]);

    let recipientPhone = '';
    let recipientName = 'Mohtaram Parent';

    const guardianLink = await StudentGuardianLinkModel.findOne({
      studentId: oid(invoice.studentId),
      organizationId: oid(organizationId),
      isPrimaryContact: true,
    }).lean();

    if (guardianLink) {
      const guardian = await GuardianModel.findById(
        guardianLink.guardianId,
      ).lean();
      if (guardian && guardian.phone) {
        recipientPhone = guardian.phone;
        recipientName = `${guardian.firstName} ${guardian.lastName}`.trim();
      }
    }

    if (!recipientPhone) {
      const studentDoc = await StudentModel.findById(
        oid(invoice.studentId),
      ).lean();
      if (studentDoc && studentDoc.phone) {
        recipientPhone = studentDoc.phone;
      }
    }

    const remainingBalance = Math.max(
      0,
      invoice.totalAmount - newPaidAmountNum,
    );
    const invoiceData = invoiceRecord(
      record as unknown as Record<string, unknown>,
    );

    let notification: PaymentNotificationPayload | undefined;
    if (recipientPhone) {
      const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
      const messageText = `Mohtaram Parent, ${invoiceData.studentName} ki fee Rs. ${input.amountPaid} receive ho gayi hai (Receipt: ${receiptRecord.receiptNumber}, Invoice: ${invoiceData.invoiceNumber}). Baqaya balance: Rs. ${remainingBalance}. Shukriya!`;
      const whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

      notification = {
        recipientPhone,
        recipientName,
        messageText,
        whatsAppUrl,
      };
    }

    return {
      invoice: invoiceData,
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
      ...(notification ? { notification } : {}),
    };
  }

  async getStudentFeeLedger(
    organizationId: string,
    studentId: string,
  ): Promise<StudentLedgerSummary | null> {
    const student = await StudentModel.findOne({
      _id: oid(studentId),
      organizationId: oid(organizationId),
    })
      .select({ firstName: 1, lastName: 1 })
      .lean();

    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : 'Student';

    const [invoices, receipts] = await Promise.all([
      StudentInvoiceModel.find({
        organizationId: oid(organizationId),
        studentId: oid(studentId),
      })
        .sort({ issueDate: 1 })
        .lean(),
      PaymentReceiptModel.find({
        organizationId: oid(organizationId),
        studentId: oid(studentId),
      })
        .sort({ paymentDate: 1 })
        .lean(),
    ]);

    const rawEntries: {
      date: string;
      timestamp: number;
      type: 'invoice' | 'payment';
      referenceNumber: string;
      description: string;
      debit: number;
      credit: number;
    }[] = [];

    let totalBilled = 0;
    let totalPaid = 0;

    for (const inv of invoices) {
      const amount = Number(String(inv.totalAmount ?? 0));
      const discount = inv.discountAmount
        ? decimalNumber(inv.discountAmount)
        : 0;
      totalBilled += amount;
      const dateStr = inv.issueDate
        ? new Date(inv.issueDate).toISOString().slice(0, 10)
        : '';
      const discountNote =
        discount > 0 ? ` — Discount: Rs. ${discount.toFixed(2)}` : '';
      rawEntries.push({
        date: dateStr,
        timestamp: inv.issueDate ? new Date(inv.issueDate).getTime() : 0,
        type: 'invoice',
        referenceNumber: inv.invoiceNumber,
        description: `Invoice generated (${inv.billingCycle})${discountNote}`,
        debit: amount,
        credit: 0,
      });
    }

    for (const rec of receipts) {
      const amount = Number(String(rec.amountPaid ?? 0));
      totalPaid += amount;
      const dateStr = rec.paymentDate
        ? new Date(rec.paymentDate).toISOString().slice(0, 10)
        : '';
      rawEntries.push({
        date: dateStr,
        timestamp: rec.paymentDate ? new Date(rec.paymentDate).getTime() : 0,
        type: 'payment',
        referenceNumber: rec.receiptNumber,
        description: `Payment received (${rec.paymentMethod})`,
        debit: 0,
        credit: amount,
      });
    }

    rawEntries.sort((a, b) => a.timestamp - b.timestamp);

    let runningBalance = 0;
    const entries: StudentLedgerEntry[] = rawEntries.map((item) => {
      runningBalance += item.debit - item.credit;
      return {
        date: item.date,
        type: item.type,
        referenceNumber: item.referenceNumber,
        description: item.description,
        debit: item.debit,
        credit: item.credit,
        balance: Math.max(0, runningBalance),
      };
    });

    return {
      studentId,
      studentName,
      totalBilled,
      totalPaid,
      outstandingBalance: Math.max(0, totalBilled - totalPaid),
      entries,
    };
  }

  async listActiveStudentConcessions(
    organizationId: string,
    studentIds: string[],
    academicYearId?: string,
  ): Promise<FeeConcessionRecord[]> {
    const query: Record<string, unknown> = {
      organizationId: oid(organizationId),
      studentId: { $in: studentIds.map(oid) },
      isActive: true,
    };
    if (academicYearId) {
      query.$or = [
        { academicYearId: oid(academicYearId) },
        { academicYearId: { $exists: false } },
        { academicYearId: null },
      ];
    }
    const records = await FeeConcessionModel.find(query).lean();
    return records.map((record) =>
      feeConcessionRecord(record as unknown as Record<string, unknown>),
    );
  }

  private async recalculateOpenInvoicesForStudent(
    organizationId: string,
    studentId: string,
  ): Promise<void> {
    const [openInvoices, concessions] = await Promise.all([
      StudentInvoiceModel.find({
        organizationId: oid(organizationId),
        studentId: oid(studentId),
        status: { $in: ['unpaid', 'partial', 'overdue'] },
      }).lean(),
      FeeConcessionModel.find({
        organizationId: oid(organizationId),
        studentId: oid(studentId),
        isActive: true,
      }).lean(),
    ]);

    if (!openInvoices.length) return;

    const now = new Date();

    for (const inv of openInvoices) {
      const baseFee =
        inv.currentAmount && decimalNumber(inv.currentAmount) > 0
          ? decimalNumber(inv.currentAmount)
          : decimalNumber(inv.totalAmount) + decimalNumber(inv.discountAmount);

      let combinedDiscount = 0;
      const reasons: string[] = [];

      for (const conc of concessions) {
        if (
          conc.academicYearId &&
          String(conc.academicYearId) !== String(inv.academicYearId)
        ) {
          continue;
        }
        const val = decimalNumber(conc.discountValue);
        const disc =
          conc.discountType === 'percentage' ? (baseFee * val) / 100 : val;
        combinedDiscount += disc;
        reasons.push(
          conc.reason ||
            `${conc.concessionType.replace('_', ' ').toUpperCase()} (${conc.discountType === 'percentage' ? `${val}%` : `Rs. ${val}`})`,
        );
      }

      combinedDiscount = Math.min(baseFee, Math.max(0, combinedDiscount));
      const newNetTotal = Math.max(0, baseFee - combinedDiscount);
      const paid = decimalNumber(inv.paidAmount);
      const dueDateObj = new Date(inv.dueDate as Date);

      let newStatus: 'paid' | 'overdue' | 'partial' | 'unpaid' = 'unpaid';
      if (paid >= newNetTotal) {
        newStatus = 'paid';
      } else if (dueDateObj.getTime() < now.getTime()) {
        newStatus = 'overdue';
      } else if (paid > 0) {
        newStatus = 'partial';
      }

      await StudentInvoiceModel.updateOne(
        { _id: inv._id },
        {
          $set: {
            currentAmount: money(baseFee),
            discountAmount: money(combinedDiscount),
            discountReason: reasons.length ? reasons.join(' + ') : undefined,
            arrearsAmount: money(0),
            totalAmount: money(newNetTotal),
            status: newStatus,
          },
        },
      );
    }
  }

  async saveFeeConcession(
    organizationId: string,
    input: FeeConcessionInput,
    id?: string,
  ): Promise<FeeConcessionRecord> {
    if (id) {
      const record = await FeeConcessionModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        {
          ...input,
          studentId: oid(input.studentId),
          academicYearId: input.academicYearId
            ? oid(input.academicYearId)
            : undefined,
          discountValue: money(input.discountValue),
        },
        { new: true, runValidators: true },
      ).lean();
      if (!record) {
        throw new Error('Concession record not found');
      }
      await this.recalculateOpenInvoicesForStudent(
        organizationId,
        input.studentId,
      );
      return feeConcessionRecord(record as unknown as Record<string, unknown>);
    }

    const [created] = await FeeConcessionModel.create([
      {
        ...input,
        organizationId: oid(organizationId),
        studentId: oid(input.studentId),
        academicYearId: input.academicYearId
          ? oid(input.academicYearId)
          : undefined,
        discountValue: money(input.discountValue),
      },
    ]);
    await this.recalculateOpenInvoicesForStudent(
      organizationId,
      input.studentId,
    );
    return feeConcessionRecord(created.toObject() as Record<string, unknown>);
  }

  async deleteFeeConcession(
    organizationId: string,
    id: string,
  ): Promise<boolean> {
    const deleted = await FeeConcessionModel.findOneAndDelete({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    if (!deleted) return false;
    await this.recalculateOpenInvoicesForStudent(
      organizationId,
      String(deleted.studentId),
    );
    return true;
  }

  async requestInvoiceDeleteOtp(
    organizationId: string,
    invoice: StudentInvoiceRecord,
    requestedByUserId: string,
    ownerPhoneOverride?: string,
  ): Promise<InvoiceDeleteOtpChallenge> {
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresInMinutes = 10;

    let targetPhone = ownerPhoneOverride?.trim() ?? '';

    if (!targetPhone) {
      const orgDoc = await mongoose.connection
        .collection('organizations')
        .findOne({ _id: oid(organizationId) });
      if (orgDoc && typeof orgDoc.phone === 'string' && orgDoc.phone.trim()) {
        targetPhone = orgDoc.phone.trim();
      }
    }

    if (!targetPhone) {
      const guardianLink = await StudentGuardianLinkModel.findOne({
        studentId: oid(invoice.studentId),
        organizationId: oid(organizationId),
        isPrimaryContact: true,
      }).lean();

      if (guardianLink) {
        const guardian = await GuardianModel.findById(
          guardianLink.guardianId,
        ).lean();
        if (guardian && guardian.phone) {
          targetPhone = guardian.phone;
        }
      }
    }

    if (!targetPhone) {
      const studentDoc = await StudentModel.findById(
        oid(invoice.studentId),
      ).lean();
      if (studentDoc && studentDoc.phone) {
        targetPhone = studentDoc.phone;
      }
    }

    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');

    const alertText =
      `🚨 *SECURITY & FRAUD ALERT (InstituteOS Finance)* 🚨\n\n` +
      `Accountant/Staff Invoice *${invoice.invoiceNumber}* ` +
      `(Student: *${invoice.studentName || 'Student'}*) ko DELETE karne ki koshish kar raha hai!\n\n` +
      `💰 *Total Bill:* Rs. ${invoice.totalAmount.toFixed(2)}\n` +
      `💵 *Wasool Shuda Raqam (Paid):* Rs. ${invoice.paidAmount.toFixed(2)}\n\n` +
      `⚠️ *SAKHT HIDAYAT:* Agar yeh koi Test ya ghalti se bani hui entry hai, tabhi neeche diya gaya OTP share karein. ` +
      `Agar yeh asli fee thi, toh *OTP HARGIZ SHARE NA KAREIN* aur foran cash audit karein (chori ya fraud ka khadsha ho sakta hai)!\n\n` +
      `🔑 *Owner Approval OTP:* *${otpCode}* (Valid for ${expiresInMinutes} mins)`;

    const whatsAppAlertUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(alertText)}`
      : `https://wa.me/?text=${encodeURIComponent(alertText)}`;

    console.warn('\n========================================================');
    console.warn(alertText);
    console.warn('Target WhatsApp Phone:', cleanPhone || 'Not set');
    console.warn('========================================================\n');

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paidAmount: invoice.paidAmount,
      ownerPhone: cleanPhone || undefined,
      whatsAppAlertUrl,
      expiresInMinutes,
      devOtpPreview: otpCode,
    };
  }

  async deleteInvoice(
    organizationId: string,
    invoiceId: string,
  ): Promise<boolean> {
    const deleted = await StudentInvoiceModel.findOneAndDelete({
      _id: oid(invoiceId),
      organizationId: oid(organizationId),
    }).lean();

    if (!deleted) return false;

    await PaymentReceiptModel.deleteMany({
      organizationId: oid(organizationId),
      invoiceId: oid(invoiceId),
    });

    return true;
  }

  async setInvoiceDiscount(
    organizationId: string,
    invoiceId: string,
    applyDiscount: boolean,
  ): Promise<StudentInvoiceRecord | null> {
    const inv = await StudentInvoiceModel.findOne({
      _id: oid(invoiceId),
      organizationId: oid(organizationId),
    }).lean();

    if (!inv) return null;

    const baseFee =
      inv.currentAmount && decimalNumber(inv.currentAmount) > 0
        ? decimalNumber(inv.currentAmount)
        : decimalNumber(inv.totalAmount) + decimalNumber(inv.discountAmount);

    let combinedDiscount = 0;
    const reasons: string[] = [];

    if (applyDiscount) {
      const concessions = await FeeConcessionModel.find({
        organizationId: oid(organizationId),
        studentId: inv.studentId,
        isActive: true,
      }).lean();

      for (const conc of concessions) {
        if (
          conc.academicYearId &&
          String(conc.academicYearId) !== String(inv.academicYearId)
        ) {
          continue;
        }
        const val = decimalNumber(conc.discountValue);
        const disc =
          conc.discountType === 'percentage' ? (baseFee * val) / 100 : val;
        combinedDiscount += disc;
        reasons.push(
          conc.reason ||
            `${conc.concessionType.replace('_', ' ').toUpperCase()} (${conc.discountType === 'percentage' ? `${val}%` : `Rs. ${val}`})`,
        );
      }
    }

    combinedDiscount = Math.min(baseFee, Math.max(0, combinedDiscount));
    const newNetTotal = Math.max(0, baseFee - combinedDiscount);
    const paid = decimalNumber(inv.paidAmount);
    const dueDateObj = new Date(inv.dueDate as Date);
    const now = new Date();

    let newStatus: 'paid' | 'overdue' | 'partial' | 'unpaid' = 'unpaid';
    if (paid >= newNetTotal) {
      newStatus = 'paid';
    } else if (dueDateObj.getTime() < now.getTime()) {
      newStatus = 'overdue';
    } else if (paid > 0) {
      newStatus = 'partial';
    }

    const updated = await StudentInvoiceModel.findOneAndUpdate(
      { _id: oid(invoiceId), organizationId: oid(organizationId) },
      {
        $set: {
          currentAmount: money(baseFee),
          discountAmount: money(combinedDiscount),
          discountReason: reasons.length ? reasons.join(' + ') : undefined,
          arrearsAmount: money(0),
          totalAmount: money(newNetTotal),
          status: newStatus,
        },
      },
      { new: true },
    )
      .populate('studentId', 'firstName lastName phone')
      .populate('feeStructureId', 'name')
      .lean();

    return updated
      ? invoiceRecord(updated as unknown as Record<string, unknown>)
      : null;
  }
}
