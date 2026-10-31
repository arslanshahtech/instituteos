import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import { StaffMemberModel } from './people.model.js';
import { MongoPeopleRepository } from './people.repository.js';
import { createPeopleRouter } from './people.routes.js';
import { PeopleService } from './people.service.js';

const organizationId = '650000000000000000000001';
const csrfToken = 'staff-route-csrf-test';

function testApp(role: 'organization_admin' | 'student') {
  const accessRepository: OrganizationAccessRepository = {
    findActiveMembership: async (userId, requestedOrganizationId) =>
      userId === 'user-1' && requestedOrganizationId === organizationId
        ? {
            membershipId: 'membership-1',
            organizationId,
            userId,
            role,
            campusIds: [],
          }
        : null,
    findLifecycleOwner: async () => false,
    hasPlatformRole: async () => false,
  };
  const authenticate: Parameters<typeof createPeopleRouter>[2] = async (
    _request,
    response,
    next,
  ) => {
    response.locals.auth = {
      user: { id: 'user-1' },
      session: { csrfTokenHash: hashOpaqueToken(csrfToken) },
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1',
    createPeopleRouter(
      new PeopleService(new MongoPeopleRepository()),
      accessRepository,
      authenticate,
    ),
  );
  app.use(errorHandler);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe('staff HTTP routes', () => {
  it('returns tenant-filtered staff search results to authorized members', async () => {
    const staffId = new Types.ObjectId();
    const find = vi.spyOn(StaffMemberModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: staffId,
          organizationId: new Types.ObjectId(organizationId),
          campusId: null,
          firstName: 'Ada',
          lastName: 'Lovelace',
          employeeCode: 'EMP-014',
          department: 'Science',
          designation: 'Teacher',
          status: 'active',
          email: 'ada@example.test',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    } as never);
    vi.spyOn(StaffMemberModel, 'countDocuments').mockResolvedValue(1);

    const response = await request(testApp('organization_admin'))
      .get(`/api/v1/${organizationId}/staff`)
      .query({
        search: 'Ada Lovelace',
        department: 'Science',
        status: 'active',
        page: '1',
        pageSize: '20',
      });

    expect(response.status).toBe(200);
    expect(response.body.items).toMatchObject([
      {
        id: String(staffId),
        firstName: 'Ada',
        employeeCode: 'EMP-014',
        designation: 'Teacher',
      },
    ]);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: new Types.ObjectId(organizationId),
        status: 'active',
        department: { $regex: 'Science', $options: 'i' },
      }),
    );
    const filter = find.mock.calls[0]?.[0] as unknown as {
      $and: Array<{ $or: Array<Record<string, { $regex: string }>> }>;
    };
    expect(filter.$and.map((term) => term.$or[0]?.firstName.$regex)).toEqual([
      'Ada',
      'Lovelace',
    ]);
  });

  it('loads an organization-scoped staff detail record', async () => {
    const staffId = new Types.ObjectId();
    const findOne = vi.spyOn(StaffMemberModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: staffId,
        organizationId: new Types.ObjectId(organizationId),
        campusId: null,
        firstName: 'Grace',
        lastName: 'Hopper',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    } as never);

    const response = await request(testApp('organization_admin')).get(
      `/api/v1/${organizationId}/staff/${staffId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.staff).toMatchObject({
      id: String(staffId),
      firstName: 'Grace',
      lastName: 'Hopper',
    });
    expect(findOne).toHaveBeenCalledWith({
      _id: staffId,
      organizationId: new Types.ObjectId(organizationId),
    });
  });

  it('validates and persists staff creation and updates over CSRF-protected routes', async () => {
    const staffId = new Types.ObjectId();
    const organizationObjectId = new Types.ObjectId(organizationId);
    const original = {
      _id: staffId,
      organizationId: organizationObjectId,
      campusId: null,
      firstName: 'Ada',
      lastName: 'Lovelace',
      employeeCode: 'EMP-014',
      designation: 'Teacher',
      qualifications: ['MSc Physics'],
      subjects: ['Physics'],
      dateOfBirth: new Date('1988-12-10T00:00:00.000Z'),
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const created = vi
      .spyOn(StaffMemberModel, 'create')
      .mockResolvedValue({ _id: staffId } as never);
    vi.spyOn(StaffMemberModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(original),
    } as never);
    const changed = {
      ...original,
      firstName: 'Augusta',
      status: 'terminated',
    };
    const update = vi
      .spyOn(StaffMemberModel, 'findOneAndUpdate')
      .mockReturnValue({
        lean: vi.fn().mockResolvedValue(changed),
      } as never);
    const app = testApp('organization_admin');

    const createResponse = await request(app)
      .post(`/api/v1/${organizationId}/staff`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        employeeCode: 'EMP-014',
        designation: 'Teacher',
        qualifications: ['MSc Physics'],
        subjects: ['Physics'],
        dateOfBirth: '1988-12-10',
        status: 'active',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.staff).toMatchObject({
      firstName: 'Ada',
      employeeCode: 'EMP-014',
      designation: 'Teacher',
    });
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: organizationObjectId,
        employeeCode: 'EMP-014',
        designation: 'Teacher',
        qualifications: ['MSc Physics'],
        subjects: ['Physics'],
        dateOfBirth: new Date('1988-12-10T00:00:00.000Z'),
      }),
    );

    const updateResponse = await request(app)
      .patch(`/api/v1/${organizationId}/staff/${staffId}`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ firstName: 'Augusta', status: 'terminated' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.staff).toMatchObject({
      firstName: 'Augusta',
      status: 'terminated',
    });
    expect(update).toHaveBeenCalledWith(
      { _id: staffId, organizationId: organizationObjectId },
      {
        $set: expect.objectContaining({
          firstName: 'Augusta',
          status: 'terminated',
        }),
      },
      { new: true, runValidators: true },
    );
  });

  it('exposes a CSRF-protected student import preview for members with student.create', async () => {
    const previewSpy = vi
      .spyOn(PeopleService.prototype, 'previewStudentImport')
      .mockResolvedValue({
        rows: [
          {
            rowNumber: 2,
            status: 'ready',
            input: { firstName: 'Ali', lastName: 'Raza' },
            firstName: 'Ali',
            lastName: 'Raza',
            issues: [],
          },
        ],
        summary: {
          total: 1,
          ready: 1,
          warnings: 0,
          duplicates: 0,
          errors: 0,
          importable: 1,
        },
      });

    const response = await request(testApp('organization_admin'))
      .post(`/api/v1/${organizationId}/students/import/preview`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        rows: [{ rowNumber: 2, data: { firstName: 'Ali', lastName: 'Raza' } }],
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.summary).toMatchObject({ total: 1, importable: 1 });
    expect(previewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId }),
      [{ rowNumber: 2, data: { firstName: 'Ali', lastName: 'Raza' } }],
      undefined,
    );
  });

  it('commits student imports only through the protected confirm endpoint', async () => {
    const importSpy = vi
      .spyOn(PeopleService.prototype, 'importStudents')
      .mockResolvedValue({
        rows: [
          {
            rowNumber: 2,
            outcome: 'created',
            message: 'Student profile created.',
            studentId: 'student-1',
          },
        ],
        summary: { total: 1, created: 1, skipped: 0, failed: 0 },
      });
    const inputRows = [
      { rowNumber: 2, data: { firstName: 'Ali', lastName: 'Raza' } },
    ];

    const response = await request(testApp('organization_admin'))
      .post(`/api/v1/${organizationId}/students/import`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ rows: inputRows });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.summary).toMatchObject({
      created: 1,
      skipped: 0,
      failed: 0,
    });
    expect(importSpy).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId }),
      inputRows,
      undefined,
    );
  });

  it('requires CSRF and rejects unsupported student import fields', async () => {
    const app = testApp('organization_admin');
    const noCsrf = await request(app)
      .post(`/api/v1/${organizationId}/students/import/preview`)
      .send({
        rows: [{ rowNumber: 2, data: { firstName: 'Ali', lastName: 'Raza' } }],
      });
    expect(noCsrf.status).toBe(403);

    const unsupportedField = await request(app)
      .post(`/api/v1/${organizationId}/students/import/preview`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        rows: [
          {
            rowNumber: 2,
            data: {
              firstName: 'Ali',
              lastName: 'Raza',
              organizationId: 'another-org',
            },
          },
        ],
      });
    expect(unsupportedField.status).toBe(400);
    expect(unsupportedField.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('denies staff routes to members without staff.read', async () => {
    const find = vi.spyOn(StaffMemberModel, 'find');
    const response = await request(testApp('student')).get(
      `/api/v1/${organizationId}/staff`,
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
    expect(find).not.toHaveBeenCalled();
  });
});
