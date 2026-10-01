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

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type MembershipStatus = 'active' | 'suspended' | 'revoked';
export type OrganizationStatus = 'active' | 'suspended' | 'archived';
export type PlatformRole = 'platform_super_admin';
export type PlatformGrantStatus = 'active' | 'revoked';

export interface OrganizationMembershipContext {
  membershipId: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  campusIds: string[];
}

export interface OrganizationContext extends OrganizationMembershipContext {
  permissions: readonly string[];
}

export interface OrganizationAccessRepository {
  findActiveMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembershipContext | null>;
  hasPlatformRole(userId: string, role: PlatformRole): Promise<boolean>;
}

export interface OrganizationResourceFilter {
  organizationId: string;
  resourceId: string;
}

export interface OrganizationScopedDataStore<T> {
  findOne(filter: OrganizationResourceFilter): Promise<T | null>;
  updateOne(
    filter: OrganizationResourceFilter,
    changes: Partial<T>,
  ): Promise<T | null>;
}
