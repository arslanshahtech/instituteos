import { apiRequest } from '../api/client.js';

export type StaffStatus = 'active' | 'on_leave' | 'terminated' | 'inactive';

export interface StaffRecord {
  id: string;
  organizationId: string;
  campusId?: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  qualification?: string;
  qualifications?: string[];
  subjects?: string[];
  dateOfBirth?: string;
  gender?: string;
  status: StaffStatus;
  role?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export type StaffInput = Omit<
  StaffRecord,
  'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'role'
>;

export interface StaffListResponse {
  items: StaffRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const staffPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/staff`;

export function listStaff(
  organizationId: string,
  input: {
    search?: string;
    department?: string;
    status?: StaffStatus;
    campusId?: string;
    page: number;
    pageSize: number;
  },
): Promise<StaffListResponse> {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search) query.set('search', input.search);
  if (input.department) query.set('department', input.department);
  if (input.status) query.set('status', input.status);
  if (input.campusId) query.set('campusId', input.campusId);
  return apiRequest<StaffListResponse>(`${staffPath(organizationId)}?${query}`);
}

export function getStaff(
  organizationId: string,
  staffId: string,
): Promise<{ staff: StaffRecord }> {
  return apiRequest<{ staff: StaffRecord }>(
    `${staffPath(organizationId)}/${encodeURIComponent(staffId)}`,
  );
}

export function createStaff(
  organizationId: string,
  input: StaffInput,
): Promise<{ staff: StaffRecord }> {
  return apiRequest<{ staff: StaffRecord }>(staffPath(organizationId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStaff(
  organizationId: string,
  staffId: string,
  input: StaffInput,
): Promise<{ staff: StaffRecord }> {
  return apiRequest<{ staff: StaffRecord }>(
    `${staffPath(organizationId)}/${encodeURIComponent(staffId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
