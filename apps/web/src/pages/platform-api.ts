import { apiRequest } from '../api/client.js';

export interface PlatformOrganization {
  id: string;
  name: string;
  subdomain: string | null;
  adminEmail: string | null;
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

export function getPlatformDemoRequests() {
  return apiRequest<{ requests: PlatformDemoRequest[] }>(
    '/platform/demo-requests',
  );
}
