import { apiRequest } from '../api/client.js';

export type InquiryStatus =
  'new' | 'contacted' | 'qualified' | 'converted' | 'closed';
export type ApplicationStatus =
  'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'admitted';

export interface InquiryRecord {
  id: string;
  campusId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  status: InquiryStatus;
  gradeLevelInterest?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRecord {
  id: string;
  campusId?: string;
  inquiryId?: string;
  convertedStudentId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  program?: string;
  status: ApplicationStatus;
  notes?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InquiryInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  gradeLevelInterest?: string;
  campusId?: string;
  notes?: string;
}

export interface ApplicationInput {
  inquiryId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  preferredCampusId?: string;
  program?: string;
  status?: ApplicationStatus;
  notes?: string;
}

export interface AdmissionsQuery {
  search: string;
  status?: InquiryStatus | ApplicationStatus;
  page: number;
  pageSize: number;
}

interface AdmissionsResponse {
  inquiries: PageResult<InquiryRecord>;
  applications: PageResult<ApplicationRecord>;
}

const admissionsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/admissions`;

export async function listInquiries(
  organizationId: string,
  input: AdmissionsQuery,
): Promise<PageResult<InquiryRecord>> {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search.trim()) query.set('search', input.search.trim());
  if (input.status) query.set('inquiryStatus', input.status);
  const response = await apiRequest<AdmissionsResponse>(
    `${admissionsPath(organizationId)}?${query}`,
  );
  return response.inquiries;
}

export async function listApplications(
  organizationId: string,
  input: AdmissionsQuery,
): Promise<PageResult<ApplicationRecord>> {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search.trim()) query.set('search', input.search.trim());
  if (input.status) query.set('applicationStatus', input.status);
  const response = await apiRequest<AdmissionsResponse>(
    `${admissionsPath(organizationId)}?${query}`,
  );
  return response.applications;
}

export function createInquiry(
  organizationId: string,
  input: InquiryInput,
): Promise<{ inquiry: InquiryRecord }> {
  return apiRequest<{ inquiry: InquiryRecord }>(
    `${admissionsPath(organizationId)}/inquiries`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateInquiryStatus(
  organizationId: string,
  inquiryId: string,
  status: InquiryStatus,
): Promise<{ inquiry: InquiryRecord }> {
  return apiRequest<{ inquiry: InquiryRecord }>(
    `${admissionsPath(organizationId)}/inquiries/${encodeURIComponent(inquiryId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
}

export function createApplication(
  organizationId: string,
  input: ApplicationInput,
): Promise<{ application: ApplicationRecord }> {
  return apiRequest<{ application: ApplicationRecord }>(
    `${admissionsPath(organizationId)}/applications`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getApplication(
  organizationId: string,
  applicationId: string,
): Promise<{ application: ApplicationRecord }> {
  return apiRequest<{ application: ApplicationRecord }>(
    `${admissionsPath(organizationId)}/applications/${encodeURIComponent(applicationId)}`,
  );
}

export function reviewApplication(
  organizationId: string,
  applicationId: string,
  input: { status: ApplicationStatus; decisionReason?: string },
): Promise<{
  application: ApplicationRecord;
  student?: { id: string; firstName: string; lastName: string };
}> {
  return apiRequest(
    `${admissionsPath(organizationId)}/applications/${encodeURIComponent(applicationId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
