export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'online';
export type ConcessionType =
  'sibling' | 'staff_child' | 'scholarship' | 'need_based' | 'special';
export type DiscountType = 'percentage' | 'fixed';
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

export interface DailyCollectionRecord {
  date: string;
  amountCollected: number;
  paymentCount: number;
}

export interface StudentInvoiceRecord {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  guardianPhone?: string;
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
  arrearsAmount?: number;
  currentAmount?: number;
  discountAmount?: number;
  discountReason?: string;
}

export interface FeeConcessionInput {
  studentId: string;
  academicYearId?: string;
  concessionType: ConcessionType;
  discountType: DiscountType;
  discountValue: number;
  reason?: string;
  isActive?: boolean;
}

export interface FeeConcessionRecord extends FeeConcessionInput {
  id: string;
  organizationId: string;
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

export interface PaymentNotificationPayload {
  recipientPhone: string;
  recipientName: string;
  messageText: string;
  whatsAppUrl: string;
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
  listDailyCollections(
    organizationId: string,
    dateFrom: string,
    dateTo: string,
    campusIds?: string[],
  ): Promise<DailyCollectionRecord[]>;
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
    notification?: PaymentNotificationPayload;
  } | null>;

  getStudentFeeLedger(
    organizationId: string,
    studentId: string,
  ): Promise<StudentLedgerSummary | null>;

  listActiveStudentConcessions(
    organizationId: string,
    studentIds: string[],
    academicYearId?: string,
  ): Promise<FeeConcessionRecord[]>;

  saveFeeConcession(
    organizationId: string,
    input: FeeConcessionInput,
    id?: string,
  ): Promise<FeeConcessionRecord>;

  deleteFeeConcession(organizationId: string, id: string): Promise<boolean>;

  requestInvoiceDeleteOtp(
    organizationId: string,
    invoice: StudentInvoiceRecord,
    requestedByUserId: string,
    ownerPhone?: string,
  ): Promise<InvoiceDeleteOtpChallenge>;

  deleteInvoice(organizationId: string, invoiceId: string): Promise<boolean>;

  setInvoiceDiscount(
    organizationId: string,
    invoiceId: string,
    applyDiscount: boolean,
  ): Promise<StudentInvoiceRecord | null>;
}

export interface InvoiceDeleteOtpChallenge {
  invoiceId: string;
  invoiceNumber: string;
  paidAmount: number;
  ownerEmail?: string;
  ownerPhone?: string;
  whatsAppAlertUrl?: string;
  expiresInMinutes: number;
  devOtpPreview?: string;
}
export interface StudentLedgerEntry {
  date: string;
  type: 'invoice' | 'payment';
  referenceNumber: string;
  description: string;
  debit: number; // Fee charge hui
  credit: number; // Payment aayi
  balance: number; // Running balance
}

export interface StudentLedgerSummary {
  studentId: string;
  studentName: string;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  entries: StudentLedgerEntry[];
}
