import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { env } from '../../config/env.js';
import { AuthService, hashOpaqueToken } from '../auth/auth.service.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireAssignedCampusScope,
  requireOrganizationLifecycleOwner,
  requireOrganizationPermission,
  requirePlatformRole,
} from '../tenancy/tenant-context.middleware.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import { MongoOrganizationRepository } from './organizations.repository.js';
import { OrganizationService } from './organizations.service.js';
import { AuthUserModel } from '../auth/auth.model.js';
import {
  MembershipModel,
  OrganizationAuditEventModel,
  OrganizationInvitationModel,
  OrganizationModel,
} from '../tenancy/tenancy.model.js';
import { StudentModel } from '../people/people.model.js';
import type {
  AddressInput,
  CampusInput,
  MemberInvitationInput,
  MemberUpdateInput,
  OrganizationProfileInput,
  OrganizationServices,
  ProvisionOrganizationInput,
} from './organizations.types.js';

interface AuthenticatedResponse {
  auth?: { user?: { id?: string; email?: string } };
  organizationContext?: import('../tenancy/tenancy.types.js').OrganizationContext;
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  field: string,
  min = 1,
  max = 160,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return value.trim();
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, field, 1, max);
}

function email(value: unknown): string {
  const result = requiredString(value, 'email address', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  return result;
}

const addressKeys = [
  'line1',
  'line2',
  'city',
  'region',
  'postalCode',
  'country',
] as const;
function parseAddress(value: unknown): AddressInput | undefined {
  if (value === undefined) return undefined;
  const body = bodyObject(value);
  const address: AddressInput = {};
  for (const key of addressKeys) {
    const parsed = optionalString(
      body[key],
      key,
      key === 'line1' || key === 'line2' ? 160 : 100,
    );
    if (parsed !== undefined) address[key] = parsed;
  }
  return address;
}

function parseOrganizationProfile(
  body: Record<string, unknown>,
  create: boolean,
): OrganizationProfileInput {
  const name = create
    ? requiredString(body.name, 'organization name', 2, 160)
    : optionalString(body.name, 'organization name', 160);
  const adminName =
    body.adminName === ''
      ? ''
      : optionalString(body.adminName, 'organization admin name', 120);
  const shortCode =
    body.shortCode === ''
      ? ''
      : optionalString(body.shortCode, 'organization short code', 24);
  if (shortCode && !/^[a-zA-Z0-9-]+$/.test(shortCode))
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Short code may contain letters, numbers and hyphens only.',
    );
  const tagline =
    body.tagline === ''
      ? ''
      : optionalString(body.tagline, 'organization tagline', 180);
  const logoDataUrl =
    body.logoDataUrl === ''
      ? ''
      : optionalString(body.logoDataUrl, 'organization logo', 500000);
  if (
    logoDataUrl &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logoDataUrl)
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Upload a PNG, JPG or WebP logo image.',
    );
  const contactEmail =
    body.contactEmail === undefined ? undefined : email(body.contactEmail);
  const phone = optionalString(body.phone, 'phone number', 40);
  const address = parseAddress(body.address);
  const timezone = optionalString(body.timezone, 'timezone', 80);
  if (timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter a valid IANA timezone.',
      );
    }
  }
  if (create && !name)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter a valid organization name.',
    );
  return {
    ...(name ? { name } : {}),
    ...(adminName !== undefined ? { adminName } : {}),
    ...(shortCode !== undefined ? { shortCode: shortCode.toUpperCase() } : {}),
    ...(tagline !== undefined ? { tagline } : {}),
    ...(logoDataUrl !== undefined ? { logoDataUrl } : {}),
    ...(contactEmail ? { contactEmail } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(timezone ? { timezone } : {}),
  } as OrganizationProfileInput;
}

function parseCampus(
  value: unknown,
  includeStatus = false,
): Partial<CampusInput> {
  const body = bodyObject(value);
  const name = optionalString(body.name, 'campus name', 160);
  if (name && name.length < 2)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Campus name must be at least 2 characters.',
    );
  const phone = optionalString(body.phone, 'phone number', 40);
  const campusEmail = body.email === undefined ? undefined : email(body.email);
  const address = parseAddress(body.address);
  const status = body.status;
  if (includeStatus && status !== 'active' && status !== 'inactive')
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Campus status must be active or inactive.',
    );
  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(campusEmail ? { email: campusEmail } : {}),
    ...(address ? { address } : {}),
    ...(includeStatus ? { status: status as 'active' | 'inactive' } : {}),
  };
}

function parseCampusIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Campus assignments must be a list of valid campus IDs.',
    );
  return value as string[];
}

function parseRole(value: unknown): OrganizationRole {
  if (
    typeof value !== 'string' ||
    !ORGANIZATION_ROLES.includes(value as OrganizationRole)
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select an approved organization role.',
    );
  return value as OrganizationRole;
}

function parseProvision(value: unknown): ProvisionOrganizationInput {
  const body = bodyObject(value);
  const profile = parseOrganizationProfile(body, true);
  const initialCampus =
    body.initialCampus === undefined
      ? undefined
      : {
          ...parseCampus(body.initialCampus),
          name: requiredString(
            bodyObject(body.initialCampus).name,
            'campus name',
            2,
            160,
          ),
        };
  return { ...profile, ...(initialCampus ? { initialCampus } : {}) };
}

function parseInvitation(value: unknown): MemberInvitationInput {
  const body = bodyObject(value);
  return {
    email: email(body.email),
    role: parseRole(body.role),
    campusIds: parseCampusIds(body.campusIds),
  };
}

function parseMemberUpdate(value: unknown): MemberUpdateInput {
  const body = bodyObject(value);
  const update: MemberUpdateInput = {};
  if (body.role !== undefined) update.role = parseRole(body.role);
  if (body.status !== undefined) {
    if (!['active', 'suspended', 'revoked'].includes(String(body.status)))
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Membership status is invalid.',
      );
    update.status = body.status as MemberUpdateInput['status'];
  }
  if (body.campusIds !== undefined)
    update.campusIds = parseCampusIds(body.campusIds);
  if (Object.keys(update).length === 0)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Provide at least one membership change.',
    );
  return update;
}

function currentUser(response: import('express').Response): {
  id: string;
  email: string;
} {
  const user = (response.locals as AuthenticatedResponse).auth?.user;
  if (!user?.id || !user.email)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  return { id: user.id, email: user.email };
}

function routeParameter(
  request: import('express').Request,
  name: string,
): string {
  const value = request.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function organizationContext(response: import('express').Response) {
  const context = (response.locals as AuthenticatedResponse)
    .organizationContext;
  if (!context)
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  return context;
}

function defaultAuthenticate() {
  const service = new AuthService(
    new MongoAuthRepository(),
    authEmailDelivery,
    {
      sessionTtlDays: env.authSessionTtlDays,
      requireEmailVerification: env.authRequireEmailVerification,
      webAppUrl: env.authWebAppUrl,
    },
  );
  return createAuthenticationMiddleware(service);
}

const organizationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export function createOrganizationRouter(
  service: OrganizationServices = new OrganizationService(
    new MongoOrganizationRepository(),
    authEmailDelivery,
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const resolveLifecycleOwner =
    requireOrganizationLifecycleOwner(accessRepository);

  router.get(
    '/',
    authenticate,
    asyncHandler(async (_request, response) => {
      const user = currentUser(response);
      response.status(200).json({
        organizations: await service.listAccessibleOrganizations(user.id),
      });
    }),
  );

  router.post(
    '/',
    authenticate,
    requirePlatformRole(accessRepository, 'platform_super_admin'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const created = await service.provision(
        currentUser(response).id,
        parseProvision(request.body),
      );
      response.status(201).json(created);
    }),
  );

  router.patch(
    '/:organizationId/lifecycle/archive',
    authenticate,
    csrfProtection,
    resolveLifecycleOwner,
    asyncHandler(async (request, response) => {
      const user = currentUser(response);
      const organization = await service.setOwnerOrganizationStatus(
        routeParameter(request, 'organizationId'),
        user.id,
        'active',
        'archived',
      );
      response.status(200).json({ organization });
    }),
  );

  router.patch(
    '/:organizationId/lifecycle/restore',
    authenticate,
    csrfProtection,
    resolveLifecycleOwner,
    asyncHandler(async (request, response) => {
      const user = currentUser(response);
      const organization = await service.setOwnerOrganizationStatus(
        routeParameter(request, 'organizationId'),
        user.id,
        'archived',
        'active',
      );
      response.status(200).json({ organization });
    }),
  );

  router.delete(
    '/:organizationId',
    authenticate,
    csrfProtection,
    resolveLifecycleOwner,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const confirmationName = body.confirmationName;
      if (
        typeof confirmationName !== 'string' ||
        confirmationName.length < 1 ||
        confirmationName.length > 160
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Enter the exact organization name to confirm deletion.',
        );
      const user = currentUser(response);
      await service.deleteArchivedOrganization(
        routeParameter(request, 'organizationId'),
        user.id,
        confirmationName,
      );
      response.status(204).end();
    }),
  );

  router.post(
    '/invitations/accept',
    authenticate,
    csrfProtection,
    organizationRateLimit,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const token = requiredString(body.token, 'invitation token', 32, 128);
      const membership = await service.acceptInvitation(
        currentUser(response),
        token,
      );
      response.status(200).json({ membership });
    }),
  );

  router.get(
    '/:organizationId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('organization.read'),
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        organization: await service.getProfile(organizationContext(response)),
      });
    }),
  );

  router.get(
    '/:organizationId/dashboard',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('organization.read'),
    asyncHandler(async (_request, response) => {
      response
        .status(200)
        .json(await service.dashboard(organizationContext(response)));
    }),
  );

  router.patch(
    '/:organizationId/settings',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('organization.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const changes = parseOrganizationProfile(request.body, false);
      if (Object.keys(changes).length === 0)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Provide at least one organization setting.',
        );
      response.status(200).json({
        organization: await service.updateProfile(
          organizationContext(response),
          changes,
        ),
      });
    }),
  );

  router.get(
    '/:organizationId/campuses',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('campus.read'),
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        campuses: await service.listCampuses(organizationContext(response)),
      });
    }),
  );

  router.post(
    '/:organizationId/campuses',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('campus.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const campus = await service.createCampus(organizationContext(response), {
        ...parseCampus(request.body),
        name: requiredString(
          bodyObject(request.body).name,
          'campus name',
          2,
          160,
        ),
      });
      response.status(201).json({ campus });
    }),
  );

  router.get(
    '/:organizationId/campuses/:campusId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('campus.read'),
    requireAssignedCampusScope(),
    asyncHandler(async (request, response) => {
      response.status(200).json({
        campus: await service.getCampus(
          organizationContext(response),
          routeParameter(request, 'campusId'),
        ),
      });
    }),
  );

  router.patch(
    '/:organizationId/campuses/:campusId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('campus.update'),
    requireAssignedCampusScope(),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const changes = parseCampus(request.body);
      if (Object.keys(changes).length === 0)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Provide at least one campus setting.',
        );
      response.status(200).json({
        campus: await service.updateCampus(
          organizationContext(response),
          routeParameter(request, 'campusId'),
          changes,
        ),
      });
    }),
  );

  router.patch(
    '/:organizationId/campuses/:campusId/status',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('campus.status.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const changes = parseCampus(request.body, true);
      response.status(200).json({
        campus: await service.updateCampus(
          organizationContext(response),
          routeParameter(request, 'campusId'),
          changes,
        ),
      });
    }),
  );

  router.get(
    '/:organizationId/members',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('member.read'),
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        members: await service.listMembers(organizationContext(response)),
      });
    }),
  );

  router.patch(
    '/:organizationId/members/:membershipId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('member.manage'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const member = await service.updateMember(
        organizationContext(response),
        routeParameter(request, 'membershipId'),
        parseMemberUpdate(request.body),
      );
      response.status(200).json({ member });
    }),
  );

  router.get(
    '/:organizationId/invitations',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('member.manage'),
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        invitations: await service.listInvitations(
          organizationContext(response),
        ),
      });
    }),
  );

  router.post(
    '/:organizationId/invitations',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('member.invite'),
    csrfProtection,
    organizationRateLimit,
    asyncHandler(async (request, response) => {
      await service.invite(
        organizationContext(response),
        parseInvitation(request.body),
      );
      response.status(202).json({
        message:
          'If the invitation can be delivered, instructions will be sent to that address.',
      });
    }),
  );

  return router;
}

export function createPlatformOrganizationRouter(
  service: OrganizationServices = new OrganizationService(
    new MongoOrganizationRepository(),
    authEmailDelivery,
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  router.get(
    '/',
    authenticate,
    requirePlatformRole(accessRepository, 'platform_super_admin'),
    asyncHandler(async (_request, response) => {
      const organizations = await OrganizationModel.find({})
        .select(
          '_id name subdomain plan trialEndsAt status contactEmail createdAt',
        )
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();
      const organizationIds = organizations.map(
        (organization) => organization._id,
      );
      const memberships = organizationIds.length
        ? await MembershipModel.find({
            organizationId: { $in: organizationIds },
            role: 'organization_owner',
            status: 'active',
          })
            .select('organizationId userId')
            .lean()
        : [];
      const userIds = [
        ...new Set(memberships.map((membership) => String(membership.userId))),
      ];
      const users = userIds.length
        ? await AuthUserModel.find({ _id: { $in: userIds } })
            .select('_id email')
            .lean()
        : [];
      const emailByUserId = new Map(
        users.map((user) => [String(user._id), user.email]),
      );
      const ownerEmailByOrganizationId = new Map(
        memberships.map((membership) => [
          String(membership.organizationId),
          emailByUserId.get(String(membership.userId)) ?? null,
        ]),
      );
      const studentCounts = organizationIds.length
        ? await StudentModel.aggregate([
            { $match: { organizationId: { $in: organizationIds } } },
            { $group: { _id: '$organizationId', count: { $sum: 1 } } },
          ])
        : [];
      const studentCountByOrganizationId = new Map(
        studentCounts.map((item) => [String(item._id), item.count as number]),
      );
      const monthlyPrice: Record<string, number> = {
        Starter: 49,
        Growth: 149,
        Enterprise: 399,
      };
      response.status(200).json({
        organizations: organizations.map((organization) => ({
          id: String(organization._id),
          name: organization.name,
          subdomain: organization.subdomain ?? null,
          adminEmail:
            ownerEmailByOrganizationId.get(String(organization._id)) ??
            organization.contactEmail ??
            null,
          studentCount:
            studentCountByOrganizationId.get(String(organization._id)) ?? 0,
          plan: organization.plan ?? null,
          mrr: organization.plan
            ? (monthlyPrice[String(organization.plan)] ?? 0)
            : 0,
          trialEndsAt: organization.trialEndsAt ?? null,
          status: organization.status,
          createdAt: organization.createdAt,
        })),
      });
    }),
  );
  router.post(
    '/',
    authenticate,
    requirePlatformRole(accessRepository, 'platform_super_admin'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const name = requiredString(body.name, 'organization name', 2, 160);
      const adminEmail = email(body.adminEmail);
      const subdomain = requiredString(
        body.subdomain,
        'subdomain',
        3,
        63,
      ).toLowerCase();
      if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(subdomain))
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Use a subdomain with lowercase letters, numbers and internal hyphens.',
        );
      const plan = String(body.plan ?? '');
      if (!['Starter', 'Growth', 'Enterprise'].includes(plan))
        throw new AppError(400, 'VALIDATION_ERROR', 'Choose a valid plan.');
      const duplicate = await OrganizationModel.exists({ subdomain });
      if (duplicate)
        throw new AppError(
          409,
          'ORGANIZATION_CONFLICT',
          'That subdomain is already in use.',
        );
      const actor = currentUser(response);
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const organization = await OrganizationModel.create({
        name,
        subdomain,
        plan,
        status: 'active',
        trialEndsAt,
        contactEmail: adminEmail,
        createdByUserId: actor.id,
      });
      const token = randomBytes(32).toString('base64url');
      let invitationId: string | null = null;
      let auditEventId: string | null = null;
      try {
        const invitation = await OrganizationInvitationModel.create({
          organizationId: organization._id,
          email: adminEmail,
          role: 'organization_owner',
          campusIds: [],
          invitedByUserId: actor.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
        });
        invitationId = String(invitation._id);
        const auditEvent = await OrganizationAuditEventModel.create({
          organizationId: organization._id,
          actorUserId: actor.id,
          action: 'platform.organization.provisioned',
          details: { subdomain, plan, adminEmail, trialEndsAt },
        });
        auditEventId = String(auditEvent._id);
        const delivered = await authEmailDelivery.sendInvitation(
          adminEmail,
          token,
          name,
        );
        if (!delivered)
          throw new AppError(
            503,
            'INVITATION_DELIVERY_UNAVAILABLE',
            'The organization was not created because the owner invitation could not be delivered.',
          );
      } catch (error) {
        if (invitationId)
          await OrganizationInvitationModel.deleteOne({ _id: invitationId });
        if (auditEventId)
          await OrganizationAuditEventModel.deleteOne({ _id: auditEventId });
        await OrganizationModel.deleteOne({ _id: organization._id });
        throw error;
      }
      response.status(201).json({
        organization: {
          id: String(organization._id),
          name: organization.name,
          subdomain: organization.subdomain,
          adminEmail,
          studentCount: 0,
          plan: organization.plan,
          mrr: 0,
          trialEndsAt: organization.trialEndsAt,
          status: organization.status,
          createdAt: organization.createdAt,
        },
        ownerInvitationSent: true,
      });
    }),
  );
  router.patch(
    '/:organizationId/status',
    authenticate,
    requirePlatformRole(accessRepository, 'platform_super_admin'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      if (!['active', 'suspended', 'archived'].includes(String(body.status)))
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Organization status is invalid.',
        );
      const user = currentUser(response);
      const organization = await service.updateOrganizationStatus(
        routeParameter(request, 'organizationId'),
        user.id,
        body.status as 'active' | 'suspended' | 'archived',
      );
      response.status(200).json({ organization });
    }),
  );
  return router;
}

export const organizationRouter = createOrganizationRouter();
export const platformOrganizationRouter = createPlatformOrganizationRouter();
