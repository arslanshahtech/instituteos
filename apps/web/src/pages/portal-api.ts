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
    leave: number;
    percentage: number | null;
    records: Array<{ date: string | null; status: string; remarks: string }>;
  };
  fees: {
    totalOutstanding: number;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      billingCycle: string;
      dueDate: string | null;
      totalAmount: number;
      paidAmount: number;
      outstandingAmount: number;
      status: string;
    }>;
  };
  results: Array<{
    id: string;
    examName: string;
    subjectName: string;
    date: string | null;
    marksObtained: number | null;
    totalMarks: number;
    percentage: number | null;
    grade: string | null;
    isAbsent: boolean;
  }>;
  resultsAvailable: boolean;
}

export interface PortalMeResponse {
  role: 'parent_guardian' | 'student';
  students: StudentPortalRecord[];
}

export function getPortalMe(organizationId: string): Promise<PortalMeResponse> {
  return apiRequest<PortalMeResponse>(
    `/organizations/${encodeURIComponent(organizationId)}/portal/me`,
  );
}
