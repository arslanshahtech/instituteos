import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';
import { createExaminationsRouter } from './examinations.routes.js';
import type { ExaminationsService } from './examinations.service.js';

afterEach(() => vi.restoreAllMocks());

const organizationId = '650000000000000000000001';
const userId = '650000000000000000000002';
const csrfToken = 'teacher-examination-csrf';

function appForRole(role: OrganizationRole) {
  const service = {
    listExams: vi.fn().mockResolvedValue([{ id: 'assigned-exam' }]),
    saveMarks: vi.fn().mockResolvedValue([{ id: 'mark-saved' }]),
    createExam: vi.fn().mockResolvedValue({ id: 'new-exam' }),
  } as unknown as ExaminationsService;
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
  app.use(createExaminationsRouter(service, accessRepository, authenticate));
  app.use(errorHandler);
  return { app, service };
}

describe('Teacher examination authorization routes', () => {
  it('allows teachers to read examination information', async () => {
    const { app, service } = appForRole('teacher');
    const response = await request(app).get(`/${organizationId}/examinations`);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([{ id: 'assigned-exam' }]);
    expect(service.listExams).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, userId, role: 'teacher' }),
      {},
    );
  });

  it('allows teachers to submit marks through the marks-entry permission path', async () => {
    const { app, service } = appForRole('teacher');
    const scheduleId = '650000000000000000000013';
    const studentId = '650000000000000000000014';
    const response = await request(app)
      .put(`/${organizationId}/examinations/schedules/${scheduleId}/marks`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ records: [{ studentId, isAbsent: false, marksObtained: 82 }] });

    expect(response.status).toBe(200);
    expect(service.saveMarks).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, userId, role: 'teacher' }),
      scheduleId,
      [{ studentId, isAbsent: false, marksObtained: 82 }],
    );
  });

  it('does not allow teachers to create or manage exam structures', async () => {
    const { app, service } = appForRole('teacher');
    const response = await request(app)
      .post(`/${organizationId}/examinations`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Term 1',
        type: 'midterm',
        academicYearId: '650000000000000000000004',
        termId: '650000000000000000000005',
        campusId: '650000000000000000000006',
        startDate: '2026-11-01',
        endDate: '2026-11-10',
      });

    expect(response.status).toBe(403);
    expect(service.createExam).not.toHaveBeenCalled();
  });
});
