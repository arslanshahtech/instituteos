import mongoose, { Types } from 'mongoose';
import { AuthUserModel } from '../auth/auth.model.js';
import { StaffMemberModel } from '../people/people.model.js';
import {
  CampusModel,
  MembershipModel,
  OrganizationAuditEventModel,
  OrganizationInvitationModel,
  OrganizationModel,
} from '../tenancy/tenancy.model.js';
import { AppError } from '../../errors/app-error.js';
import type {
  CampusInput,
  MemberUpdateInput,
  AccessibleOrganization,
  OrganizationProfileInput,
  OrganizationRepository,
  ProvisionOrganizationInput,
} from './organizations.types.js';
import type { OrganizationRole } from '../tenancy/tenancy.types.js';
import { ORGANIZATION_ROLES } from '../tenancy/tenancy.types.js';
import { permissionsForMembership } from '../tenancy/authorization.js';

function idObject(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function serialize(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) return null;
  const { _id, __v: _version, tokenHash: _tokenHash, ...fields } = value;
  void _version;
  void _tokenHash;
  return { id: String(_id), ...fields };
}

function serializeMany(
  values: Record<string, unknown>[],
): Record<string, unknown>[] {
  return values.map((value) => serialize(value)!).filter(Boolean);
}

async function saveAudit(
  input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    targetId?: string;
    details?: Record<string, unknown>;
  },
  session?: mongoose.ClientSession,
): Promise<void> {
  await OrganizationAuditEventModel.create(
    [
      {
        organizationId: idObject(input.organizationId),
        actorUserId: idObject(input.actorUserId),
        action: input.action,
        targetId: input.targetId ? idObject(input.targetId) : null,
        details: input.details ?? {},
      },
    ],
    session ? { session } : undefined,
  );
}

export class MongoOrganizationRepository implements OrganizationRepository {
  async provisionOrganization(
    userId: string,
    input: ProvisionOrganizationInput,
  ): Promise<{
    organization: Record<string, unknown>;
    campus: Record<string, unknown> | null;
  }> {
    const session = await mongoose.startSession();
    let result: {
      organization: Record<string, unknown>;
      campus: Record<string, unknown> | null;
    } | null = null;
    try {
      await session.withTransaction(async () => {
        const [organization] = await OrganizationModel.create(
          [
            {
              name: input.name,
              institutionType: input.institutionType,
              contactEmail: input.contactEmail,
              phone: input.phone,
              address: input.address,
              timezone: input.timezone ?? 'UTC',
              status: 'active',
              createdByUserId: idObject(userId),
            },
          ],
          { session },
        );
        let campusDoc = null;
        if (input.initialCampus) {
          [campusDoc] = await CampusModel.create(
            [
              {
                ...input.initialCampus,
                organizationId: organization._id,
                status: input.initialCampus.status ?? 'active',
              },
            ],
            { session },
          );
        }
        await MembershipModel.create(
          [
            {
              organizationId: organization._id,
              userId: idObject(userId),
              role: 'organization_owner',
              status: 'active',
              campusIds: [],
            },
          ],
          { session },
        );
        await saveAudit(
          {
            organizationId: String(organization._id),
            actorUserId: userId,
            action: 'organization.created',
            targetId: String(organization._id),
            details: { initialCampusCreated: Boolean(campusDoc) },
          },
          session,
        );
        result = {
          organization: serialize(organization.toObject())!,
          campus: campusDoc ? serialize(campusDoc.toObject()) : null,
        };
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw new Error('Organization provisioning did not complete.');
    return result;
  }

  async findOrganization(organizationId: string) {
    return serialize(
      (await OrganizationModel.findById(organizationId).lean()) as Record<
        string,
        unknown
      > | null,
    );
  }

  async listAccessibleOrganizations(userId: string) {
    const memberships = (await MembershipModel.find({
      userId: idObject(userId),
      status: 'active',
    })
      .select('organizationId role')
      .lean()) as Array<{
      organizationId: Types.ObjectId;
      role: OrganizationRole;
    }>;
    if (memberships.length === 0) return [];
    const validMemberships = memberships.filter((membership) =>
      ORGANIZATION_ROLES.includes(membership.role),
    );
    if (validMemberships.length === 0) return [];

    const rolesByOrganization = new Map<string, OrganizationRole>(
      validMemberships.map((membership) => [
        String(membership.organizationId),
        membership.role,
      ]),
    );
    const ownerOrganizationIds = validMemberships
      .filter((membership) => membership.role === 'organization_owner')
      .map((membership) => membership.organizationId);
    const organizations = (await OrganizationModel.find({
      $or: [
        {
          _id: {
            $in: validMemberships.map(
              (membership) => membership.organizationId,
            ),
          },
          status: 'active',
        },
        { _id: { $in: ownerOrganizationIds }, status: 'archived' },
      ],
    })
      .select('_id name status')
      .sort({ name: 1 })
      .lean()) as Array<Record<string, unknown>>;

    return organizations.flatMap((organization): AccessibleOrganization[] => {
      const role = rolesByOrganization.get(String(organization._id));
      return role
        ? [
            {
              id: String(organization._id),
              name: String(organization.name),
              role,
              status: organization.status as 'active' | 'archived',
            },
          ]
        : [];
    });
  }

  async updateOrganization(
    organizationId: string,
    actorUserId: string,
    changes: Partial<OrganizationProfileInput>,
  ) {
    const session = await mongoose.startSession();
    let updated: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        updated = serialize(
          (await OrganizationModel.findOneAndUpdate(
            { _id: organizationId, status: 'active' },
            { $set: changes },
            { new: true, runValidators: true, session },
          ).lean()) as Record<string, unknown> | null,
        );
        if (updated)
          await saveAudit(
            {
              organizationId,
              actorUserId,
              action: 'organization.settings.updated',
              targetId: organizationId,
              details: { fields: Object.keys(changes) },
            },
            session,
          );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async setOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    status: 'active' | 'suspended' | 'archived',
  ) {
    const session = await mongoose.startSession();
    let updated: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        updated = serialize(
          (await OrganizationModel.findByIdAndUpdate(
            organizationId,
            { $set: { status } },
            { new: true, runValidators: true, session },
          ).lean()) as Record<string, unknown> | null,
        );
        if (updated)
          await saveAudit(
            {
              organizationId,
              actorUserId,
              action: 'organization.status.updated',
              targetId: organizationId,
              details: { status },
            },
            session,
          );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async setOwnerOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    expectedStatus: 'active' | 'archived',
    status: 'archived' | 'active',
  ) {
    const session = await mongoose.startSession();
    let updated: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        const organization = (await OrganizationModel.findById(organizationId)
          .session(session)
          .lean()) as Record<string, unknown> | null;
        if (!organization)
          throw new AppError(
            404,
            'ORGANIZATION_NOT_FOUND',
            'Organization not found.',
          );

        const owner = await MembershipModel.exists({
          organizationId: idObject(organizationId),
          userId: idObject(actorUserId),
          role: 'organization_owner',
          status: 'active',
        }).session(session);
        if (!owner)
          throw new AppError(
            403,
            'ORGANIZATION_OWNER_REQUIRED',
            'Only an active organization owner can change its lifecycle.',
          );
        if (organization.status !== expectedStatus)
          throw new AppError(
            409,
            'ORGANIZATION_STATUS_CONFLICT',
            `Only a ${expectedStatus} organization can be ${status === 'archived' ? 'archived' : 'restored'}.`,
          );

        updated = serialize(
          (await OrganizationModel.findOneAndUpdate(
            { _id: organizationId, status: expectedStatus },
            { $set: { status } },
            { new: true, runValidators: true, session },
          ).lean()) as Record<string, unknown> | null,
        );
        if (!updated)
          throw new AppError(
            409,
            'ORGANIZATION_STATUS_CONFLICT',
            'Organization status changed before the operation completed.',
          );
        await saveAudit(
          {
            organizationId,
            actorUserId,
            action:
              status === 'archived'
                ? 'organization.archived'
                : 'organization.restored',
            targetId: organizationId,
            details: { previousStatus: expectedStatus, status },
          },
          session,
        );
      });
      if (!updated)
        throw new Error('Organization lifecycle update did not complete.');
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async deleteArchivedOrganization(
    organizationId: string,
    actorUserId: string,
    confirmationName: string,
  ): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const organization = (await OrganizationModel.findById(organizationId)
          .session(session)
          .lean()) as Record<string, unknown> | null;
        if (!organization)
          throw new AppError(
            404,
            'ORGANIZATION_NOT_FOUND',
            'Organization not found.',
          );
        if (organization.status !== 'archived')
          throw new AppError(
            409,
            'ORGANIZATION_MUST_BE_ARCHIVED',
            'Archive the organization before permanently deleting it.',
          );
        if (confirmationName !== organization.name)
          throw new AppError(
            400,
            'ORGANIZATION_NAME_CONFIRMATION_FAILED',
            'Enter the exact organization name to confirm deletion.',
          );

        const campuses = await CampusModel.deleteMany(
          { organizationId: idObject(organizationId) },
          { session },
        );
        const memberships = await MembershipModel.deleteMany(
          { organizationId: idObject(organizationId) },
          { session },
        );
        const invitations = await OrganizationInvitationModel.deleteMany(
          { organizationId: idObject(organizationId) },
          { session },
        );
        await OrganizationAuditEventModel.deleteMany(
          { organizationId: idObject(organizationId) },
          { session },
        );
        const deletion = await OrganizationModel.deleteOne(
          { _id: idObject(organizationId), status: 'archived' },
          { session },
        );
        if (deletion.deletedCount !== 1)
          throw new AppError(
            409,
            'ORGANIZATION_DELETE_CONFLICT',
            'The organization could not be deleted in its current state.',
          );
        await saveAudit(
          {
            organizationId,
            actorUserId,
            action: 'organization.deleted',
            targetId: organizationId,
            details: {
              campusesDeleted: campuses.deletedCount,
              membershipsDeleted: memberships.deletedCount,
              invitationsDeleted: invitations.deletedCount,
              retainedDeletionEvent: true,
            },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async getDashboardCounts(organizationId: string) {
    const organization = idObject(organizationId);
    const [campuses, members] = await Promise.all([
      CampusModel.countDocuments({
        organizationId: organization,
        status: 'active',
      }),
      MembershipModel.countDocuments({
        organizationId: organization,
        status: 'active',
      }),
    ]);
    return { campuses, members };
  }

  async listCampuses(organizationId: string, campusIds?: string[]) {
    const filter: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (campusIds) filter._id = { $in: campusIds.map(idObject) };
    return serializeMany(
      (await CampusModel.find(filter).sort({ name: 1 }).lean()) as Record<
        string,
        unknown
      >[],
    );
  }

  async createCampus(
    organizationId: string,
    actorUserId: string,
    input: CampusInput,
  ): Promise<Record<string, unknown>> {
    const session = await mongoose.startSession();
    let created: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        const [campus] = await CampusModel.create(
          [
            {
              ...input,
              organizationId: idObject(organizationId),
              status: input.status ?? 'active',
            },
          ],
          { session },
        );
        created = serialize(campus.toObject());
        await saveAudit(
          {
            organizationId,
            actorUserId,
            action: 'campus.created',
            targetId: String(campus._id),
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    if (!created) throw new Error('Campus creation did not complete.');
    return created;
  }

  async findCampus(organizationId: string, campusId: string) {
    return serialize(
      (await CampusModel.findOne({
        _id: campusId,
        organizationId: idObject(organizationId),
      }).lean()) as Record<string, unknown> | null,
    );
  }

  async updateCampus(
    organizationId: string,
    campusId: string,
    actorUserId: string,
    changes: Partial<CampusInput>,
  ) {
    const session = await mongoose.startSession();
    let updated: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        updated = serialize(
          (await CampusModel.findOneAndUpdate(
            { _id: campusId, organizationId: idObject(organizationId) },
            { $set: changes },
            { new: true, runValidators: true, session },
          ).lean()) as Record<string, unknown> | null,
        );
        if (updated)
          await saveAudit(
            {
              organizationId,
              actorUserId,
              action: changes.status
                ? 'campus.status.updated'
                : 'campus.settings.updated',
              targetId: campusId,
              details: { fields: Object.keys(changes) },
            },
            session,
          );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async listMembers(organizationId: string, campusIds?: string[]) {
    const filter: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (campusIds) filter.campusIds = { $in: campusIds.map(idObject) };
    const memberships = (await MembershipModel.find(filter)
      .select(
        '_id organizationId userId role status campusIds permissions createdAt updatedAt',
      )
      .sort({ createdAt: 1 })
      .lean()) as Record<string, unknown>[];
    const userIds = memberships.map((membership) => membership.userId);
    const users = (await AuthUserModel.find({ _id: { $in: userIds } })
      .select('_id email displayName status emailVerifiedAt')
      .lean()) as Record<string, unknown>[];
    const byId = new Map(users.map((user) => [String(user._id), user]));
    return memberships.map((membership) => ({
      ...serialize(membership)!,
      campusIds: ((membership.campusIds ?? []) as unknown[]).map(String),
      permissions: permissionsForMembership(
        membership.role as OrganizationRole,
        Array.isArray(membership.permissions)
          ? (membership.permissions as string[])
          : undefined,
      ),
      user: serialize(byId.get(String(membership.userId)) ?? null),
    }));
  }

  async findMember(organizationId: string, membershipId: string) {
    return serialize(
      (await MembershipModel.findOne({
        _id: membershipId,
        organizationId: idObject(organizationId),
      }).lean()) as Record<string, unknown> | null,
    );
  }

  async countActiveOwners(organizationId: string): Promise<number> {
    return MembershipModel.countDocuments({
      organizationId: idObject(organizationId),
      role: 'organization_owner',
      status: 'active',
    });
  }

  async updateMember(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    changes: MemberUpdateInput,
  ) {
    const session = await mongoose.startSession();
    let updated: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        const before = (await MembershipModel.findOne({
          _id: membershipId,
          organizationId: idObject(organizationId),
        })
          .session(session)
          .lean()) as Record<string, unknown> | null;
        if (!before) return;
        const removesActiveOwner =
          before.role === 'organization_owner' &&
          before.status === 'active' &&
          ((changes.role !== undefined &&
            changes.role !== 'organization_owner') ||
            (changes.status !== undefined && changes.status !== 'active'));
        if (removesActiveOwner) {
          await OrganizationModel.updateOne(
            { _id: idObject(organizationId) },
            { $inc: { ownerMutationRevision: 1 } },
            { session },
          );
          const ownerCount = await MembershipModel.countDocuments({
            organizationId: idObject(organizationId),
            role: 'organization_owner',
            status: 'active',
          }).session(session);
          if (ownerCount <= 1)
            throw new AppError(
              409,
              'LAST_OWNER_REQUIRED',
              'Transfer organization ownership before changing the last active owner.',
            );
        }
        const result = await MembershipModel.findOneAndUpdate(
          { _id: membershipId, organizationId: idObject(organizationId) },
          { $set: changes },
          { new: true, runValidators: true, session },
        ).lean();
        await saveAudit(
          {
            organizationId,
            actorUserId,
            action: 'membership.updated',
            targetId: membershipId,
            details: {
              beforeRole: before.role,
              afterRole: changes.role ?? before.role,
              beforeStatus: before.status,
              afterStatus: changes.status ?? before.status,
              campusScopeChanged: changes.campusIds !== undefined,
            },
          },
          session,
        );
        updated = serialize(result as Record<string, unknown> | null);
      });
    } finally {
      await session.endSession();
    }
    return updated;
  }

  async createInvitation(input: {
    organizationId: string;
    invitedByUserId: string;
    email: string;
    role: import('../tenancy/tenancy.types.js').OrganizationRole;
    campusIds: string[];
    permissions?: import('../tenancy/authorization.js').OrganizationPermission[];
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await OrganizationInvitationModel.updateMany(
          {
            organizationId: idObject(input.organizationId),
            email: input.email,
            status: 'pending',
            expiresAt: { $lte: new Date() },
          },
          { $set: { status: 'revoked' } },
          { session },
        );
        const [invitation] = await OrganizationInvitationModel.create(
          [
            {
              organizationId: idObject(input.organizationId),
              invitedByUserId: idObject(input.invitedByUserId),
              email: input.email,
              role: input.role,
              campusIds: input.campusIds.map(idObject),
              ...(input.permissions !== undefined
                ? { permissions: input.permissions }
                : {}),
              tokenHash: input.tokenHash,
              expiresAt: input.expiresAt,
              status: 'pending',
            },
          ],
          { session },
        );
        await saveAudit(
          {
            organizationId: input.organizationId,
            actorUserId: input.invitedByUserId,
            action: 'membership.invitation.created',
            targetId: String(invitation._id),
            details: { role: input.role, email: input.email },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async revokeInvitation(organizationId: string, email: string): Promise<void> {
    await OrganizationInvitationModel.updateOne(
      { organizationId: idObject(organizationId), email, status: 'pending' },
      { $set: { status: 'revoked' } },
    );
  }

  async listInvitations(organizationId: string) {
    return serializeMany(
      (await OrganizationInvitationModel.find({
        organizationId: idObject(organizationId),
        status: 'pending',
      })
        .select(
          '_id organizationId email role campusIds permissions invitedByUserId status expiresAt createdAt',
        )
        .sort({ createdAt: -1 })
        .lean()) as Record<string, unknown>[],
    );
  }

  async acceptInvitation(input: {
    tokenHash: string;
    userId: string;
    email: string;
    now: Date;
  }) {
    const session = await mongoose.startSession();
    let membership: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        const invite = (await OrganizationInvitationModel.findOne({
          tokenHash: input.tokenHash,
          status: 'pending',
          expiresAt: { $gt: input.now },
        })
          .select('+tokenHash')
          .session(session)
          .lean()) as Record<string, unknown> | null;
        if (!invite || invite.email !== input.email.toLowerCase()) return;
        const organization = await OrganizationModel.findOne({
          _id: invite.organizationId,
          status: 'active',
        })
          .session(session)
          .lean();
        if (!organization) return;
        const existing = (await MembershipModel.findOne({
          organizationId: invite.organizationId,
          userId: idObject(input.userId),
        })
          .session(session)
          .lean()) as Record<string, unknown> | null;
        if (existing?.status === 'active')
          throw new AppError(
            409,
            'ALREADY_ORGANIZATION_MEMBER',
            'This account already has an active organization membership.',
          );

        let linkedTeacherStaffId: Types.ObjectId | undefined;
        if (invite.role === 'teacher') {
          const teacherProfiles = (await StaffMemberModel.find({
            organizationId: invite.organizationId,
            email: input.email.toLowerCase(),
            status: 'active',
            $or: [
              {
                designation: {
                  $regex:
                    '\\b(teacher|lecturer|professor|instructor|tutor|faculty)\\b',
                  $options: 'i',
                },
              },
              { 'subjects.0': { $exists: true } },
            ],
          })
            .session(session)
            .limit(2)
            .lean()) as Record<string, unknown>[];
          if (teacherProfiles.length !== 1) {
            throw new AppError(
              409,
              teacherProfiles.length === 0
                ? 'TEACHER_STAFF_PROFILE_REQUIRED'
                : 'TEACHER_STAFF_PROFILE_AMBIGUOUS',
              teacherProfiles.length === 0
                ? 'Create one active teaching staff profile with this exact email before accepting the teacher invitation.'
                : 'More than one active teaching staff profile uses this email. Ask the administrator to resolve the duplicate before accepting the invitation.',
            );
          }
          const teacherProfile = teacherProfiles[0]!;
          const existingLink = (await StaffMemberModel.findOne({
            organizationId: invite.organizationId,
            userId: idObject(input.userId),
          })
            .session(session)
            .lean()) as Record<string, unknown> | null;
          if (
            (teacherProfile.userId &&
              String(teacherProfile.userId) !== input.userId) ||
            (existingLink &&
              String(existingLink._id) !== String(teacherProfile._id))
          ) {
            throw new AppError(
              409,
              'TEACHER_STAFF_PROFILE_ALREADY_LINKED',
              'This account or staff profile is already linked to another teacher record. Ask the administrator to review the staff account link.',
            );
          }
          const linkedProfile = await StaffMemberModel.findOneAndUpdate(
            {
              _id: teacherProfile._id,
              organizationId: invite.organizationId,
              status: 'active',
              $or: [
                { userId: { $exists: false } },
                { userId: null },
                { userId: idObject(input.userId) },
              ],
            },
            { $set: { userId: idObject(input.userId) } },
            { new: true, runValidators: true, session },
          ).lean();
          if (!linkedProfile) {
            throw new AppError(
              409,
              'TEACHER_STAFF_PROFILE_LINK_CONFLICT',
              'The teacher staff profile changed while the invitation was being accepted. Ask the administrator to retry after reviewing the profile.',
            );
          }
          linkedTeacherStaffId = teacherProfile._id as Types.ObjectId;
        }

        if (existing) {
          membership = serialize(
            (await MembershipModel.findOneAndUpdate(
              { _id: existing._id, organizationId: invite.organizationId },
              {
                $set: {
                  role: invite.role,
                  status: 'active',
                  campusIds: invite.campusIds,
                  ...(Array.isArray(invite.permissions)
                    ? { permissions: invite.permissions }
                    : {}),
                },
                ...(!Array.isArray(invite.permissions)
                  ? { $unset: { permissions: 1 } }
                  : {}),
              },
              { new: true, runValidators: true, session },
            ).lean()) as Record<string, unknown> | null,
          );
        } else {
          const [created] = await MembershipModel.create(
            [
              {
                organizationId: invite.organizationId,
                userId: idObject(input.userId),
                role: invite.role,
                status: 'active',
                campusIds: invite.campusIds,
                ...(Array.isArray(invite.permissions)
                  ? { permissions: invite.permissions }
                  : {}),
              },
            ],
            { session },
          );
          membership = serialize(created.toObject());
        }
        await OrganizationInvitationModel.updateOne(
          { _id: invite._id, status: 'pending' },
          { $set: { status: 'accepted', acceptedAt: input.now } },
          { session },
        );
        await saveAudit(
          {
            organizationId: String(invite.organizationId),
            actorUserId: input.userId,
            action: 'membership.invitation.accepted',
            targetId: String(invite._id),
            details: {
              role: invite.role,
              ...(linkedTeacherStaffId
                ? { staffId: String(linkedTeacherStaffId) }
                : {}),
            },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    return membership;
  }

  recordAudit(input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    targetId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    return saveAudit(input);
  }
}
