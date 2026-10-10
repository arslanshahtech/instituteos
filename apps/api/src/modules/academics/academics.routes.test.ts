import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { createAcademicsRouter } from './academics.routes.js';
import { AcademicsService } from './academics.service.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';

afterEach(() => vi.restoreAllMocks());

function appForRole(role: OrganizationRole) {
  const organizationId = '650000000000000000000001';
  const userId = '650000000000000000000002';
  const service = {
    listAcademicYears: vi.fn().mockResolvedValue([]),
  } as unknown as AcademicsService;
  const accessRepository: OrganizationAccessRepository = {
    findActiveMembership: vi.fn().mockResolvedValue({
      membershipId: '650000000000000000000003',
      organizationId,
      userId,
      role,
      campusIds: [],
    }),
    findLifecycleOwner: vi.fn().mockResolvedValue(false),
    hasPlatformRole: vi.fn().mockResolvedValue(false),
  };
  const authenticate = async (
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    response.locals.auth = { user: { id: userId } };
    next();
  };
  const app = express();
  app.use(createAcademicsRouter(service, accessRepository, authenticate));
  app.use(errorHandler);
  return { app, service, organizationId };
}

describe('Academics routes', () => {
  it('rejects users without an academic management role', async () => {
    const { app, service, organizationId } = appForRole('teacher');

    const response = await request(app).get(
      `/${organizationId}/academic-years`,
    );

    expect(response.status).toBe(403);
    expect(service.listAcademicYears).not.toHaveBeenCalled();
  });

  it('resolves organization context before returning academic data', async () => {
    const { app, service, organizationId } = appForRole('academic_coordinator');

    const response = await request(app).get(
      `/${organizationId}/academic-years`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(service.listAcademicYears).toHaveBeenCalledWith({
      organizationId,
      campusIds: [],
      role: 'academic_coordinator',
    });
  });
});
