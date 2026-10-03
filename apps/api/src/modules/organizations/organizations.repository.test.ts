import mongoose, { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CampusModel,
  MembershipModel,
  OrganizationAuditEventModel,
  OrganizationInvitationModel,
  OrganizationModel,
  PlatformRoleGrantModel,
} from '../tenancy/tenancy.model.js';
import { AuthUserModel } from '../auth/auth.model.js';
import { MongoOrganizationRepository } from './organizations.repository.js';

const organizationId = '650000000000000000000001';
const secondOrganizationId = '650000000000000000000002';
const archivedOrganizationId = '650000000000000000000003';
const actorUserId = '670000000000000000000001';
const campusId = '660000000000000000000001';

function makeSession() {
  const session = {
    withTransaction: vi.fn(async (operation: () => Promise<void>) => {
      await operation();
    }),
    endSession: vi.fn(async () => undefined),
  } as unknown as mongoose.ClientSession;
  vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  return session;
}

describe('organization repository transactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists active organizations and archived owner organizations for the supplied user', async () => {
    const userObjectId = new Types.ObjectId(actorUserId);
    const organizationObjectId = new Types.ObjectId(organizationId);
    const secondOrganizationObjectId = new Types.ObjectId(secondOrganizationId);
    const archivedOrganizationObjectId = new Types.ObjectId(
      archivedOrganizationId,
    );
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { organizationId: organizationObjectId, role: 'organization_owner' },
        {
          organizationId: secondOrganizationObjectId,
          role: 'teacher',
        },
        {
          organizationId: archivedOrganizationObjectId,
          role: 'organization_owner',
        },
      ]),
    };
    const organizationQuery = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: organizationObjectId,
          name: 'North Institute',
          status: 'active',
        },
        {
          _id: secondOrganizationObjectId,
          name: 'South Academy',
          status: 'active',
        },
        {
          _id: archivedOrganizationObjectId,
          name: 'Archived Institute',
          status: 'archived',
        },
      ]),
    };
    const membershipFind = vi
      .spyOn(MembershipModel, 'find')
      .mockReturnValue(membershipQuery as never);
    const organizationFind = vi
      .spyOn(OrganizationModel, 'find')
      .mockReturnValue(organizationQuery as never);

    const organizations =
      await new MongoOrganizationRepository().listAccessibleOrganizations(
        actorUserId,
      );

    expect(membershipFind).toHaveBeenCalledWith({
      userId: userObjectId,
      status: 'active',
    });
    expect(membershipQuery.select).toHaveBeenCalledWith('organizationId role');
    expect(organizationFind).toHaveBeenCalledWith({
      $or: [
        {
          _id: {
            $in: [
              organizationObjectId,
              secondOrganizationObjectId,
              archivedOrganizationObjectId,
            ],
          },
          status: 'active',
        },
        {
          _id: {
            $in: [organizationObjectId, archivedOrganizationObjectId],
          },
          status: 'archived',
        },
      ],
    });
    expect(organizations).toEqual([
      {
        id: organizationId,
        name: 'North Institute',
        role: 'organization_owner',
        status: 'active',
      },
      {
        id: secondOrganizationId,
        name: 'South Academy',
        role: 'teacher',
        status: 'active',
      },
      {
        id: archivedOrganizationId,
        name: 'Archived Institute',
        role: 'organization_owner',
        status: 'archived',
      },
    ]);
  });

  it('writes campus creation and its audit event in the same transaction', async () => {
    const session = makeSession();
    const campusDocument = {
      _id: new Types.ObjectId(campusId),
      toObject: () => ({
        _id: new Types.ObjectId(campusId),
        organizationId: new Types.ObjectId(organizationId),
        name: 'Main Campus',
      }),
    };
    const createCampus = vi
      .spyOn(CampusModel, 'create')
      .mockResolvedValue([campusDocument] as never);
    const createAudit = vi
      .spyOn(OrganizationAuditEventModel, 'create')
      .mockResolvedValue([] as never);

    const created = await new MongoOrganizationRepository().createCampus(
      organizationId,
      actorUserId,
      { name: 'Main Campus' },
    );

    expect(created.id).toBe(campusId);
    expect(createCampus).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          organizationId: new Types.ObjectId(organizationId),
          name: 'Main Campus',
        }),
      ],
      { session },
    );
    expect(createAudit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          organizationId: new Types.ObjectId(organizationId),
          actorUserId: new Types.ObjectId(actorUserId),
          action: 'campus.created',
        }),
      ],
      { session },
    );
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('writes campus updates and their audit event in the same transaction', async () => {
    const session = makeSession();
    const campusDocument = {
      _id: new Types.ObjectId(campusId),
      organizationId: new Types.ObjectId(organizationId),
      name: 'Updated Campus',
    };
    const updateCampus = vi
      .spyOn(CampusModel, 'findOneAndUpdate')
      .mockReturnValue({
        lean: () => Promise.resolve(campusDocument),
      } as never);
    const createAudit = vi
      .spyOn(OrganizationAuditEventModel, 'create')
      .mockResolvedValue([] as never);

    await new MongoOrganizationRepository().updateCampus(
      organizationId,
      campusId,
      actorUserId,
      { name: 'Updated Campus' },
    );

    expect(updateCampus).toHaveBeenCalledWith(
      {
        _id: campusId,
        organizationId: new Types.ObjectId(organizationId),
      },
      { $set: { name: 'Updated Campus' } },
      { new: true, runValidators: true, session },
    );
    expect(createAudit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: 'campus.settings.updated',
          targetId: new Types.ObjectId(campusId),
        }),
      ],
      { session },
    );
  });

  it('writes organization settings and their audit event in the same transaction', async () => {
    const session = makeSession();
    const organizationDocument = {
      _id: new Types.ObjectId(organizationId),
      name: 'Renamed Institute',
      status: 'active',
    };
    const updateOrganization = vi
      .spyOn(OrganizationModel, 'findOneAndUpdate')
      .mockReturnValue({
        lean: () => Promise.resolve(organizationDocument),
      } as never);
    const createAudit = vi
      .spyOn(OrganizationAuditEventModel, 'create')
      .mockResolvedValue([] as never);

    await new MongoOrganizationRepository().updateOrganization(
      organizationId,
      actorUserId,
      { name: 'Renamed Institute' },
    );

    expect(updateOrganization).toHaveBeenCalledWith(
      { _id: organizationId, status: 'active' },
      { $set: { name: 'Renamed Institute' } },
      { new: true, runValidators: true, session },
    );
    expect(createAudit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: 'organization.settings.updated',
          targetId: new Types.ObjectId(organizationId),
        }),
      ],
      { session },
    );
  });

  it('archives an owned organization with its audit event in one transaction', async () => {
    const session = makeSession();
    const organizationDocument = {
      _id: new Types.ObjectId(organizationId),
      name: 'North Institute',
      status: 'active',
    };
    vi.spyOn(OrganizationModel, 'findById').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(organizationDocument),
    } as never);
    const ownerCheck = vi.spyOn(MembershipModel, 'exists').mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as never);
    const update = vi
      .spyOn(OrganizationModel, 'findOneAndUpdate')
      .mockReturnValue({
        lean: () =>
          Promise.resolve({ ...organizationDocument, status: 'archived' }),
      } as never);
    const createAudit = vi
      .spyOn(OrganizationAuditEventModel, 'create')
      .mockResolvedValue([] as never);

    const archived =
      await new MongoOrganizationRepository().setOwnerOrganizationStatus(
        organizationId,
        actorUserId,
        'active',
        'archived',
      );

    expect(archived).toMatchObject({ status: 'archived' });
    expect(ownerCheck).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(actorUserId),
      role: 'organization_owner',
      status: 'active',
    });
    expect(update).toHaveBeenCalledWith(
      { _id: organizationId, status: 'active' },
      { $set: { status: 'archived' } },
      { new: true, runValidators: true, session },
    );
    expect(createAudit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: 'organization.archived',
          details: { previousStatus: 'active', status: 'archived' },
        }),
      ],
      { session },
    );
  });

  it('permanently deletes only archived organization-owned records and retains a completion audit', async () => {
    const session = makeSession();
    const organizationDocument = {
      _id: new Types.ObjectId(organizationId),
      name: 'North Institute',
      status: 'archived',
    };
    vi.spyOn(OrganizationModel, 'findById').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(organizationDocument),
    } as never);
    vi.spyOn(MembershipModel, 'exists').mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as never);
    const deleteCampuses = vi
      .spyOn(CampusModel, 'deleteMany')
      .mockResolvedValue({ deletedCount: 2 } as never);
    const deleteMemberships = vi
      .spyOn(MembershipModel, 'deleteMany')
      .mockResolvedValue({ deletedCount: 3 } as never);
    const deleteInvitations = vi
      .spyOn(OrganizationInvitationModel, 'deleteMany')
      .mockResolvedValue({ deletedCount: 1 } as never);
    const deletePriorAudit = vi
      .spyOn(OrganizationAuditEventModel, 'deleteMany')
      .mockResolvedValue({ deletedCount: 4 } as never);
    const deleteOrganization = vi
      .spyOn(OrganizationModel, 'deleteOne')
      .mockResolvedValue({ deletedCount: 1 } as never);
    const createAudit = vi
      .spyOn(OrganizationAuditEventModel, 'create')
      .mockResolvedValue([] as never);
    const deleteUsers = vi.spyOn(AuthUserModel, 'deleteMany');
    const deletePlatformGrants = vi.spyOn(PlatformRoleGrantModel, 'deleteMany');

    await new MongoOrganizationRepository().deleteArchivedOrganization(
      organizationId,
      actorUserId,
      'North Institute',
    );

    const tenantFilter = { organizationId: new Types.ObjectId(organizationId) };
    expect(deleteCampuses).toHaveBeenCalledWith(tenantFilter, { session });
    expect(deleteMemberships).toHaveBeenCalledWith(tenantFilter, { session });
    expect(deleteInvitations).toHaveBeenCalledWith(tenantFilter, { session });
    expect(deletePriorAudit).toHaveBeenCalledWith(tenantFilter, { session });
    expect(deleteOrganization).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(organizationId), status: 'archived' },
      { session },
    );
    expect(createAudit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: 'organization.deleted',
          details: {
            campusesDeleted: 2,
            membershipsDeleted: 3,
            invitationsDeleted: 1,
            retainedDeletionEvent: true,
          },
        }),
      ],
      { session },
    );
    expect(deleteUsers).not.toHaveBeenCalled();
    expect(deletePlatformGrants).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('requires the organization to be archived before attempting cleanup', async () => {
    const session = makeSession();
    const organizationDocument = {
      _id: new Types.ObjectId(organizationId),
      name: 'North Institute',
      status: 'active',
    };
    vi.spyOn(OrganizationModel, 'findById').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(organizationDocument),
    } as never);
    vi.spyOn(MembershipModel, 'exists').mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as never);
    const cleanup = vi.spyOn(CampusModel, 'deleteMany');

    await expect(
      new MongoOrganizationRepository().deleteArchivedOrganization(
        organizationId,
        actorUserId,
        'North Institute',
      ),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_MUST_BE_ARCHIVED' });

    expect(cleanup).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('rejects deletion for an active organization or mismatched confirmation before cleanup', async () => {
    const session = makeSession();
    const organizationDocument = {
      _id: new Types.ObjectId(organizationId),
      name: 'North Institute',
      status: 'archived',
    };
    vi.spyOn(OrganizationModel, 'findById').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(organizationDocument),
    } as never);
    vi.spyOn(MembershipModel, 'exists').mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as never);
    const cleanup = vi.spyOn(CampusModel, 'deleteMany');

    await expect(
      new MongoOrganizationRepository().deleteArchivedOrganization(
        organizationId,
        actorUserId,
        'north institute',
      ),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_NAME_CONFIRMATION_FAILED' });

    expect(cleanup).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});
