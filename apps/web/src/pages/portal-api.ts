import { apiRequest } from '../api/client.js';

export interface StudentPortalRecord {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: string;
  campusName: string;
  className: string;
  sectionName: string;
  attendance: {
    totalMarked: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number | null;
    records: Array<{ date: string | null; status: string; remarks: string }>;
  };
  fees: {
    totalOutstanding: number;
    totalPaid: number;
    totalInvoiced: number;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      billingCycle: string;
      issueDate: string | null;
      dueDate: string | null;
      totalAmount: number;
      paidAmount: number;
      discountAmount: number;
      arrearsAmount: number;
      outstandingAmount: number;
      status: string;
    }>;
    receipts: Array<{
      id: string;
      receiptNumber: string;
      invoiceNumber: string;
      billingCycle: string;
      amountPaid: number;
      paymentMethod: string;
      transactionReference: string;
      paymentDate: string | null;
    }>;
  };
  results: Array<{
    id: string;
    examName: string;
    subjectName: string;
    teacherName?: string;
    date: string | null;
    marksObtained: number | null;
    totalMarks: number;
    percentage: number | null;
    grade: string | null;
    isAbsent: boolean;
  }>;
  resultsAvailable: boolean;
  homework: Array<{
    id: string;
    title: string;
    instructions: string;
    type: string;
    dueDate: string | null;
    assignedDate: string | null;
    totalMarks: number | null;
    subjectName: string;
    teacherName?: string;
  }>;
}

export interface PortalMeResponse {
  role: 'parent_guardian' | 'student';
  guardian?: {
    firstName: string;
    lastName: string;
    displayName: string;
  } | null;
  students: StudentPortalRecord[];
}

export function getPortalMe(organizationId: string): Promise<PortalMeResponse> {
  return apiRequest<PortalMeResponse>(
    `/organizations/${encodeURIComponent(organizationId)}/portal/me`,
  );
}
