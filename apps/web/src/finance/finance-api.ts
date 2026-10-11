import { apiRequest } from '../api/client.js';

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'online';

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
    Object.entries(filters).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );
  return apiRequest<{ items: StudentInvoice[] }>(
    `${financePath(organizationId)}/invoices${query.size ? `?${query}` : ''}`,
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
  }>(
    `${financePath(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
