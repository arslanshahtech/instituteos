import { apiRequest } from '../api/client.js';

export type StudentStatus = 'active' | 'inactive' | 'withdrawn';

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  status: StudentStatus;
  contactEmail?: string;
  phone?: string;
  campusId?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  guardianIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  status?: StudentStatus;
  contactEmail?: string;
  phone?: string;
  campusId?: string;
}

export interface StudentListResponse {
  items: StudentRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export type StudentImportData = Partial<
  Pick<
    StudentInput,
    | 'firstName'
    | 'lastName'
    | 'preferredName'
    | 'dateOfBirth'
    | 'gender'
    | 'contactEmail'
    | 'phone'
    | 'status'
  >
> & {
  fullName?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
};

export interface StudentImportRowInput {
  rowNumber: number;
  data: StudentImportData;
}

export type StudentImportRowStatus =
  'ready' | 'warning' | 'duplicate' | 'error';

export interface StudentImportPreviewRow {
  rowNumber: number;
  status: StudentImportRowStatus;
  input?: StudentInput;
  guardian?: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    relationship?: 'father' | 'mother' | 'guardian' | 'other';
  };
  firstName?: string;
  lastName?: string;
  issues: string[];
  duplicateOf?: string;
}

export interface StudentImportPreviewResponse {
  rows: StudentImportPreviewRow[];
  summary: {
    total: number;
    ready: number;
    warnings: number;
    duplicates: number;
    errors: number;
    importable: number;
  };
}

export interface StudentImportResult {
  rows: Array<{
    rowNumber: number;
    outcome: 'created' | 'skipped' | 'failed';
    message: string;
    studentId?: string;
  }>;
  summary: { total: number; created: number; skipped: number; failed: number };
}

const studentsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/students`;

export function listStudents(
  organizationId: string,
  input: {
    search?: string;
    status?: StudentStatus;
    page: number;
    pageSize: number;
  },
): Promise<StudentListResponse> {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search) query.set('search', input.search);
  if (input.status) query.set('status', input.status);
  return apiRequest<StudentListResponse>(
    `${studentsPath(organizationId)}?${query.toString()}`,
  );
}

export function getStudent(
  organizationId: string,
  studentId: string,
): Promise<{ student: StudentRecord }> {
  return apiRequest<{ student: StudentRecord }>(
    `${studentsPath(organizationId)}/${encodeURIComponent(studentId)}`,
  );
}

export function createStudent(
  organizationId: string,
  input: StudentInput,
): Promise<{ student: StudentRecord }> {
  return apiRequest<{ student: StudentRecord }>(studentsPath(organizationId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStudent(
  organizationId: string,
  studentId: string,
  input: StudentInput,
): Promise<{ student: StudentRecord }> {
  return apiRequest<{ student: StudentRecord }>(
    `${studentsPath(organizationId)}/${encodeURIComponent(studentId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function previewStudentImport(
  organizationId: string,
  input: { rows: StudentImportRowInput[]; campusId?: string },
): Promise<StudentImportPreviewResponse> {
  return apiRequest<StudentImportPreviewResponse>(
    `${studentsPath(organizationId)}/import/preview`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function importStudents(
  organizationId: string,
  input: { rows: StudentImportRowInput[]; campusId?: string },
): Promise<StudentImportResult> {
  return apiRequest<StudentImportResult>(
    `${studentsPath(organizationId)}/import`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
