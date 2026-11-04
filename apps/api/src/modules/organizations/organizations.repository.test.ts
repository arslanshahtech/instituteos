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
import { StaffMemberModel } from '../people/people.model.js';
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

describe('teacher invitation account linking', () => {
  const teacherUserId = '670000000000000000000099';
  const teacherStaffId = '680000000000000000000099';
  const invitationId = '690000000000000000000099';
  const teacherEmail = 'teacher@example.edu';

  function mockTeacherInvitation() {
    const session = makeSession();
    const invite = {
      _id: new Types.ObjectId(invitationId),
      organizationId: new Types.ObjectId(organizationId),
      email: teacherEmail,
      role: 'teacher',
      campusIds: [new Types.ObjectId(campusId)],
      status: 'pending',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    };
    const invitationQuery = {
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(invite),
    };
    const organizationQuery = {
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(organizationId),
        status: 'active',
      }),
    };
    const membershipQuery = {
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    };
    vi.spyOn(OrganizationInvitationModel, 'findOne').mockReturnValue(
      invitationQuery as never,
    );
    vi.spyOn(OrganizationModel, 'findOne').mockReturnValue(
      organizationQuery as never,
    );
    vi.spyOn(MembershipModel, 'findOne').mockReturnValue(
      membershipQuery as never,
    );
    return session;
  }

  it('explains when a valid invitation is opened by a different signed-in email', async () => {
    const session = mockTeacherInvitation();

    await expect(
      new MongoOrganizationRepository().acceptInvitation({
        tokenHash: 'hashed-token',
        userId: teacherUserId,
        email: 'different@example.edu',
        now: new Date('2026-11-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'INVITATION_EMAIL_MISMATCH',
    });

    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('links exactly one active teaching profile in the same transaction as invitation activation', async () => {
    const session = mockTeacherInvitation();
    const profile = {
      _id: new Types.ObjectId(teacherStaffId),
      userId: null,
    };
    const staffListQuery = {
      session: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([profile]),
    };
    const existingLinkQuery = {
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    };
    const linkedProfileQuery = {
      lean: vi.fn().mockResolvedValue({
        ...profile,
        userId: new Types.ObjectId(teacherUserId),
      }),
    };
    vi.spyOn(StaffMemberModel, 'find').mockReturnValue(staffListQuery as never);
    vi.spyOn(StaffMemberModel, 'findOne').mockReturnValue(
      existingLinkQuery as never,
    );
    const linkProfile = vi
      .spyOn(StaffMemberModel, 'findOneAndUpdate')
      .mockReturnValue(linkedProfileQuery as never);
    const membership = {
      _id: new Types.ObjectId('670000000000000000000098'),
      toObject: () => ({
        _id: new Types.ObjectId('670000000000000000000098'),
        role: 'teacher',
      }),
    };
    const createMembership = vi
      .spyOn(MembershipModel, 'create')
      .mockResolvedValue([membership] as never);
    vi.spyOn(OrganizationInvitationModel, 'updateOne').mockResolvedValue({
      modifiedCount: 1,
    } as never);
    const createAudit = vi
      .spyOn(OrganizationAuditEventModel, 'create')
      .mockResolvedValue([] as never);

    const result = await new MongoOrganizationRepository().acceptInvitation({
      tokenHash: 'hashed-token',
      userId: teacherUserId,
      email: teacherEmail,
      now: new Date('2026-11-01T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ role: 'teacher' });
    expect(linkProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: profile._id,
        organizationId: new Types.ObjectId(organizationId),
      }),
      { $set: { userId: new Types.ObjectId(teacherUserId) } },
      { new: true, runValidators: true, session },
    );
    expect(createMembership).toHaveBeenCalledOnce();
    expect(createAudit).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          details: { role: 'teacher', staffId: teacherStaffId },
        }),
      ],
      { session },
    );
    expect(session.withTransaction).toHaveBeenCalledOnce();
  });

  it('rejects teacher activation when no matching active teaching profile exists', async () => {
    const session = mockTeacherInvitation();
    const staffListQuery = {
      session: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(StaffMemberModel, 'find').mockReturnValue(staffListQuery as never);
    const createMembership = vi.spyOn(MembershipModel, 'create');

    await expect(
      new MongoOrganizationRepository().acceptInvitation({
        tokenHash: 'hashed-token',
        userId: teacherUserId,
        email: teacherEmail,
        now: new Date('2026-11-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'TEACHER_STAFF_PROFILE_REQUIRED' });

    expect(createMembership).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});
