import mongoose, { Types } from 'mongoose';
import {
  MembershipModel,
  OrganizationModel,
  PlatformRoleGrantModel,
} from './tenancy.model.js';
import type {
  OrganizationAccessRepository,
  OrganizationContext,
  OrganizationMembershipContext,
  OrganizationResourceFilter,
  OrganizationScopedDataStore,
  OrganizationRole,
} from './tenancy.types.js';
import { ORGANIZATION_ROLES } from './tenancy.types.js';

export class MongoOrganizationAccessRepository implements OrganizationAccessRepository {
  async findActiveMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembershipContext | null> {
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(organizationId)
    )
      return null;

    const organizationObjectId = new Types.ObjectId(organizationId);
    const membership = await MembershipModel.findOne({
      organizationId: organizationObjectId,
      userId: new Types.ObjectId(userId),
      status: 'active',
    })
      .select('_id organizationId userId role campusIds')
      .lean();
    if (!membership) return null;
    if (!ORGANIZATION_ROLES.includes(membership.role as OrganizationRole))
      return null;

    const organizationIsActive = await OrganizationModel.exists({
      _id: organizationObjectId,
      status: 'active',
    });
    if (!organizationIsActive) return null;

    return {
      membershipId: String(membership._id),
      organizationId: String(membership.organizationId),
      userId: String(membership.userId),
      role: membership.role as OrganizationRole,
      campusIds: (membership.campusIds ?? []).map(String),
    };
  }

  async hasPlatformRole(
    userId: string,
    role: 'platform_super_admin',
  ): Promise<boolean> {
    if (!mongoose.isValidObjectId(userId)) return false;
    return Boolean(
      await PlatformRoleGrantModel.exists({
        userId: new Types.ObjectId(userId),
        role,
        status: 'active',
      }),
    );
  }
}

export class TenantScopedRepository<T> {
  constructor(private readonly dataStore: OrganizationScopedDataStore<T>) {}

  findById(
    context: OrganizationContext,
    resourceId: string,
  ): Promise<T | null> {
    return this.dataStore.findOne({
      organizationId: context.organizationId,
      resourceId,
    } satisfies OrganizationResourceFilter);
  }

  updateById(
    context: OrganizationContext,
    resourceId: string,
    changes: Partial<T>,
  ): Promise<T | null> {
    return this.dataStore.updateOne(
      {
        organizationId: context.organizationId,
        resourceId,
      } satisfies OrganizationResourceFilter,
      changes,
    );
  }
}
