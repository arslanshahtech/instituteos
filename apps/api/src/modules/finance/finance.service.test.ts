import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../errors/app-error.js';
import { FinanceService } from './finance.service.js';
import type {
  FeeStructureRecord,
  FinanceRepository,
  PaymentInput,
  StudentInvoiceRecord,
} from './finance.types.js';

const organizationId = '111111111111111111111111';
const secondOrganizationId = '222222222222222222222222';
const campusId = '333333333333333333333333';
const classId = '444444444444444444444444';
const academicYearId = '555555555555555555555555';
const feeStructureId = '666666666666666666666666';
const invoiceId = '777777777777777777777777';
const studentId = '888888888888888888888888';
const userId = '999999999999999999999999';
const context = {
  organizationId,
  campusIds: [campusId],
  role: 'accountant_finance_officer',
  userId,
};

function feeStructure(
  overrides: Partial<FeeStructureRecord> = {},
): FeeStructureRecord {
  return {
    id: feeStructureId,
    organizationId,
    name: 'Grade 4 annual fees',
    academicYearId,
    classId,
    campusId,
    feeHeads: [
      { title: 'Tuition', amount: 1250.25, isOptional: false },
      { title: 'Lab', amount: 75.5, isOptional: false },
      { title: 'Transport', amount: 100, isOptional: true },
    ],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function invoice(
  overrides: Partial<StudentInvoiceRecord> = {},
): StudentInvoiceRecord {
  return {
    id: invoiceId,
    invoiceNumber: 'INV-001',
    studentId,
    studentName: 'Alex Student',
    feeStructureId,
    feeStructureName: 'Grade 4 annual fees',
    classId,
    academicYearId,
    campusId,
    organizationId,
    billingCycle: '2026-term-1',
    dueDate: '2099-09-01T00:00:00.000Z',
    totalAmount: 1325.75,
    paidAmount: 0,
    status: 'unpaid',
    issueDate: '2026-01-01T00:00:00.000Z',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function repository(
  overrides: Partial<FinanceRepository> = {},
): FinanceRepository {
  return {
    validateFeeStructureContext: vi.fn().mockResolvedValue(true),
    listFeeStructures: vi.fn().mockResolvedValue([]),
    getFeeStructure: vi.fn().mockResolvedValue(feeStructure()),
    createFeeStructure: vi.fn(),
    updateFeeStructure: vi.fn(),
    deleteFeeStructure: vi.fn(),
    listInvoices: vi.fn().mockResolvedValue([]),
    getInvoice: vi.fn().mockResolvedValue(invoice()),
    listActiveClassStudents: vi.fn().mockResolvedValue([studentId, userId]),
    createInvoices: vi.fn().mockImplementation(
      async (
        orgId: string,
        _input,
        structure: FeeStructureRecord,
        ids: string[],
        _issueDate: string,
        totalAmount: number,
      ) =>
        ids.slice(0, 1).map((id) =>
          invoice({
            organizationId: orgId,
            studentId: id,
            feeStructureId: structure.id,
            totalAmount,
          }),
        ),
    ),
    recordPayment: vi.fn().mockImplementation(
      async (
        orgId: string,
        current: StudentInvoiceRecord,
        payment: PaymentInput,
        recordedBy: string,
      ) => ({
        invoice: {
          ...current,
          organizationId: orgId,
          paidAmount: current.paidAmount + payment.amountPaid,
          status:
            current.paidAmount + payment.amountPaid >= current.totalAmount
              ? 'paid'
              : 'partial',
        },
        receipt: {
          id: 'receipt',
          receiptNumber: 'RCT-001',
          invoiceId: current.id,
          studentId: current.studentId,
          ...payment,
          recordedBy,
          organizationId: orgId,
          createdAt: '',
        },
      }),
    ),
  getStudentFeeLedger: vi.fn().mockResolvedValue(null),
    listActiveStudentConcessions: vi.fn().mockResolvedValue([]),
    saveFeeConcession: vi.fn(),
    deleteFeeConcession: vi.fn().mockResolvedValue(true),
    requestInvoiceDeleteOtp: vi.fn(),
    deleteInvoice: vi.fn().mockResolvedValue(true),
    setInvoiceDiscount: vi.fn(),
    ...overrides,
  };
}

describe('FinanceService', () => {
  it('totals required fee heads in cents when generating a class billing cycle', async () => {
    const repo = repository();
    const result = await new FinanceService(repo).generateInvoices(context, {
      classId,
      academicYearId,
      feeStructureId,
      dueDate: '2026-10-30',
      billingCycle: '2026-term-1',
    });

    expect(repo.createInvoices).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ billingCycle: '2026-term-1' }),
      feeStructure(),
      [studentId, userId],
      expect.any(String),
      1325.75,
    );
    expect(result).toMatchObject({ createdCount: 1, skippedCount: 1 });
  });

  it('records a partial payment and passes the active tenant and operator', async () => {
    const repo = repository();
    const result = await new FinanceService(repo).recordPayment(context, invoiceId, {
      amountPaid: 250.25,
      paymentMethod: 'bank_transfer',
      transactionReference: 'TRX-1',
      paymentDate: new Date().toISOString().slice(0, 10),
    });

    expect(repo.getInvoice).toHaveBeenCalledWith(
      organizationId,
      invoiceId,
      [campusId],
    );
    expect(repo.recordPayment).toHaveBeenCalledWith(
      organizationId,
      expect.anything(),
      expect.objectContaining({
        amountPaid: 250.25,
        paymentMethod: 'bank_transfer',
      }),
      userId,
    );
    expect(result.invoice).toMatchObject({
      paidAmount: 250.25,
      status: 'partial',
    });
  });

  it('marks the invoice paid when the exact remaining balance is collected', async () => {
    const repo = repository({
      getInvoice: vi.fn().mockResolvedValue(
        invoice({ paidAmount: 1325.5, status: 'partial' }),
      ),
    });

    const result = await new FinanceService(repo).recordPayment(context, invoiceId, {
      amountPaid: 0.25,
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().slice(0, 10),
    });

    expect(repo.recordPayment).toHaveBeenCalledWith(
      organizationId,
      expect.anything(),
      expect.objectContaining({ amountPaid: 0.25 }),
      userId,
    );
    expect(result.invoice.status).toBe('paid');
  });

  it('rejects overpayment without creating a receipt', async () => {
    const repo = repository();
    const service = new FinanceService(repo);

    await expect(
      service.recordPayment(context, invoiceId, {
        amountPaid: 1325.76,
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().slice(0, 10),
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE' });

    expect(repo.recordPayment).not.toHaveBeenCalled();
  });

  it('does not expose or record payments for invoices in another organization', async () => {
    const repo = repository({
      getInvoice: vi.fn().mockResolvedValue(null),
    });

    await expect(
      new FinanceService(repo).recordPayment(
        { ...context, organizationId: secondOrganizationId },
        invoiceId,
        {
          amountPaid: 10,
          paymentMethod: 'cash',
          paymentDate: new Date().toISOString().slice(0, 10),
        },
      ),
    ).rejects.toBeInstanceOf(AppError);

    expect(repo.getInvoice).toHaveBeenCalledWith(
      secondOrganizationId,
      invoiceId,
      [campusId],
    );
    expect(repo.recordPayment).not.toHaveBeenCalled();
  });

  it('rejects campus administrators outside their assigned campus', async () => {
    const repo = repository();

    await expect(
      new FinanceService(repo).generateInvoices(
        { ...context, role: 'campus_admin', campusIds: [] },
        {
          classId,
          academicYearId,
          feeStructureId,
          dueDate: '2026-10-30',
          billingCycle: '2026-term-1',
        },
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    expect(repo.listActiveClassStudents).not.toHaveBeenCalled();
    expect(repo.createInvoices).not.toHaveBeenCalled();
  });
});