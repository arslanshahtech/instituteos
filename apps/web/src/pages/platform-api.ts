import { apiRequest } from '../api/client.js';

export interface PlatformOrganization {
  id: string;
  name: string;
  institutionType: 'school' | 'college' | null;
  subdomain: string | null;
  adminEmail: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  studentCount: number;
  plan: 'Starter' | 'Growth' | 'Enterprise' | null;
  mrr: number;
  trialEndsAt: string | null;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
}

export interface PlatformDemoRequest {
  id: string;
  organizationName: string;
  contactName: string;
  email: string;
  phone: string | null;
  studentCountEstimate: number;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'closed';
  createdAt: string;
}

export interface CreatePlatformOrganizationInput {
  name: string;
  institutionType: 'school' | 'college';
  subdomain: string;
  adminEmail: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
}

export function getPlatformOrganizations() {
  return apiRequest<{ organizations: PlatformOrganization[] }>(
    '/platform/organizations',
  );
}

export function createPlatformOrganization(
  input: CreatePlatformOrganizationInput,
) {
  return apiRequest<{
    organization: PlatformOrganization;
    ownerInvitationSent: boolean;
  }>('/platform/organizations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlatformOrganizationDetails(
  organizationId: string,
  input: { name: string; contactEmail: string; phone: string },
) {
  return apiRequest<{ organization: Record<string, unknown> }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/details`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deletePlatformOrganization(
  organizationId: string,
  confirmationName: string,
) {
  return apiRequest<void>(
    `/platform/organizations/${encodeURIComponent(organizationId)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ confirmationName }),
    },
  );
}

export function updatePlatformOrganizationStatus(
  organizationId: string,
  status: PlatformOrganization['status'],
) {
  return apiRequest<{ organization: Record<string, unknown> }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
}

export function getPlatformDemoRequests() {
  return apiRequest<{ requests: PlatformDemoRequest[] }>(
    '/platform/demo-requests',
  );
}
