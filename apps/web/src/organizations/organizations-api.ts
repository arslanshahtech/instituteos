import { apiRequest } from '../api/client.js';

export interface OrganizationProfile {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'archived';
  contactEmail?: string;
  phone?: string;
  timezone?: string;
  address?: Record<string, string>;
}

export interface AccessibleOrganization {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'archived';
}

export interface Campus {
  id: string;
  organizationId: string;
  name: string;
  status: 'active' | 'inactive';
  email?: string;
  phone?: string;
  address?: Record<string, string>;
}

export interface OrganizationMember {
  id: string;
  role: string;
  status: 'active' | 'suspended' | 'revoked';
  campusIds: string[];
  user: {
    id: string;
    email: string;
    displayName: string;
    status: string;
  } | null;
}

export interface OrganizationDashboard {
  organization: OrganizationProfile;
  counts: { campuses: number; members: number };
  setupComplete: boolean;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export const ORGANIZATION_ROLES = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
  'teacher',
  'accountant_finance_officer',
  'admissions_reception',
  'student',
  'parent_guardian',
] as const;

const base = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

export function getAccessibleOrganizations() {
  return apiRequest<{ organizations: AccessibleOrganization[] }>(
    '/organizations',
  );
}

export function createOrganization(input: {
  name: string;
  contactEmail?: string;
  phone?: string;
  timezone?: string;
  initialCampus?: { name: string };
}) {
  return apiRequest<{
    organization: OrganizationProfile;
    campus: Campus | null;
  }>('/organizations', { method: 'POST', body: JSON.stringify(input) });
}

export function getOrganizationDashboard(organizationId: string) {
  return apiRequest<OrganizationDashboard>(`${base(organizationId)}/dashboard`);
}

export function updateOrganization(
  organizationId: string,
  changes: Partial<
    Pick<
      OrganizationProfile,
      'name' | 'contactEmail' | 'phone' | 'timezone' | 'address'
    >
  >,
) {
  return apiRequest<{ organization: OrganizationProfile }>(
    `${base(organizationId)}/settings`,
    { method: 'PATCH', body: JSON.stringify(changes) },
  );
}

export function archiveOrganization(organizationId: string) {
  return apiRequest<{ organization: OrganizationProfile }>(
    `${base(organizationId)}/lifecycle/archive`,
    { method: 'PATCH', body: JSON.stringify({}) },
  );
}

export function restoreOrganization(organizationId: string) {
  return apiRequest<{ organization: OrganizationProfile }>(
    `${base(organizationId)}/lifecycle/restore`,
    { method: 'PATCH', body: JSON.stringify({}) },
  );
}

export function deleteOrganization(
  organizationId: string,
  confirmationName: string,
) {
  return apiRequest<void>(base(organizationId), {
    method: 'DELETE',
    body: JSON.stringify({ confirmationName }),
  });
}

export function getCampuses(organizationId: string) {
  return apiRequest<{ campuses: Campus[] }>(`${base(organizationId)}/campuses`);
}

export function createCampus(
  organizationId: string,
  input: {
    name: string;
    phone?: string;
    email?: string;
    address?: Record<string, string>;
  },
) {
  return apiRequest<{ campus: Campus }>(`${base(organizationId)}/campuses`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCampus(
  organizationId: string,
  campusId: string,
  changes: Partial<
    Pick<Campus, 'name' | 'status' | 'phone' | 'email' | 'address'>
  >,
) {
  const statusChange = changes.status !== undefined;
  return apiRequest<{ campus: Campus }>(
    `${base(organizationId)}/campuses/${encodeURIComponent(campusId)}${statusChange ? '/status' : ''}`,
    { method: 'PATCH', body: JSON.stringify(changes) },
  );
}

export function getMembers(organizationId: string) {
  return apiRequest<{ members: OrganizationMember[] }>(
    `${base(organizationId)}/members`,
  );
}

export function updateMember(
  organizationId: string,
  membershipId: string,
  changes: Partial<Pick<OrganizationMember, 'role' | 'status' | 'campusIds'>>,
) {
  return apiRequest<{ member: OrganizationMember }>(
    `${base(organizationId)}/members/${encodeURIComponent(membershipId)}`,
    { method: 'PATCH', body: JSON.stringify(changes) },
  );
}

export function getInvitations(organizationId: string) {
  return apiRequest<{ invitations: OrganizationInvitation[] }>(
    `${base(organizationId)}/invitations`,
  );
}

export function inviteMember(
  organizationId: string,
  input: { email: string; role: string; campusIds: string[] },
) {
  return apiRequest<{ message: string }>(
    `${base(organizationId)}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function acceptOrganizationInvitation(token: string) {
  return apiRequest<{ membership: { organizationId: string } }>(
    '/organizations/invitations/accept',
    { method: 'POST', body: JSON.stringify({ token }) },
  );
}
