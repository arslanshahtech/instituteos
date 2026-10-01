import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import {
  MemoryAuthEmailDelivery,
  MemoryAuthRepository,
} from '../auth/auth.test-helpers.js';
import { AppError } from '../../errors/app-error.js';
import { permissionsForOrganizationRole } from './authorization.js';
import {
  requireOrganizationPermission,
  requireOrganizationRole,
  requirePlatformRole,
  createOrganizationContextMiddleware,
} from './tenant-context.middleware.js';
import { createTenancyRouter } from './tenancy.routes.js';
import { TenantScopedRepository } from './tenancy.repository.js';
import { MembershipModel, PlatformRoleGrantModel } from './tenancy.model.js';
import type {
  OrganizationAccessRepository,
  OrganizationContext,
  OrganizationMembershipContext,
  OrganizationResourceFilter,
  OrganizationScopedDataStore,
  OrganizationRole,
  PlatformRole,
} from './tenancy.types.js';

const organizationA = '650000000000000000000001';
const organizationB = '650000000000000000000002';
const organizationC = '650000000000000000000003';
const organizationD = '650000000000000000000004';
const resourceA = '660000000000000000000001';
const resourceB = '660000000000000000000002';

interface FixtureResource {
  resourceId: string;
  organizationId: string;
  value: string;
}

class MemoryOrganizationAccess implements OrganizationAccessRepository {
  readonly organizations = new Map<string, 'active' | 'suspended'>();
  readonly memberships: Array<
    OrganizationMembershipContext & {
      status: 'active' | 'suspended' | 'revoked';
    }
  > = [];
  readonly platformRoles = new Set<string>();

  async findActiveMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembershipContext | null> {
    if (this.organizations.get(organizationId) !== 'active') return null;
    const membership = this.memberships.find(
      (item) =>
        item.userId === userId &&
        item.organizationId === organizationId &&
        item.status === 'active',
    );
    if (!membership) return null;
    return {
      membershipId: membership.membershipId,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
    };
  }

  async hasPlatformRole(userId: string, role: PlatformRole): Promise<boolean> {
    return this.platformRoles.has(`${userId}:${role}`);
  }
}

class MemoryFixtureDataStore implements OrganizationScopedDataStore<FixtureResource> {
  readonly records = new Map<string, FixtureResource>();

  async findOne(filter: OrganizationResourceFilter) {
    const resource = this.records.get(filter.resourceId);
    return resource?.organizationId === filter.organizationId
      ? { ...resource }
      : null;
  }

  async updateOne(
    filter: OrganizationResourceFilter,
    changes: Partial<FixtureResource>,
  ) {
    const resource = this.records.get(filter.resourceId);
    if (!resource || resource.organizationId !== filter.organizationId)
      return null;
    Object.assign(resource, changes);
    return { ...resource };
  }
}

function buildHarness() {
  const authRepository = new MemoryAuthRepository();
  const authService = new AuthService(
    authRepository,
    new MemoryAuthEmailDelivery(),
    {
      sessionTtlDays: 7,
      requireEmailVerification: false,
      webAppUrl: 'http://localhost:5173',
    },
  );
  const accessRepository = new MemoryOrganizationAccess();
  const fixtureStore = new MemoryFixtureDataStore();
  const fixtureRepository = new TenantScopedRepository(fixtureStore);
  accessRepository.organizations.set(organizationA, 'active');
  accessRepository.organizations.set(organizationB, 'active');
  accessRepository.organizations.set(organizationC, 'suspended');
  accessRepository.organizations.set(organizationD, 'active');
  fixtureStore.records.set(resourceA, {
    resourceId: resourceA,
    organizationId: organizationA,
    value: 'organization A resource',
  });
  fixtureStore.records.set(resourceB, {
    resourceId: resourceB,
    organizationId: organizationB,
    value: 'organization B resource',
  });

  const authenticate = createAuthenticationMiddleware(authService);
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/organizations',
    createTenancyRouter(accessRepository, authenticate),
  );
  app.get(
    '/api/v1/organizations/:organizationId/resources/:resourceId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('organization.read'),
    asyncHandler(async (request, response) => {
      const context = response.locals
        .organizationContext as OrganizationContext;
      const resource = await fixtureRepository.findById(
        context,
        String(request.params.resourceId),
      );
      if (!resource)
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
      response.status(200).json({ resource });
    }),
  );
  app.patch(
    '/api/v1/organizations/:organizationId/resources/:resourceId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('organization.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = response.locals
        .organizationContext as OrganizationContext;
      const resource = await fixtureRepository.updateById(
        context,
        String(request.params.resourceId),
        { value: String(request.body.value) },
      );
      if (!resource)
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
      response.status(200).json({ resource });
    }),
  );
  app.get(
    '/api/v1/organizations/:organizationId/owner-action',
    authenticate,
    resolveOrganization,
    requireOrganizationRole(['organization_owner']),
    (_request, response) => response.status(200).json({ allowed: true }),
  );
  app.get(
    '/api/v1/platform/super-admin',
    authenticate,
    requirePlatformRole(accessRepository, 'platform_super_admin'),
    (_request, response) => response.status(200).json({ allowed: true }),
  );
  app.use(errorHandler);

  return { app, authService, accessRepository, fixtureStore };
}

async function addUser(
  authService: AuthService,
  email: string,
): Promise<{ userId: string; cookie: string; csrfToken: string }> {
  await authService.register({
    email,
    displayName: 'Test Member',
    password: 'a sufficiently long test password',
  });
  const session = await authService.login(
    email,
    'a sufficiently long test password',
  );
  return {
    userId: session.user.id,
    cookie: `instituteos_session=${session.sessionToken}; instituteos_csrf=${session.csrfToken}`,
    csrfToken: session.csrfToken,
  };
}

function addMembership(
  repository: MemoryOrganizationAccess,
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  status: 'active' | 'suspended' | 'revoked' = 'active',
) {
  repository.memberships.push({
    membershipId: `${userId}-${organizationId}`,
    userId,
    organizationId,
    role,
    status,
  });
}

describe('organization authorization and tenant isolation', () => {
  it('resolves membership context and permissions for a multi-organization user', async () => {
    const { app, authService, accessRepository } = buildHarness();
    const user = await addUser(authService, 'member@example.test');
    addMembership(
      accessRepository,
      user.userId,
      organizationA,
      'organization_admin',
    );
    addMembership(accessRepository, user.userId, organizationB, 'teacher');

    const adminContext = await request(app)
      .get(`/api/v1/organizations/${organizationA}/context`)
      .set('Cookie', user.cookie);
    const teacherContext = await request(app)
      .get(`/api/v1/organizations/${organizationB}/context`)
      .set('Cookie', user.cookie);

    expect(adminContext.status).toBe(200);
    expect(adminContext.body).toMatchObject({
      organizationId: organizationA,
      role: 'organization_admin',
      permissions: expect.arrayContaining([
        'organization.read',
        'member.invite',
      ]),
    });
    expect(adminContext.body).not.toHaveProperty('membershipId');
    expect(teacherContext.status).toBe(200);
    expect(teacherContext.body).toMatchObject({
      organizationId: organizationB,
      role: 'teacher',
      permissions: ['organization.read', 'student.read'],
    });
  });

  it('allows same-tenant access and blocks cross-tenant read and update IDOR attempts', async () => {
    const { app, authService, accessRepository, fixtureStore } = buildHarness();
    const userA = await addUser(authService, 'a@example.test');
    const userB = await addUser(authService, 'b@example.test');
    addMembership(
      accessRepository,
      userA.userId,
      organizationA,
      'organization_owner',
    );
    addMembership(accessRepository, userA.userId, organizationB, 'teacher');
    addMembership(
      accessRepository,
      userB.userId,
      organizationB,
      'organization_admin',
    );

    const sameTenant = await request(app)
      .get(`/api/v1/organizations/${organizationA}/resources/${resourceA}`)
      .set('Cookie', userA.cookie);
    expect(sameTenant.status).toBe(200);
    expect(sameTenant.body.resource.value).toBe('organization A resource');

    const crossTenantRead = await request(app)
      .get(`/api/v1/organizations/${organizationA}/resources/${resourceB}`)
      .set('Cookie', userA.cookie);
    expect(crossTenantRead.status).toBe(404);
    expect(crossTenantRead.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const crossTenantUpdate = await request(app)
      .patch(`/api/v1/organizations/${organizationA}/resources/${resourceB}`)
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ value: 'tampered' });
    expect(crossTenantUpdate.status).toBe(404);
    expect(fixtureStore.records.get(resourceB)?.value).toBe(
      'organization B resource',
    );

    const userBAccess = await request(app)
      .get(`/api/v1/organizations/${organizationB}/resources/${resourceB}`)
      .set('Cookie', userB.cookie);
    expect(userBAccess.status).toBe(200);
    const reverseCrossTenantRead = await request(app)
      .get(`/api/v1/organizations/${organizationA}/resources/${resourceA}`)
      .set('Cookie', userB.cookie);
    expect(reverseCrossTenantRead.status).toBe(404);
  });

  it('rejects missing, invalid, suspended, and revoked tenant access safely', async () => {
    const { app, authService, accessRepository } = buildHarness();
    const user = await addUser(authService, 'member@example.test');
    const suspendedMember = await addUser(
      authService,
      'suspended@example.test',
    );
    addMembership(accessRepository, user.userId, organizationA, 'teacher');
    addMembership(
      accessRepository,
      user.userId,
      organizationB,
      'teacher',
      'revoked',
    );
    addMembership(accessRepository, user.userId, organizationC, 'teacher');
    addMembership(
      accessRepository,
      suspendedMember.userId,
      organizationB,
      'teacher',
      'suspended',
    );

    expect(
      (await request(app).get(`/api/v1/organizations/${organizationA}/context`))
        .status,
    ).toBe(401);
    const invalidId = await request(app)
      .get('/api/v1/organizations/not-an-id/context')
      .set('Cookie', user.cookie);
    const noMembership = await request(app)
      .get(`/api/v1/organizations/${organizationD}/context`)
      .set('Cookie', user.cookie);
    const revokedMembership = await request(app)
      .get(`/api/v1/organizations/${organizationB}/context`)
      .set('Cookie', user.cookie);
    const suspendedMembership = await request(app)
      .get(`/api/v1/organizations/${organizationB}/context`)
      .set('Cookie', suspendedMember.cookie);
    const suspendedOrganization = await request(app)
      .get(`/api/v1/organizations/${organizationC}/context`)
      .set('Cookie', user.cookie);
    expect(invalidId.status).toBe(404);
    expect(noMembership.status).toBe(404);
    expect(revokedMembership.status).toBe(404);
    expect(suspendedMembership.status).toBe(404);
    expect(suspendedOrganization.status).toBe(404);
    expect(noMembership.body.error.message).toBe(
      revokedMembership.body.error.message,
    );
  });

  it('enforces explicit permission and role checks without role inheritance', async () => {
    const { app, authService, accessRepository } = buildHarness();
    const user = await addUser(authService, 'teacher@example.test');
    addMembership(accessRepository, user.userId, organizationA, 'teacher');

    const deniedWrite = await request(app)
      .patch(`/api/v1/organizations/${organizationA}/resources/${resourceA}`)
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ value: 'not allowed' });
    const deniedRole = await request(app)
      .get(`/api/v1/organizations/${organizationA}/owner-action`)
      .set('Cookie', user.cookie);

    expect(deniedWrite.status).toBe(403);
    expect(deniedWrite.body.error.code).toBe('PERMISSION_DENIED');
    expect(deniedRole.status).toBe(403);
    expect(deniedRole.body.error.code).toBe('ROLE_REQUIRED');
    expect(permissionsForOrganizationRole('teacher')).toEqual([
      'organization.read',
      'student.read',
    ]);
  });

  it('keeps platform role grants separate from organization membership', async () => {
    const { app, authService, accessRepository } = buildHarness();
    const platformAdmin = await addUser(authService, 'platform@example.test');
    const organizationAdmin = await addUser(
      authService,
      'org-admin@example.test',
    );
    accessRepository.platformRoles.add(
      `${platformAdmin.userId}:platform_super_admin`,
    );
    addMembership(
      accessRepository,
      organizationAdmin.userId,
      organizationA,
      'organization_admin',
    );

    const platformAccess = await request(app)
      .get('/api/v1/platform/super-admin')
      .set('Cookie', platformAdmin.cookie);
    const noImplicitTenantAccess = await request(app)
      .get(`/api/v1/organizations/${organizationA}/context`)
      .set('Cookie', platformAdmin.cookie);
    const noImplicitPlatformAccess = await request(app)
      .get('/api/v1/platform/super-admin')
      .set('Cookie', organizationAdmin.cookie);

    expect(platformAccess.status).toBe(200);
    expect(noImplicitTenantAccess.status).toBe(404);
    expect(noImplicitPlatformAccess.status).toBe(403);
  });

  it('uses explicit role capability sets rather than implied inheritance', () => {
    expect(permissionsForOrganizationRole('organization_admin')).toContain(
      'organization.update',
    );
    expect(permissionsForOrganizationRole('campus_admin')).not.toContain(
      'organization.update',
    );
    expect(permissionsForOrganizationRole('student')).toEqual([
      'organization.read',
    ]);
  });

  it('declares unique membership and separate platform grant indexes', () => {
    expect(MembershipModel.schema.indexes()).toContainEqual([
      { organizationId: 1, userId: 1 },
      { unique: true, name: 'uniq_membership_organization_user' },
    ]);
    expect(PlatformRoleGrantModel.schema.indexes()).toContainEqual([
      { userId: 1, role: 1 },
      { unique: true, name: 'uniq_platform_grant_user_role' },
    ]);
    expect(MembershipModel.schema.path('role').options.enum).not.toContain(
      'platform_super_admin',
    );
  });
});
