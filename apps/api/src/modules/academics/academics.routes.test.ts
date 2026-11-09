import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import { createAcademicsRouter } from './academics.routes.js';
import { SectionTimetableModel } from './academics.model.js';
import { AcademicsService } from './academics.service.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';

afterEach(() => vi.restoreAllMocks());

const csrfToken = 'academics-route-csrf-test';

function appForRole(role: OrganizationRole) {
  const organizationId = '650000000000000000000001';
  const userId = '650000000000000000000002';
  const service = {
    listAcademicYears: vi.fn().mockResolvedValue([]),
    createClass: vi.fn().mockResolvedValue({ id: 'class-created' }),
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
    response.locals.auth = {
      user: { id: userId },
      session: { csrfTokenHash: hashOpaqueToken(csrfToken) },
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(createAcademicsRouter(service, accessRepository, authenticate));
  app.use(errorHandler);
  return { app, service, organizationId };
}

describe('Academics routes', () => {
  it('allows teachers to read academic reference data without granting management access', async () => {
    const { app, service, organizationId } = appForRole('teacher');

    const response = await request(app).get(
      `/${organizationId}/academic-years`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(service.listAcademicYears).toHaveBeenCalled();

    const writeResponse = await request(app)
      .post(`/${organizationId}/classes`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Unauthorized class' });

    expect(writeResponse.status).toBe(403);
    expect(service.createClass).not.toHaveBeenCalled();
  });

  it('rejects non-numeric class display order values at the HTTP boundary', async () => {
    const { app, service, organizationId } = appForRole('academic_coordinator');

    const response = await request(app)
      .post(`/${organizationId}/classes`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Grade 8',
        code: 'G8',
        campusId: '650000000000000000000004',
        sortOrder: true,
      });

    expect(response.status).toBe(400);
    expect(service.createClass).not.toHaveBeenCalled();
  });

  it('keeps section timetable reads restricted to academic management roles', async () => {
    const { app, organizationId } = appForRole('teacher');
    const response = await request(app).get(
      '/' + organizationId + '/section-timetables',
    );
    expect(response.status).toBe(403);
  });

  it('lists section timetables within the resolved organization and academic year', async () => {
    const { app, organizationId } = appForRole('academic_coordinator');
    const academicYearId = '650000000000000000000004';
    const query = {
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    const find = vi
      .spyOn(SectionTimetableModel, 'find')
      .mockReturnValue(query as never);
    const response = await request(app).get(
      '/' +
        organizationId +
        '/section-timetables?academicYearId=' +
        academicYearId,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(find).toHaveBeenCalledWith({
      organizationId: expect.anything(),
      academicYearId: expect.anything(),
    });
    expect(query.sort).toHaveBeenCalledWith({ sectionId: 1 });
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
