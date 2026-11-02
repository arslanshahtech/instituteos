import mongoose, { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicSectionModel,
  TeacherAssignmentModel,
} from '../academics/academics.model.js';
import { AuditLogModel } from '../audit/audit.model.js';
import { AuthUserModel } from '../auth/auth.model.js';
import { StaffMemberModel } from '../people/people.model.js';
import {
  StaffAttendanceModel,
  StudentAttendanceModel,
  StudentSectionPlacementModel,
} from './attendance.model.js';
import { MongoAttendanceRepository } from './attendance.repository.js';

const organizationId = '650000000000000000000001';
const studentId = '650000000000000000000002';
const classId = '650000000000000000000003';
const sectionId = '650000000000000000000004';
const academicYearId = '650000000000000000000005';
const campusId = '650000000000000000000006';

const input = { studentId, classId, sectionId, academicYearId, campusId };

function sessionMock() {
  return {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('MongoAttendanceRepository section capacity transactions', () => {
  it('locks the section, checks the year roster and saves the placement in one transaction', async () => {
    const session = sessionMock();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
    const sectionQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ capacity: 2 }),
    };
    const countQuery = { session: vi.fn().mockResolvedValue(1) };
    const placementQuery = {
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(studentId),
        organizationId: new Types.ObjectId(organizationId),
        studentId: new Types.ObjectId(studentId),
        classId: new Types.ObjectId(classId),
        sectionId: new Types.ObjectId(sectionId),
        academicYearId: new Types.ObjectId(academicYearId),
        campusId: new Types.ObjectId(campusId),
        status: 'active',
      }),
    };
    const lockSection = vi
      .spyOn(AcademicSectionModel, 'findOneAndUpdate')
      .mockReturnValue(sectionQuery as never);
    vi.spyOn(StudentSectionPlacementModel, 'countDocuments').mockReturnValue(
      countQuery as never,
    );
    const savePlacement = vi
      .spyOn(StudentSectionPlacementModel, 'findOneAndUpdate')
      .mockReturnValue(placementQuery as never);

    const result =
      await new MongoAttendanceRepository().upsertStudentPlacementWithinCapacity(
        organizationId,
        input,
      );

    expect(result.status).toBe('active');
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(lockSection).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(sectionId),
        organizationId: new Types.ObjectId(organizationId),
        classId: new Types.ObjectId(classId),
      },
      { $inc: { placementRevision: 1 } },
      { new: true, session },
    );
    expect(countQuery.session).toHaveBeenCalledWith(session);
    expect(savePlacement).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('rejects a full section before writing a placement', async () => {
    const session = sessionMock();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
    vi.spyOn(AcademicSectionModel, 'findOneAndUpdate').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ capacity: 1 }),
    } as never);
    vi.spyOn(StudentSectionPlacementModel, 'countDocuments').mockReturnValue({
      session: vi.fn().mockResolvedValue(1),
    } as never);
    const savePlacement = vi.spyOn(
      StudentSectionPlacementModel,
      'findOneAndUpdate',
    );

    await expect(
      new MongoAttendanceRepository().upsertStudentPlacementWithinCapacity(
        organizationId,
        input,
      ),
    ).rejects.toMatchObject({ code: 'SECTION_CAPACITY_REACHED' });

    expect(savePlacement).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});

describe('MongoAttendanceRepository teacher self-attendance', () => {
  it('creates one immutable daily mark and writes an audit record for the signed-in teacher', async () => {
    const actorId = '650000000000000000000009';
    const recordId = '650000000000000000000010';
    const input = {
      staffId: '650000000000000000000011',
      date: '2026-11-01',
      status: 'present' as const,
    };
    const document = {
      _id: new Types.ObjectId(recordId),
      toObject: () => ({
        _id: new Types.ObjectId(recordId),
        organizationId: new Types.ObjectId(organizationId),
        staffId: new Types.ObjectId(input.staffId),
        campusId: new Types.ObjectId(campusId),
        date: new Date('2026-11-01T00:00:00.000Z'),
        status: input.status,
        createdAt: new Date('2026-11-01T08:00:00.000Z'),
        updatedAt: new Date('2026-11-01T08:00:00.000Z'),
      }),
    };
    const createAttendance = vi
      .spyOn(StaffAttendanceModel, 'create')
      .mockResolvedValue([document] as never);
    const createAudit = vi
      .spyOn(AuditLogModel, 'create')
      .mockResolvedValue({} as never);

    const result =
      await new MongoAttendanceRepository().createStaffAttendanceOnce(
        organizationId,
        campusId,
        actorId,
        input,
      );

    expect(result).toMatchObject({
      id: recordId,
      staffId: input.staffId,
      date: input.date,
      status: 'present',
    });
    expect(createAttendance).toHaveBeenCalledWith([
      expect.objectContaining({
        organizationId: new Types.ObjectId(organizationId),
        staffId: new Types.ObjectId(input.staffId),
        campusId: new Types.ObjectId(campusId),
        date: new Date('2026-11-01T00:00:00.000Z'),
        status: 'present',
      }),
    ]);
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: new Types.ObjectId(organizationId),
        campusId: new Types.ObjectId(campusId),
        actorId: new Types.ObjectId(actorId),
        action: 'TEACHER_SELF_ATTENDANCE_MARKED',
        entityType: 'StaffAttendance',
        entityId: recordId,
        metadata: { date: input.date, status: 'present' },
      }),
    );
  });
});

describe('MongoAttendanceRepository teacher identity resolution', () => {
  it('resolves assignments through the durable staff account link before email fallback', async () => {
    const teacherUserId = '650000000000000000000007';
    const teacherStaffId = '650000000000000000000008';
    const staffQuery = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi
        .fn()
        .mockResolvedValue([{ _id: new Types.ObjectId(teacherStaffId) }]),
    };
    const assignmentQuery = {
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(StaffMemberModel, 'find').mockReturnValue(staffQuery as never);
    const assignmentFind = vi
      .spyOn(TeacherAssignmentModel, 'find')
      .mockReturnValue(assignmentQuery as never);
    const userFind = vi.spyOn(AuthUserModel, 'find');

    const result =
      await new MongoAttendanceRepository().listTeacherAssignmentsForUser(
        organizationId,
        teacherUserId,
      );

    expect(result).toEqual([]);
    expect(StaffMemberModel.find).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(teacherUserId),
      status: 'active',
    });
    expect(assignmentFind).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId(organizationId),
      teacherStaffId: new Types.ObjectId(teacherStaffId),
    });
    expect(userFind).not.toHaveBeenCalled();
  });
});

describe('MongoAttendanceRepository student attendance history scope', () => {
  it('filters teacher history by the academic years derived from their assignments', async () => {
    const query = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    const find = vi
      .spyOn(StudentAttendanceModel, 'find')
      .mockReturnValue(query as never);

    await new MongoAttendanceRepository().listStudentAttendance(
      organizationId,
      { sectionId, academicYearIds: [academicYearId] },
      [campusId],
    );

    expect(find).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId(organizationId),
      sectionId: new Types.ObjectId(sectionId),
      academicYearId: { $in: [new Types.ObjectId(academicYearId)] },
      campusId: { $in: [new Types.ObjectId(campusId)] },
    });
    expect(query.sort).toHaveBeenCalledOnce();
    expect(query.limit).toHaveBeenCalledWith(5000);
  });
});
