import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';
import { createAttendanceRouter } from './attendance.routes.js';
import type { AttendanceService } from './attendance.service.js';

afterEach(() => vi.restoreAllMocks());

const organizationId = '650000000000000000000001';
const userId = '650000000000000000000002';
const csrfToken = 'teacher-self-attendance-csrf';

function appForRole(role: OrganizationRole) {
  const service = {
    getTeacherSelfAttendance: vi.fn().mockResolvedValue({
      policy: {
        viewOwnAttendance: true,
        selfMarkingEnabled: true,
        allowedStatuses: ['present'],
      },
      items: [
        {
          id: 'own-record',
          staffId: '650000000000000000000009',
          date: '2026-11-01',
          status: 'present',
        },
      ],
    }),
    saveTeacherSelfAttendance: vi.fn().mockResolvedValue({
      id: 'new-own-record',
      staffId: '650000000000000000000009',
      date: '2026-11-01',
      status: 'present',
    }),
  } as unknown as AttendanceService;
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
  app.use(createAttendanceRouter(service, accessRepository, authenticate));
  app.use(errorHandler);
  return { app, service };
}

describe('Teacher self-attendance routes', () => {
  it('returns only the authenticated teacher self-attendance response', async () => {
    const { app, service } = appForRole('teacher');
    const response = await request(app).get(
      `/${organizationId}/attendance/self`,
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(service.getTeacherSelfAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, userId, role: 'teacher' }),
      {},
    );
  });

  it('requires CSRF protection before self-attendance writes', async () => {
    const { app, service } = appForRole('teacher');
    const response = await request(app)
      .post(`/${organizationId}/attendance/self`)
      .send({ date: '2026-11-01', status: 'present' });

    expect(response.status).toBe(403);
    expect(service.saveTeacherSelfAttendance).not.toHaveBeenCalled();
  });

  it('allows the teacher self-attendance write only through the protected teacher route', async () => {
    const { app, service } = appForRole('teacher');
    const response = await request(app)
      .post(`/${organizationId}/attendance/self`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ date: '2026-11-01', status: 'present' });

    expect(response.status).toBe(201);
    expect(service.saveTeacherSelfAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, userId, role: 'teacher' }),
      { date: '2026-11-01', status: 'present' },
    );
  });

  it('denies parents from the teacher-only self-attendance endpoint', async () => {
    const { app, service } = appForRole('parent_guardian');
    const response = await request(app).get(
      `/${organizationId}/attendance/self`,
    );

    expect(response.status).toBe(403);
    expect(service.getTeacherSelfAttendance).not.toHaveBeenCalled();
  });
});
