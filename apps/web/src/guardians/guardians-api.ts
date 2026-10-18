import { apiRequest } from '../api/client.js';
import type { StudentRecord } from '../students/students-api.js';

export type GuardianRelationship = 'father' | 'mother' | 'guardian' | 'other';
export type CommunicationPreference = 'sms' | 'email' | 'both';

export interface GuardianRecord {
  id: string;
  firstName: string;
  lastName: string;
  relationship?: GuardianRelationship;
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

export interface GuardianInput {
  firstName: string;
  lastName: string;
  relationship?: GuardianRelationship;
  phone?: string;
  email?: string;
  communicationPreference?: CommunicationPreference;
}

export interface GuardianListResponse {
  items: GuardianRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GuardianStudentRelation {
  id: string;
  relationship: GuardianRelationship;
  isPrimary: boolean;
  student: Pick<StudentRecord, 'id' | 'firstName' | 'lastName' | 'campusId'>;
}

export interface StudentGuardianRelation {
  id: string;
  relationship: GuardianRelationship;
  isPrimary: boolean;
  guardian: GuardianRecord;
}

const guardiansPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/guardians`;

export function listGuardians(
  organizationId: string,
  input: { search?: string; page: number; pageSize: number },
): Promise<GuardianListResponse> {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search) query.set('search', input.search);
  return apiRequest<GuardianListResponse>(
    `${guardiansPath(organizationId)}?${query.toString()}`,
  );
}

export function getGuardian(
  organizationId: string,
  guardianId: string,
): Promise<{ guardian: GuardianRecord; students: GuardianStudentRelation[] }> {
  return apiRequest(
    `${guardiansPath(organizationId)}/${encodeURIComponent(guardianId)}`,
  );
}

export function createGuardian(
  organizationId: string,
  input: GuardianInput & { studentId?: string },
): Promise<{ guardian: GuardianRecord }> {
  return apiRequest(guardiansPath(organizationId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateGuardian(
  organizationId: string,
  guardianId: string,
  input: GuardianInput,
): Promise<{ guardian: GuardianRecord }> {
  return apiRequest(
    `${guardiansPath(organizationId)}/${encodeURIComponent(guardianId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listStudentGuardians(
  organizationId: string,
  studentId: string,
): Promise<{ relations: StudentGuardianRelation[] }> {
  return apiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}/guardians`,
  );
}

export function linkGuardian(
  organizationId: string,
  studentId: string,
  guardianId: string,
  input: { relationship: GuardianRelationship; isPrimary: boolean },
): Promise<{ link: unknown }> {
  return apiRequest(
    `${guardiansPath(organizationId)}/${encodeURIComponent(guardianId)}/links`,
    {
      method: 'POST',
      body: JSON.stringify({ studentId, ...input }),
    },
  );
}

export function unlinkGuardian(
  organizationId: string,
  studentId: string,
  guardianId: string,
): Promise<void> {
  return apiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}/guardians/${encodeURIComponent(guardianId)}`,
    { method: 'DELETE' },
  );
}
