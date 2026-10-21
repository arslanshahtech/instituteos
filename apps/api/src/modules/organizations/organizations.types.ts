import type { OrganizationContext } from '../tenancy/tenancy.types.js';
import type { OrganizationRole } from '../tenancy/tenancy.types.js';

export interface AddressInput {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface OrganizationProfileInput {
  name: string;
  adminName?: string;
  shortCode?: string;
  tagline?: string;
  logoDataUrl?: string;
  contactEmail?: string;
  phone?: string;
  address?: AddressInput;
  timezone?: string;
}

export interface CampusInput {
  name: string;
  phone?: string;
  email?: string;
  address?: AddressInput;
  status?: 'active' | 'inactive';
}

export interface ProvisionOrganizationInput extends OrganizationProfileInput {
  initialCampus?: CampusInput;
}

export interface MemberInvitationInput {
  email: string;
  role: OrganizationRole;
  campusIds: string[];
}

export interface MemberUpdateInput {
  role?: OrganizationRole;
  status?: 'active' | 'suspended' | 'revoked';
  campusIds?: string[];
}

export interface AccessibleOrganization {
  id: string;
  name: string;
  role: OrganizationRole;
  status: 'active' | 'archived';
}

export interface OrganizationRepository {
  provisionOrganization(
    userId: string,
    input: ProvisionOrganizationInput,
  ): Promise<{
    organization: Record<string, unknown>;
    campus: Record<string, unknown> | null;
  }>;
  findOrganization(
    organizationId: string,
  ): Promise<Record<string, unknown> | null>;
  listAccessibleOrganizations(
    userId: string,
  ): Promise<AccessibleOrganization[]>;
  updateOrganization(
    organizationId: string,
    actorUserId: string,
    changes: Partial<OrganizationProfileInput>,
  ): Promise<Record<string, unknown> | null>;
  setOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    status: 'active' | 'suspended' | 'archived',
  ): Promise<Record<string, unknown> | null>;
  setOwnerOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    expectedStatus: 'active' | 'archived',
    status: 'archived' | 'active',
  ): Promise<Record<string, unknown> | null>;
  deleteArchivedOrganization(
    organizationId: string,
    actorUserId: string,
    confirmationName: string,
  ): Promise<void>;
  getDashboardCounts(
    organizationId: string,
  ): Promise<{ campuses: number; members: number }>;
  listCampuses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<Record<string, unknown>[]>;
  createCampus(
    organizationId: string,
    actorUserId: string,
    input: CampusInput,
  ): Promise<Record<string, unknown>>;
  findCampus(
    organizationId: string,
    campusId: string,
  ): Promise<Record<string, unknown> | null>;
  updateCampus(
    organizationId: string,
    campusId: string,
    actorUserId: string,
    changes: Partial<CampusInput>,
  ): Promise<Record<string, unknown> | null>;
  listMembers(
    organizationId: string,
    campusIds?: string[],
  ): Promise<Record<string, unknown>[]>;
  findMember(
    organizationId: string,
    membershipId: string,
  ): Promise<Record<string, unknown> | null>;
  countActiveOwners(organizationId: string): Promise<number>;
  updateMember(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    changes: MemberUpdateInput,
  ): Promise<Record<string, unknown> | null>;
  createInvitation(input: {
    organizationId: string;
    invitedByUserId: string;
    email: string;
    role: OrganizationRole;
    campusIds: string[];
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  revokeInvitation(organizationId: string, email: string): Promise<void>;
  listInvitations(organizationId: string): Promise<Record<string, unknown>[]>;
  acceptInvitation(input: {
    tokenHash: string;
    userId: string;
    email: string;
    now: Date;
  }): Promise<Record<string, unknown> | null>;
  recordAudit(input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    targetId?: string;
    details?: Record<string, unknown>;
  }): Promise<void>;
}

export interface OrganizationServices {
  provision(
    userId: string,
    input: ProvisionOrganizationInput,
  ): Promise<{
    organization: Record<string, unknown>;
    campus: Record<string, unknown> | null;
  }>;
  listAccessibleOrganizations(
    userId: string,
  ): Promise<AccessibleOrganization[]>;
  getProfile(context: OrganizationContext): Promise<Record<string, unknown>>;
  updateProfile(
    context: OrganizationContext,
    changes: Partial<OrganizationProfileInput>,
  ): Promise<Record<string, unknown>>;
  dashboard(context: OrganizationContext): Promise<Record<string, unknown>>;
  listCampuses(
    context: OrganizationContext,
  ): Promise<Record<string, unknown>[]>;
  createCampus(
    context: OrganizationContext,
    input: CampusInput,
  ): Promise<Record<string, unknown>>;
  getCampus(
    context: OrganizationContext,
    campusId: string,
  ): Promise<Record<string, unknown>>;
  updateCampus(
    context: OrganizationContext,
    campusId: string,
    changes: Partial<CampusInput>,
  ): Promise<Record<string, unknown>>;
  listMembers(context: OrganizationContext): Promise<Record<string, unknown>[]>;
  updateMember(
    context: OrganizationContext,
    membershipId: string,
    changes: MemberUpdateInput,
  ): Promise<Record<string, unknown>>;
  invite(
    context: OrganizationContext,
    input: MemberInvitationInput,
  ): Promise<void>;
  listInvitations(
    context: OrganizationContext,
  ): Promise<Record<string, unknown>[]>;
  acceptInvitation(
    user: { id: string; email: string },
    token: string,
  ): Promise<Record<string, unknown>>;
  updateOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    status: 'active' | 'suspended' | 'archived',
  ): Promise<Record<string, unknown>>;
  setOwnerOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    expectedStatus: 'active' | 'archived',
    status: 'archived' | 'active',
  ): Promise<Record<string, unknown>>;
  deleteArchivedOrganization(
    organizationId: string,
    actorUserId: string,
    confirmationName: string,
  ): Promise<void>;
}
