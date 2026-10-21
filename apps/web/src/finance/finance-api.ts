import { apiRequest } from '../api/client.js';

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'online';
export type ConcessionType =
  'sibling' | 'staff_child' | 'scholarship' | 'need_based' | 'special';
export type DiscountType = 'percentage' | 'fixed';

export interface FeeConcession {
  id: string;
  organizationId: string;
  studentId: string;
  academicYearId?: string;
  concessionType: ConcessionType;
  discountType: DiscountType;
  discountValue: number;
  reason?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface FeeHead {
  title: string;
  amount: number;
  isOptional: boolean;
}

export interface FeeStructure {
  id: string;
  organizationId: string;
  name: string;
  academicYearId: string;
  classId: string;
  campusId: string;
  feeHeads: FeeHead[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentInvoice {
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
  currentAmount?: number;
  discountAmount?: number;
  discountReason?: string;
  arrearsAmount?: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  issueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentLedgerEntry {
  date: string;
  type: 'invoice' | 'payment';
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface StudentLedgerSummary {
  studentId: string;
  studentName: string;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  entries: StudentLedgerEntry[];
}

export interface PaymentNotificationPayload {
  recipientPhone: string;
  recipientName: string;
  messageText: string;
  whatsAppUrl: string;
}

export interface FeeStructureInput {
  name: string;
  academicYearId: string;
  classId: string;
  campusId: string;
  feeHeads: FeeHead[];
}

export interface InvoiceFilters {
  campusId?: string;
  classId?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
}

const financePath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/finance`;

export function listFeeStructures(organizationId: string) {
  return apiRequest<{ items: FeeStructure[] }>(
    `${financePath(organizationId)}/fee-structures`,
  );
}

export function saveFeeStructure(
  organizationId: string,
  input: FeeStructureInput,
  id?: string,
) {
  return apiRequest<{ feeStructure: FeeStructure }>(
    `${financePath(organizationId)}/fee-structures${id ? `/${encodeURIComponent(id)}` : ''}`,
    {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function deleteFeeStructure(organizationId: string, id: string) {
  return apiRequest<void>(
    `${financePath(organizationId)}/fee-structures/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export function listInvoices(
  organizationId: string,
  filters: InvoiceFilters = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
  return apiRequest<{ items: StudentInvoice[] }>(
    `${financePath(organizationId)}/invoices${query.size ? `?${query}` : ''}`,
  );
}

export interface DailyCollectionRecord {
  date: string;
  amountCollected: number;
  paymentCount: number;
}

export function listDailyCollections(
  organizationId: string,
  input: { dateFrom: string; dateTo: string },
) {
  const query = new URLSearchParams(input);
  return apiRequest<{ items: DailyCollectionRecord[] }>(
    `${financePath(organizationId)}/collections/daily?${query}`,
  );
}

export function generateInvoices(
  organizationId: string,
  input: {
    classId: string;
    academicYearId: string;
    feeStructureId: string;
    dueDate: string;
    billingCycle: string;
  },
) {
  return apiRequest<{
    createdCount: number;
    skippedCount: number;
    invoices: StudentInvoice[];
  }>(`${financePath(organizationId)}/invoices/generate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function recordInvoicePayment(
  organizationId: string,
  invoiceId: string,
  input: {
    amountPaid: number;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    paymentDate: string;
  },
) {
  return apiRequest<{
    receipt: {
      id: string;
      receiptNumber: string;
      amountPaid: number;
      paymentMethod: PaymentMethod;
      paymentDate: string;
    };
    invoice: StudentInvoice;
    notification?: PaymentNotificationPayload;
  }>(
    `${financePath(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function getStudentFeeLedger(organizationId: string, studentId: string) {
  return apiRequest<StudentLedgerSummary>(
    `${financePath(organizationId)}/students/${encodeURIComponent(studentId)}/ledger`,
  );
}

export function listStudentConcessions(
  organizationId: string,
  studentId: string,
  academicYearId?: string,
) {
  const query = academicYearId
    ? `?academicYearId=${encodeURIComponent(academicYearId)}`
    : '';
  return apiRequest<{ items: FeeConcession[] }>(
    `${financePath(organizationId)}/students/${encodeURIComponent(studentId)}/concessions${query}`,
  );
}

export function saveFeeConcession(
  organizationId: string,
  input: FeeConcessionInput,
  id?: string,
) {
  return apiRequest<{ concession: FeeConcession }>(
    `${financePath(organizationId)}/concessions`,
    {
      method: 'POST',
      body: JSON.stringify(id ? { ...input, id } : input),
    },
  );
}

export function deleteFeeConcession(
  organizationId: string,
  concessionId: string,
) {
  return apiRequest<void>(
    `${financePath(organizationId)}/concessions/${encodeURIComponent(concessionId)}`,
    { method: 'DELETE' },
  );
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

export function requestInvoiceDeleteOtp(
  organizationId: string,
  invoiceId: string,
) {
  return apiRequest<InvoiceDeleteOtpChallenge>(
    `${financePath(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/delete-otp`,
    { method: 'POST' },
  );
}

export function deleteInvoice(
  organizationId: string,
  invoiceId: string,
  otpCode?: string,
) {
  const query = otpCode?.trim()
    ? `?otp=${encodeURIComponent(otpCode.trim())}`
    : '';
  return apiRequest<void>(
    `${financePath(organizationId)}/invoices/${encodeURIComponent(invoiceId)}${query}`,
    { method: 'DELETE' },
  );
}

export function setInvoiceDiscount(
  organizationId: string,
  invoiceId: string,
  applyDiscount: boolean,
) {
  return apiRequest<{ invoice: StudentInvoice }>(
    `${financePath(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/discount`,
    {
      method: 'PATCH',
      body: JSON.stringify({ applyDiscount }),
    },
  );
}


export type ExpenseCategory =
  | 'salaries'
  | 'utilities'
  | 'stationery'
  | 'maintenance'
  | 'transport'
  | 'supplies'
  | 'other';

export interface FinanceExpense {
  id: string;
  organizationId: string;
  campusId?: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: string;
  reference?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancePayment {
  id: string;
  organizationId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  campusId: string;
  classId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference?: string;
}

export interface FinanceConcessionWithStudent extends FeeConcession {
  studentName: string;
  campusId?: string;
}

export interface FinanceOperationFilters {
  dateFrom?: string;
  dateTo?: string;
  month?: string;
  campusId?: string;
  classId?: string;
  paymentMethod?: PaymentMethod;
  category?: ExpenseCategory;
  academicYearId?: string;
}

function financeQuery(filters: object) {
  const query = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1])),
  );
  return query.size ? `?${query.toString()}` : '';
}

export function listFinancePayments(
  organizationId: string,
  filters: FinanceOperationFilters = {},
) {
  return apiRequest<{ items: FinancePayment[] }>(
    `${financePath(organizationId)}/payments${financeQuery(filters)}`,
  );
}

export function listFinanceExpenses(
  organizationId: string,
  filters: FinanceOperationFilters = {},
) {
  return apiRequest<{ items: FinanceExpense[] }>(
    `${financePath(organizationId)}/expenses${financeQuery(filters)}`,
  );
}

export function createFinanceExpense(
  organizationId: string,
  input: {
    description: string;
    category: ExpenseCategory;
    amount: number;
    paymentMethod: PaymentMethod;
    expenseDate: string;
    campusId?: string;
    reference?: string;
  },
) {
  return apiRequest<{ expense: FinanceExpense }>(
    `${financePath(organizationId)}/expenses`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function deleteFinanceExpense(organizationId: string, expenseId: string) {
  return apiRequest<void>(
    `${financePath(organizationId)}/expenses/${encodeURIComponent(expenseId)}`,
    { method: 'DELETE' },
  );
}

export function listFinanceConcessions(
  organizationId: string,
  filters: Pick<FinanceOperationFilters, 'campusId' | 'academicYearId'> = {},
) {
  return apiRequest<{ items: FinanceConcessionWithStudent[] }>(
    `${financePath(organizationId)}/concessions${financeQuery(filters)}`,
  );
}


export interface FinanceExpenseBudget {
  id: string;
  organizationId: string;
  campusId?: string;
  category: ExpenseCategory;
  month: string;
  budgetAmount: number;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export function listFinanceExpenseBudgets(
  organizationId: string,
  filters: { month: string; campusId?: string },
) {
  return apiRequest<{ items: FinanceExpenseBudget[] }>(
    `${financePath(organizationId)}/expenses/budgets${financeQuery(filters)}`,
  );
}

export function saveFinanceExpenseBudget(
  organizationId: string,
  input: { category: ExpenseCategory; month: string; budgetAmount: number; campusId?: string },
) {
  return apiRequest<{ budget: FinanceExpenseBudget }>(
    `${financePath(organizationId)}/expenses/budgets`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
