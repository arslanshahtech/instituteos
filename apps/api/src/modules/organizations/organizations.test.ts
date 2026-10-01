import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../errors/app-error.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { createAuthenticationMiddleware } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import {
  MemoryAuthEmailDelivery,
  MemoryAuthRepository,
} from '../auth/auth.test-helpers.js';
import type {
  OrganizationAccessRepository,
  OrganizationContext,
  OrganizationMembershipContext,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';
import { createOrganizationRouter } from './organizations.routes.js';
import { OrganizationService } from './organizations.service.js';
import type {
  OrganizationRepository,
  OrganizationServices,
} from './organizations.types.js';

const organizationA = '650000000000000000000001';
const organizationB = '650000000000000000000002';
const campusA = '660000000000000000000001';
const campusB = '660000000000000000000002';
const userObjectId = '670000000000000000000001';

class FixtureAccessRepository implements OrganizationAccessRepository {
  readonly members = new Map<string, OrganizationMembershipContext>();
  readonly organizations = new Set([organizationA, organizationB]);

  async findActiveMembership(userId: string, organizationId: string) {
    return this.organizations.has(organizationId)
      ? (this.members.get(`${userId}:${organizationId}`) ?? null)
      : null;
  }

  async hasPlatformRole() {
    return false;
  }
}

async function createUser() {
  const repository = new MemoryAuthRepository();
  const emailDelivery = new MemoryAuthEmailDelivery();
  const authService = new AuthService(repository, emailDelivery, {
    sessionTtlDays: 7,
    requireEmailVerification: false,
    webAppUrl: 'http://localhost:5173',
  });
  await authService.register({
    email: 'owner@example.test',
    displayName: 'Organization Owner',
    password: 'sufficient test password',
  });
  const session = await authService.login(
    'owner@example.test',
    'sufficient test password',
  );
  return {
    id: session.user.id,
    email: session.user.email,
    cookie: `instituteos_session=${session.sessionToken}; instituteos_csrf=${session.csrfToken}`,
    csrfToken: session.csrfToken,
    authenticate: createAuthenticationMiddleware(authService),
  };
}

function buildApp(
  service: OrganizationServices,
  access: FixtureAccessRepository,
  authenticate: ReturnType<typeof createAuthenticationMiddleware>,
) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/organizations',
    createOrganizationRouter(service, access, authenticate),
  );
  app.use((_request, _response, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Not found.')),
  );
  app.use(errorHandler);
  return app;
}

function context(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  campusIds: string[] = [],
): OrganizationContext {
  return {
    membershipId: `${userId}-${organizationId}`,
    userId,
    organizationId,
    role,
    campusIds,
    permissions: [],
  };
}

describe('organization administration routes', () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  let access: FixtureAccessRepository;
  let service: OrganizationServices;
  let app: express.Express;

  beforeEach(async () => {
    user = await createUser();
    access = new FixtureAccessRepository();
    access.members.set(
      `${user.id}:${organizationA}`,
      context(user.id, organizationA, 'organization_owner'),
    );
    service = {
      provision: vi.fn().mockResolvedValue({
        organization: { id: organizationA, name: 'North Institute' },
        campus: { id: campusA, name: 'Main Campus' },
      }),
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      dashboard: vi.fn().mockResolvedValue({
        organization: { id: organizationA, name: 'North Institute' },
        counts: { campuses: 1, members: 1 },
        setupComplete: true,
      }),
      listCampuses: vi.fn(),
      createCampus: vi.fn(),
      getCampus: vi.fn().mockImplementation(async (_context, id) => {
        if (id !== campusA)
          throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
        return { id, name: 'Main Campus' };
      }),
      updateCampus: vi.fn(),
      listMembers: vi.fn(),
      updateMember: vi.fn(),
      invite: vi.fn(),
      listInvitations: vi.fn(),
      acceptInvitation: vi.fn(),
      updateOrganizationStatus: vi.fn(),
    };
    app = buildApp(service, access, user.authenticate);
  });

  it('creates an organization for the authenticated creator with an initial campus', async () => {
    const response = await request(app)
      .post('/api/v1/organizations')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrfToken)
      .send({
        name: 'North Institute',
        initialCampus: { name: 'Main Campus' },
      });

    expect(response.status).toBe(201);
    expect(service.provision).toHaveBeenCalledWith(user.id, {
      name: 'North Institute',
      initialCampus: { name: 'Main Campus' },
    });
  });

  it('serves dashboard data only to an active organization member', async () => {
    const allowed = await request(app)
      .get(`/api/v1/organizations/${organizationA}/dashboard`)
      .set('Cookie', user.cookie);
    const foreign = await request(app)
      .get(`/api/v1/organizations/${organizationB}/dashboard`)
      .set('Cookie', user.cookie);

    expect(allowed.status).toBe(200);
    expect(allowed.body.counts).toEqual({ campuses: 1, members: 1 });
    expect(foreign.status).toBe(404);
    expect(service.dashboard).toHaveBeenCalledOnce();
  });

  it('denies foreign campus and member IDs before service access', async () => {
    const campusResponse = await request(app)
      .get(`/api/v1/organizations/${organizationB}/campuses/${campusB}`)
      .set('Cookie', user.cookie);
    const campusUpdate = await request(app)
      .patch(`/api/v1/organizations/${organizationB}/campuses/${campusB}`)
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ name: 'Changed' });
    const memberUpdate = await request(app)
      .patch(`/api/v1/organizations/${organizationB}/members/${userObjectId}`)
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ status: 'revoked' });

    expect(campusResponse.status).toBe(404);
    expect(campusUpdate.status).toBe(404);
    expect(memberUpdate.status).toBe(404);
    expect(service.getCampus).not.toHaveBeenCalled();
    expect(service.updateCampus).not.toHaveBeenCalled();
    expect(service.updateMember).not.toHaveBeenCalled();
  });

  it('restricts Campus Admin requests to assigned campus IDs', async () => {
    access.members.set(
      `${user.id}:${organizationA}`,
      context(user.id, organizationA, 'campus_admin', [campusA]),
    );

    const ownCampus = await request(app)
      .get(`/api/v1/organizations/${organizationA}/campuses/${campusA}`)
      .set('Cookie', user.cookie);
    const foreignCampus = await request(app)
      .get(`/api/v1/organizations/${organizationA}/campuses/${campusB}`)
      .set('Cookie', user.cookie);

    expect(ownCampus.status).toBe(200);
    expect(foreignCampus.status).toBe(404);
    expect(service.getCampus).toHaveBeenCalledOnce();
  });
});

describe('organization invitation service', () => {
  it('stores only a token hash and accepts it for the invited account', async () => {
    let storedHash = '';
    let accepted = false;
    const repository = {
      findOrganization: vi.fn().mockResolvedValue({
        id: organizationA,
        name: 'North Institute',
        status: 'active',
      }),
      findCampus: vi.fn().mockResolvedValue({ id: campusA }),
      createInvitation: vi
        .fn()
        .mockImplementation(async (input: { tokenHash: string }) => {
          storedHash = input.tokenHash;
        }),
      revokeInvitation: vi.fn(),
      acceptInvitation: vi
        .fn()
        .mockImplementation(
          async (input: { tokenHash: string; email: string }) => {
            if (
              accepted ||
              input.tokenHash !== storedHash ||
              input.email !== 'invitee@example.test'
            )
              return null;
            accepted = true;
            return {
              organizationId: organizationA,
              status: 'active',
              role: 'teacher',
            };
          },
        ),
    } as unknown as OrganizationRepository;
    const delivery = new MemoryAuthEmailDelivery();
    const service = new OrganizationService(repository, delivery);
    const ownerContext: OrganizationContext = {
      ...context(userObjectId, organizationA, 'organization_owner'),
      permissions: ['member.invite'],
    };

    await service.invite(ownerContext, {
      email: 'invitee@example.test',
      role: 'teacher',
      campusIds: [],
    });
    const token = delivery.invitationTokens[0];
    expect(token).toBeTruthy();
    expect(storedHash).not.toBe(token);
    await expect(
      service.acceptInvitation(
        { id: userObjectId, email: 'invitee@example.test' },
        token,
      ),
    ).resolves.toMatchObject({ status: 'active' });
    await expect(
      service.acceptInvitation(
        { id: userObjectId, email: 'invitee@example.test' },
        token,
      ),
    ).rejects.toMatchObject({ code: 'INVITATION_UNAVAILABLE' });
  });
});

describe('organization owner administration', () => {
  it('prevents an organization admin from changing an owner membership', async () => {
    const repository = {
      findMember: vi.fn().mockResolvedValue({
        id: userObjectId,
        role: 'organization_owner',
        status: 'active',
        campusIds: [],
      }),
      updateMember: vi.fn(),
    } as unknown as OrganizationRepository;
    const service = new OrganizationService(
      repository,
      new MemoryAuthEmailDelivery(),
    );

    await expect(
      service.updateMember(
        context(
          '680000000000000000000001',
          organizationA,
          'organization_admin',
        ),
        userObjectId,
        { status: 'suspended' },
      ),
    ).rejects.toMatchObject({ code: 'ROLE_ASSIGNMENT_DENIED' });
    expect(repository.updateMember).not.toHaveBeenCalled();
  });
});
