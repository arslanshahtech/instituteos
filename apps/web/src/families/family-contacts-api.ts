import { apiRequest } from '../api/client.js';
import type { StudentRecord } from '../students/students-api.js';

export type FamilyContactRelationship =
  'father' | 'mother' | 'guardian' | 'other';
export type CommunicationPreference = 'sms' | 'email' | 'both';

export interface FamilyContactRecord {
  id: string;
  firstName: string;
  lastName: string;
  relationship?: FamilyContactRelationship;
  phone?: string;
  email?: string;
  communicationPreference?: CommunicationPreference;
  studentCount?: number;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FamilyContactInput {
  firstName: string;
  lastName: string;
  relationship?: FamilyContactRelationship;
  phone?: string;
  email?: string;
  communicationPreference?: CommunicationPreference;
}

export interface FamilyContactListResponse {
  items: FamilyContactRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FamilyContactStudentRelation {
  id: string;
  relationship: FamilyContactRelationship;
  isPrimary: boolean;
  student: Pick<StudentRecord, 'id' | 'firstName' | 'lastName' | 'campusId'>;
}

export interface StudentFamilyContactRelation {
  id: string;
  relationship: FamilyContactRelationship;
  isPrimary: boolean;
  guardian: FamilyContactRecord;
}

const familyContactsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/guardians`;

export function listFamilyContacts(
  organizationId: string,
  input: { search?: string; page: number; pageSize: number },
): Promise<FamilyContactListResponse> {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search) query.set('search', input.search);
  return apiRequest<FamilyContactListResponse>(
    `${familyContactsPath(organizationId)}?${query.toString()}`,
  );
}

export function getFamilyContact(
  organizationId: string,
  guardianId: string,
): Promise<{
  guardian: FamilyContactRecord;
  students: FamilyContactStudentRelation[];
}> {
  return apiRequest(
    `${familyContactsPath(organizationId)}/${encodeURIComponent(guardianId)}`,
  );
}

export function createFamilyContact(
  organizationId: string,
  input: FamilyContactInput & { studentId?: string },
): Promise<{ guardian: FamilyContactRecord }> {
  return apiRequest(familyContactsPath(organizationId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateFamilyContact(
  organizationId: string,
  guardianId: string,
  input: FamilyContactInput,
): Promise<{ guardian: FamilyContactRecord }> {
  return apiRequest(
    `${familyContactsPath(organizationId)}/${encodeURIComponent(guardianId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listStudentFamilyContacts(
  organizationId: string,
  studentId: string,
): Promise<{ relations: StudentFamilyContactRelation[] }> {
  return apiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}/guardians`,
  );
}

export function linkFamilyContact(
  organizationId: string,
  studentId: string,
  guardianId: string,
  input: { relationship: FamilyContactRelationship; isPrimary: boolean },
): Promise<{ link: unknown }> {
  return apiRequest(
    `${familyContactsPath(organizationId)}/${encodeURIComponent(guardianId)}/links`,
    {
      method: 'POST',
      body: JSON.stringify({ studentId, ...input }),
    },
  );
}

export function unlinkFamilyContact(
  organizationId: string,
  studentId: string,
  guardianId: string,
): Promise<void> {
  return apiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}/families/${encodeURIComponent(guardianId)}`,
    { method: 'DELETE' },
  );
}
