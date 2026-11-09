import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import { StaffMemberModel } from '../people/people.model.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
} from '../academics/academics.model.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';
import { createHomeworkRouter } from './homework.routes.js';

afterEach(() => vi.restoreAllMocks());

const organizationId = '650000000000000000000001';
const userId = '650000000000000000000002';
const csrfToken = 'homework-route-csrf';

function appForRole(role: OrganizationRole) {
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
  app.use(createHomeworkRouter(accessRepository, authenticate));
  app.use(errorHandler);
  return app;
}

describe('Homework & Tests teacher authorization routes', () => {
  it('returns an empty list when the teacher has no linked teaching assignments', async () => {
    const staffQuery = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: userId }]),
    };
    const assignmentQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(StaffMemberModel, 'find').mockReturnValue(staffQuery as never);
    const assignmentFind = vi
      .spyOn(TeacherAssignmentModel, 'find')
      .mockReturnValue(assignmentQuery as never);
    const homeworkFind = vi.spyOn(
      (await import('./homework.model.js')).HomeworkTestModel,
      'find',
    );

    const response = await request(appForRole('teacher')).get(
      `/${organizationId}/homework-tests`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(assignmentFind).toHaveBeenCalledWith({
      organizationId,
      teacherStaffId: userId,
    });
    expect(homeworkFind).not.toHaveBeenCalled();
  });

  it('shows teachers all work in their assigned class, including items created by administrators', async () => {
    const staffQuery = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: userId }]),
    };
    const assignment = {
      campusId: '650000000000000000000004',
      classId: '650000000000000000000006',
      sectionId: '650000000000000000000007',
      academicYearId: '650000000000000000000005',
      subjectId: '650000000000000000000008',
    };
    const assignmentQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([assignment]),
    };
    const metadataQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(StaffMemberModel, 'find')
      .mockReturnValueOnce(staffQuery as never)
      .mockReturnValueOnce(metadataQuery as never);
    vi.spyOn(TeacherAssignmentModel, 'find').mockReturnValue(
      assignmentQuery as never,
    );
    const homeworkQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    const homeworkFind = vi
      .spyOn((await import('./homework.model.js')).HomeworkTestModel, 'find')
      .mockReturnValue(homeworkQuery as never);
    for (const model of [
      AcademicClassModel,
      AcademicSectionModel,
      SubjectModel,
      AcademicYearModel,
    ]) {
      vi.spyOn(model, 'find').mockReturnValue(metadataQuery as never);
    }

    const response = await request(appForRole('teacher')).get(
      `/${organizationId}/homework-tests`,
    );

    expect(response.status).toBe(200);
    expect(homeworkFind).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        $or: [
          expect.objectContaining({
            classId: assignment.classId,
            sectionId: assignment.sectionId,
            academicYearId: assignment.academicYearId,
            subjectId: assignment.subjectId,
          }),
        ],
      }),
    );
    expect(homeworkFind.mock.calls[0]?.[0]).not.toHaveProperty('createdBy');
  });

  it('denies parent accounts from Homework & Tests before reading records', async () => {
    const homeworkFind = vi.spyOn(
      (await import('./homework.model.js')).HomeworkTestModel,
      'find',
    );

    const response = await request(appForRole('parent_guardian')).get(
      `/${organizationId}/homework-tests`,
    );

    expect(response.status).toBe(403);
    expect(homeworkFind).not.toHaveBeenCalled();
  });

  it('allows an organization admin to change publication status without editing content', async () => {
    const itemId = '650000000000000000000010';
    const campusId = '650000000000000000000004';
    const academicYearId = '650000000000000000000005';
    const classId = '650000000000000000000006';
    const sectionId = '650000000000000000000007';
    const subjectId = '650000000000000000000008';
    const existing = {
      _id: itemId,
      organizationId,
      campusId,
      academicYearId,
      classId,
      sectionId,
      subjectId,
      title: 'Old title',
      instructions: '',
      type: 'homework',
      dueDate: new Date('2026-11-15T00:00:00.000Z'),
      status: 'published',
      createdBy: userId,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    };
    const updated = {
      ...existing,
      title: 'Old title',
      status: 'draft',
      updatedAt: new Date('2026-11-02T00:00:00.000Z'),
    };
    const homeworkModel = await import('./homework.model.js');
    vi.spyOn(homeworkModel.HomeworkTestModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(existing),
    } as never);
    const update = vi
      .spyOn(homeworkModel.HomeworkTestModel, 'findOneAndUpdate')
      .mockReturnValue({
        lean: vi.fn().mockResolvedValue(updated),
      } as never);
    vi.spyOn(AcademicClassModel, 'exists').mockResolvedValue({
      _id: classId,
    } as never);
    vi.spyOn(AcademicSectionModel, 'exists').mockResolvedValue({
      _id: sectionId,
    } as never);
    vi.spyOn(SubjectModel, 'exists').mockResolvedValue({
      _id: subjectId,
    } as never);
    vi.spyOn(AcademicYearModel, 'exists').mockResolvedValue({
      _id: academicYearId,
    } as never);

    const response = await request(appForRole('organization_admin'))
      .patch('/' + organizationId + '/homework-tests/' + itemId)
      .set('Cookie', 'instituteos_csrf=' + csrfToken)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'draft' });

    expect(response.status).toBe(200);
    expect(response.body.item).toMatchObject({
      id: itemId,
      title: 'Old title',
      status: 'draft',
    });
    expect(update).toHaveBeenCalledWith(
      { _id: itemId, organizationId },
      {
        $set: { status: 'draft' },
      },
      { new: true, runValidators: true },
    );
  });

  it('allows an organization admin to create homework for any valid school class', async () => {
    const campusId = '650000000000000000000004';
    const academicYearId = '650000000000000000000005';
    const classId = '650000000000000000000006';
    const sectionId = '650000000000000000000007';
    const subjectId = '650000000000000000000008';
    vi.spyOn(AcademicClassModel, 'exists').mockResolvedValue({
      _id: classId,
    } as never);
    vi.spyOn(AcademicSectionModel, 'exists').mockResolvedValue({
      _id: sectionId,
    } as never);
    vi.spyOn(SubjectModel, 'exists').mockResolvedValue({
      _id: subjectId,
    } as never);
    vi.spyOn(AcademicYearModel, 'exists').mockResolvedValue({
      _id: academicYearId,
    } as never);
    const created = {
      _id: '650000000000000000000011',
      organizationId,
      campusId,
      academicYearId,
      classId,
      sectionId,
      subjectId,
      title: 'Admin created homework',
      instructions: 'Complete the worksheet.',
      type: 'homework',
      dueDate: new Date('2026-11-15T00:00:00.000Z'),
      status: 'published',
      createdBy: userId,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    };
    const create = vi
      .spyOn((await import('./homework.model.js')).HomeworkTestModel, 'create')
      .mockResolvedValue(created as never);

    const response = await request(appForRole('organization_admin'))
      .post(`/${organizationId}/homework-tests`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        campusId,
        academicYearId,
        classId,
        sectionId,
        subjectId,
        title: 'Admin created homework',
        instructions: 'Complete the worksheet.',
        type: 'homework',
        dueDate: '2026-11-15',
        status: 'published',
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: created._id,
      title: 'Admin created homework',
      status: 'published',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        createdBy: userId,
        classId,
        sectionId,
        status: 'published',
      }),
    );
  });

  it('blocks teachers from creating homework for a class outside their assignments', async () => {
    const staffQuery = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: userId }]),
    };
    vi.spyOn(StaffMemberModel, 'find').mockReturnValue(staffQuery as never);
    vi.spyOn(AcademicClassModel, 'exists').mockResolvedValue({
      _id: userId,
    } as never);
    vi.spyOn(AcademicSectionModel, 'exists').mockResolvedValue({
      _id: userId,
    } as never);
    vi.spyOn(SubjectModel, 'exists').mockResolvedValue({
      _id: userId,
    } as never);
    vi.spyOn(AcademicYearModel, 'exists').mockResolvedValue({
      _id: userId,
    } as never);
    const assignmentCheck = vi
      .spyOn(TeacherAssignmentModel, 'exists')
      .mockResolvedValue(null);
    const homeworkModel = await import('./homework.model.js');
    const createHomework = vi.spyOn(homeworkModel.HomeworkTestModel, 'create');

    const response = await request(appForRole('teacher'))
      .post(`/${organizationId}/homework-tests`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        campusId: '650000000000000000000004',
        academicYearId: '650000000000000000000005',
        classId: '650000000000000000000006',
        sectionId: '650000000000000000000007',
        subjectId: '650000000000000000000008',
        title: 'Out of scope homework',
        instructions: '',
        type: 'homework',
        dueDate: '2026-11-15',
        status: 'published',
      });

    expect(response.status).toBe(403);
    expect(assignmentCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        teacherStaffId: userId,
        classId: '650000000000000000000006',
        sectionId: '650000000000000000000007',
        academicYearId: '650000000000000000000005',
        subjectId: '650000000000000000000008',
      }),
    );
    expect(createHomework).not.toHaveBeenCalled();
  });
});
