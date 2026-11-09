import { apiRequest } from '../api/client.js';

export interface FamilyListItem {
  id: string;
  familyNumber: string;
  name: string;
  studentCount: number;
  parentCount: number;
  invoiceCount: number;
  students: Array<{ id: string; name: string }>;
  parents: Array<{ id: string; name: string }>;
  status: 'active';
}
export interface FamilyListResponse {
  items: FamilyListItem[];
  total: number;
  page: number;
  pageSize: number;
}
export interface FamilyDetail {
  family: {
    id: string;
    familyNumber: string;
    name: string;
    invoiceCount: number;
    status: 'active';
  };
  students: Array<{
    id: string;
    name: string;
    registrationNumber: string;
    className: string;
    sectionName: string;
  }>;
  parents: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
    cnic: string;
  }>;
}
const path = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/families`;

export function listFamilies(
  organizationId: string,
  input: { search: string; page: number; pageSize: number },
) {
  const query = new URLSearchParams({
    search: input.search,
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  return apiRequest<FamilyListResponse>(
    `${path(organizationId)}?${query.toString()}`,
  );
}
export function getFamily(organizationId: string, familyId: string) {
  return apiRequest<FamilyDetail>(
    `${path(organizationId)}/${encodeURIComponent(familyId)}`,
  );
}
export function createFamily(
  organizationId: string,
  input: { guardianIds: string[]; studentIds: string[]; name?: string },
) {
  return apiRequest<{ family: { _id: string; familyNumber: string } }>(
    path(organizationId),
    { method: 'POST', body: JSON.stringify(input) },
  );
}
export function updateFamily(
  organizationId: string,
  familyId: string,
  input: { familyNumber: string; name?: string },
) {
  return apiRequest<{
    family: { id: string; familyNumber: string; name: string };
  }>(`${path(organizationId)}/${encodeURIComponent(familyId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
export function deleteFamily(organizationId: string, familyId: string) {
  return apiRequest<void>(
    `${path(organizationId)}/${encodeURIComponent(familyId)}`,
    { method: 'DELETE' },
  );
}
