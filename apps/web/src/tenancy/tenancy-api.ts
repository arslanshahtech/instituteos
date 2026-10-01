import { apiRequest } from '../api/client.js';

export interface OrganizationAccessContext {
  organizationId: string;
  role: string;
  permissions: string[];
  campusIds: string[];
}

export function getOrganizationAccessContext(
  organizationId: string,
): Promise<OrganizationAccessContext> {
  return apiRequest<OrganizationAccessContext>(
    `/organizations/${encodeURIComponent(organizationId)}/context`,
  );
}
