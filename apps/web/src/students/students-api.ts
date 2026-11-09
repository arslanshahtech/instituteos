import { apiRequest } from '../api/client.js';

export type StudentStatus = 'active' | 'inactive' | 'withdrawn';

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  registrationNumber?: string;
  fatherName?: string;
  motherName?: string;
  parentMobile?: string;
  dateOfBirth?: string;
  gender?: string;
  status: StudentStatus;
  contactEmail?: string;
  phone?: string;
  campusId?: string;
  nationality?: string;
  religion?: string;
  birthPlace?: string;
  nationalId?: string;
  specialNeeds?: string;
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
  registrationNumber?: string;
  fatherName?: string;
  motherName?: string;
  parentMobile?: string;
  nationality?: string;
  religion?: string;
  birthPlace?: string;
  nationalId?: string;
  specialNeeds?: string;
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
    classId?: string;
    sectionId?: string;
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
  if (input.classId) query.set('classId', input.classId);
  if (input.sectionId) query.set('sectionId', input.sectionId);
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


export interface EnrollmentWizardInput {
  student: {
    firstName: string; lastName: string; registrationNumber: string;
    preferredName?: string; dateOfBirth?: string; gender?: string;
    contactEmail?: string; phone?: string; fatherName?: string; motherName?: string;
    parentMobile?: string; secondaryNumber?: string; nationality?: string; religion?: string; birthPlace?: string;
    nationalId?: string; specialNeeds?: string;
    address?: { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string };
  };
  parents: Array<{ firstName: string; lastName: string; relationship: 'father' | 'mother' | 'guardian'; phone?: string; email?: string; cnic?: string; occupation?: string; monthlyIncome?: number; isPrimary?: boolean }>;
  enrollment: {
    campusId: string; academicYearId: string; classId: string; sectionId: string;
    startDate?: string; admissionFee?: number; registrationFee?: number; securityDeposit?: number;
    monthlyFee?: number; discountType?: 'fixed' | 'percentage'; discountValue?: number; discountCategory?: string; admissionType?: string; registrationMode?: 'auto' | 'manual'; familyNumber?: string; familyNumberMode?: 'auto' | 'manual'; familyName?: string;
    previousSchool?: string; leavingReason?: string;
  };
}

export function getEnrollmentIdentifiers(organizationId: string) {
  return apiRequest<{ registrationNumber: string; familyNumber: string }>(`${studentsPath(organizationId)}/enrollment-identifiers`);
}

export function enrollStudent(organizationId: string, input: EnrollmentWizardInput) {
  return apiRequest<{ student: Pick<StudentRecord, 'id' | 'firstName' | 'lastName' | 'registrationNumber' | 'status'> }>(
    `${studentsPath(organizationId)}/enroll`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getStudentSummary(organizationId: string) {
  return apiRequest<{ summary: { total: number; girls: number; newAdmissions: number; classes: number } }>(
    `${studentsPath(organizationId)}/summary`,
  );
}


export interface StudentPlacement {
  studentId: string; classId: string; className: string; sectionId: string;
  sectionName: string; academicYearId: string; academicYearName: string; campusId: string; monthlyFee: number; registrationNumber?: string; familyNumber?: string;
}
export function listStudentPlacements(organizationId: string, studentIds: string[], academicYearId?: string) {
  const query = new URLSearchParams();
  if (studentIds.length) query.set('studentIds', studentIds.join(','));
  if (academicYearId) query.set('academicYearId', academicYearId);
  return apiRequest<{ items: StudentPlacement[] }>(`${studentsPath(organizationId)}/placements?${query.toString()}`);
}
