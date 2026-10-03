import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import { type OrganizationContext } from '../tenancy/tenancy.types.js';
import type { AuthEmailDelivery } from '../auth/auth.types.js';
import type {
  AccessibleOrganization,
  CampusInput,
  MemberInvitationInput,
  MemberUpdateInput,
  OrganizationProfileInput,
  OrganizationRepository,
  OrganizationServices,
  ProvisionOrganizationInput,
} from './organizations.types.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function requireObjectId(value: string, code: string, message: string): void {
  if (!mongoose.isValidObjectId(value)) throw new AppError(404, code, message);
}

function requireName(name: string): string {
  const value = name.trim();
  if (value.length < 2 || value.length > 160)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Name must be 2 to 160 characters.',
    );
  return value;
}

export class OrganizationService implements OrganizationServices {
  constructor(
    private readonly repository: OrganizationRepository,
    private readonly emailDelivery: AuthEmailDelivery,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async provision(userId: string, input: ProvisionOrganizationInput) {
    requireObjectId(userId, 'ACCOUNT_NOT_FOUND', 'The account is unavailable.');
    try {
      return await this.repository.provisionOrganization(userId, {
        ...input,
        name: requireName(input.name),
        timezone: input.timezone?.trim() || 'UTC',
        ...(input.initialCampus
          ? {
              initialCampus: {
                ...input.initialCampus,
                name: requireName(input.initialCampus.name),
              },
            }
          : {}),
      });
    } catch (error) {
      if (isDuplicateKey(error))
        throw new AppError(
          409,
          'ORGANIZATION_CONFLICT',
          'The organization could not be created with those details.',
        );
      throw error;
    }
  }

  async listAccessibleOrganizations(
    userId: string,
  ): Promise<AccessibleOrganization[]> {
    requireObjectId(userId, 'ACCOUNT_NOT_FOUND', 'The account is unavailable.');
    return this.repository.listAccessibleOrganizations(userId);
  }

  async getProfile(context: OrganizationContext) {
    const organization = await this.repository.findOrganization(
      context.organizationId,
    );
    if (!organization || organization.status !== 'active')
      throw new AppError(
        404,
        'ORGANIZATION_NOT_FOUND',
        'Organization not found.',
      );
    return organization;
  }

  async updateProfile(
    context: OrganizationContext,
    changes: Partial<OrganizationProfileInput>,
  ) {
    const updated = await this.repository.updateOrganization(
      context.organizationId,
      context.userId,
      changes,
    );
    if (!updated)
      throw new AppError(
        404,
        'ORGANIZATION_NOT_FOUND',
        'Organization not found.',
      );
    return updated;
  }

  async dashboard(context: OrganizationContext) {
    const [organization, counts] = await Promise.all([
      this.getProfile(context),
      this.repository.getDashboardCounts(context.organizationId),
    ]);
    return {
      organization,
      counts,
      setupComplete: counts.campuses > 0,
    };
  }

  async listCampuses(context: OrganizationContext) {
    const campuses = await this.repository.listCampuses(
      context.organizationId,
      context.role === 'campus_admin' ? context.campusIds : undefined,
    );
    return context.role === 'campus_admin'
      ? campuses.filter((campus) => campus.status === 'active')
      : campuses;
  }

  async createCampus(context: OrganizationContext, input: CampusInput) {
    try {
      const campus = await this.repository.createCampus(
        context.organizationId,
        context.userId,
        {
          ...input,
          name: requireName(input.name),
        },
      );
      return campus;
    } catch (error) {
      if (isDuplicateKey(error))
        throw new AppError(
          409,
          'CAMPUS_CONFLICT',
          'A campus with those details already exists.',
        );
      throw error;
    }
  }

  async getCampus(context: OrganizationContext, campusId: string) {
    requireObjectId(campusId, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    if (
      context.role === 'campus_admin' &&
      !context.campusIds.includes(campusId)
    )
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    const campus = await this.repository.findCampus(
      context.organizationId,
      campusId,
    );
    if (!campus)
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    if (context.role === 'campus_admin' && campus.status !== 'active')
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    return campus;
  }

  async updateCampus(
    context: OrganizationContext,
    campusId: string,
    changes: Partial<CampusInput>,
  ) {
    requireObjectId(campusId, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    const existing = await this.repository.findCampus(
      context.organizationId,
      campusId,
    );
    if (!existing)
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    if (
      context.role === 'campus_admin' &&
      (!context.campusIds.includes(campusId) || existing.status !== 'active')
    )
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    const updated = await this.repository.updateCampus(
      context.organizationId,
      campusId,
      context.userId,
      changes,
    );
    if (!updated)
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    return updated;
  }

  listMembers(context: OrganizationContext) {
    return this.repository.listMembers(
      context.organizationId,
      context.role === 'campus_admin' ? context.campusIds : undefined,
    );
  }

  async updateMember(
    context: OrganizationContext,
    membershipId: string,
    changes: MemberUpdateInput,
  ) {
    requireObjectId(membershipId, 'MEMBER_NOT_FOUND', 'Member not found.');
    const existing = await this.repository.findMember(
      context.organizationId,
      membershipId,
    );
    if (!existing)
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
    if (
      existing.role === 'organization_owner' &&
      context.role !== 'organization_owner'
    )
      throw new AppError(
        403,
        'ROLE_ASSIGNMENT_DENIED',
        'Only an organization owner can change another owner.',
      );
    if (
      changes.role === 'organization_owner' &&
      context.role !== 'organization_owner'
    )
      throw new AppError(
        403,
        'ROLE_ASSIGNMENT_DENIED',
        'Only an organization owner can assign another owner.',
      );
    if (changes.role === 'campus_admin') {
      const effectiveCampusIds =
        changes.campusIds ??
        (Array.isArray(existing?.campusIds)
          ? existing.campusIds.map(String)
          : []);
      if (effectiveCampusIds.length === 0)
        throw new AppError(
          400,
          'CAMPUS_SCOPE_REQUIRED',
          'Assign at least one campus to a campus administrator.',
        );
    }
    if (changes.campusIds)
      await this.assertCampusesBelong(
        context.organizationId,
        changes.campusIds,
      );
    const updated = await this.repository.updateMember(
      context.organizationId,
      membershipId,
      context.userId,
      changes,
    );
    if (!updated)
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
    return updated;
  }

  async invite(
    context: OrganizationContext,
    input: MemberInvitationInput,
  ): Promise<void> {
    if (
      input.role === 'organization_owner' &&
      context.role !== 'organization_owner'
    )
      throw new AppError(
        403,
        'ROLE_ASSIGNMENT_DENIED',
        'Only an organization owner can invite another owner.',
      );
    if (input.role === 'campus_admin' && input.campusIds.length === 0)
      throw new AppError(
        400,
        'CAMPUS_SCOPE_REQUIRED',
        'Assign at least one campus to a campus administrator.',
      );
    await this.assertCampusesBelong(context.organizationId, input.campusIds);
    const organization = await this.getProfile(context);
    const token = randomBytes(32).toString('base64url');
    try {
      await this.repository.createInvitation({
        organizationId: context.organizationId,
        invitedByUserId: context.userId,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        campusIds: input.campusIds,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(this.now().getTime() + INVITATION_TTL_MS),
      });
    } catch (error) {
      if (isDuplicateKey(error))
        throw new AppError(
          409,
          'INVITATION_PENDING',
          'A pending invitation already exists for that address.',
        );
      throw error;
    }
    const sent = await this.emailDelivery.sendInvitation(
      input.email.trim().toLowerCase(),
      token,
      String(organization.name),
    );
    if (!sent) {
      await this.repository.revokeInvitation(
        context.organizationId,
        input.email.trim().toLowerCase(),
      );
      throw new AppError(
        503,
        'INVITATION_DELIVERY_UNAVAILABLE',
        'The invitation could not be delivered. Try again later.',
      );
    }
  }

  listInvitations(context: OrganizationContext) {
    return this.repository.listInvitations(context.organizationId);
  }

  async acceptInvitation(user: { id: string; email: string }, token: string) {
    if (token.length < 32 || token.length > 128)
      throw new AppError(
        404,
        'INVITATION_UNAVAILABLE',
        'This invitation is invalid or has expired.',
      );
    const membership = await this.repository.acceptInvitation({
      tokenHash: hashOpaqueToken(token),
      userId: user.id,
      email: user.email.toLowerCase(),
      now: this.now(),
    });
    if (!membership)
      throw new AppError(
        404,
        'INVITATION_UNAVAILABLE',
        'This invitation is invalid or has expired.',
      );
    return membership;
  }

  async updateOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    status: 'active' | 'suspended' | 'archived',
  ) {
    requireObjectId(
      organizationId,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
    const updated = await this.repository.setOrganizationStatus(
      organizationId,
      actorUserId,
      status,
    );
    if (!updated)
      throw new AppError(
        404,
        'ORGANIZATION_NOT_FOUND',
        'Organization not found.',
      );
    return updated;
  }

  async setOwnerOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    expectedStatus: 'active' | 'archived',
    status: 'archived' | 'active',
  ) {
    requireObjectId(
      organizationId,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
    requireObjectId(
      actorUserId,
      'ACCOUNT_NOT_FOUND',
      'The account is unavailable.',
    );
    const updated = await this.repository.setOwnerOrganizationStatus(
      organizationId,
      actorUserId,
      expectedStatus,
      status,
    );
    if (!updated)
      throw new AppError(
        409,
        'ORGANIZATION_STATUS_CONFLICT',
        'Organization status changed before the operation completed.',
      );
    return updated;
  }

  async deleteArchivedOrganization(
    organizationId: string,
    actorUserId: string,
    confirmationName: string,
  ): Promise<void> {
    requireObjectId(
      organizationId,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
    requireObjectId(
      actorUserId,
      'ACCOUNT_NOT_FOUND',
      'The account is unavailable.',
    );
    await this.repository.deleteArchivedOrganization(
      organizationId,
      actorUserId,
      confirmationName,
    );
  }

  private async assertCampusesBelong(
    organizationId: string,
    campusIds: string[],
  ) {
    const ids = [...new Set(campusIds)];
    if (ids.length !== campusIds.length)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Campus assignments must be unique.',
      );
    for (const campusId of ids) {
      requireObjectId(campusId, 'CAMPUS_NOT_FOUND', 'Campus not found.');
      if (!(await this.repository.findCampus(organizationId, campusId)))
        throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    }
  }
}
