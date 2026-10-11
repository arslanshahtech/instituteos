export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'online';

export interface FinanceContext {
  organizationId: string;
  campusIds: string[];
  role: string;
  userId: string;
}

export interface FeeHeadInput {
  title: string;
  amount: number;
  isOptional: boolean;
}

export interface FeeStructureInput {
  name: string;
  academicYearId: string;
  classId: string;
  campusId: string;
  feeHeads: FeeHeadInput[];
}

export interface FeeStructureRecord extends FeeStructureInput {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceQuery {
  campusId?: string;
  classId?: string;
  studentId?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface StudentInvoiceRecord {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  feeStructureId: string;
  feeStructureName: string;
  classId: string;
  academicYearId: string;
  campusId: string;
  organizationId: string;
  billingCycle: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  issueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInput {
  amountPaid: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  paymentDate: string;
}

export interface PaymentReceiptRecord extends PaymentInput {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  recordedBy: string;
  organizationId: string;
  createdAt: string;
}

export interface BulkInvoiceInput {
  classId: string;
  academicYearId: string;
  feeStructureId: string;
  dueDate: string;
  billingCycle: string;
}

export interface FinanceRepository {
  validateFeeStructureContext(
    organizationId: string,
    input: FeeStructureInput,
  ): Promise<boolean>;
  listFeeStructures(
    organizationId: string,
    campusIds?: string[],
  ): Promise<FeeStructureRecord[]>;
  getFeeStructure(
    organizationId: string,
    id: string,
  ): Promise<FeeStructureRecord | null>;
  createFeeStructure(
    organizationId: string,
    input: FeeStructureInput,
  ): Promise<FeeStructureRecord>;
  updateFeeStructure(
    organizationId: string,
    id: string,
    input: FeeStructureInput,
  ): Promise<FeeStructureRecord | null>;
  deleteFeeStructure(organizationId: string, id: string): Promise<boolean>;
  listInvoices(
    organizationId: string,
    query: InvoiceQuery,
    campusIds?: string[],
  ): Promise<StudentInvoiceRecord[]>;
  getInvoice(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<StudentInvoiceRecord | null>;
  listActiveClassStudents(
    organizationId: string,
    input: BulkInvoiceInput,
  ): Promise<string[]>;
  createInvoices(
    organizationId: string,
    input: BulkInvoiceInput,
    feeStructure: FeeStructureRecord,
    studentIds: string[],
    issueDate: string,
    totalAmount: number,
  ): Promise<StudentInvoiceRecord[]>;
  recordPayment(
    organizationId: string,
    invoice: StudentInvoiceRecord,
    input: PaymentInput,
    recordedBy: string,
  ): Promise<{
    receipt: PaymentReceiptRecord;
    invoice: StudentInvoiceRecord;
  } | null>;
}
