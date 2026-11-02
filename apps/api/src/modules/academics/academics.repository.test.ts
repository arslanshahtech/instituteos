import mongoose, { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
  TeacherTimetableModel,
  TermModel,
} from './academics.model.js';
import {
  StudentAttendanceModel,
  StudentSectionPlacementModel,
} from '../attendance/attendance.model.js';
import {
  FeeStructureModel,
  StudentInvoiceModel,
} from '../finance/finance.model.js';
import {
  ExamModel,
  ExamScheduleModel,
} from '../examinations/examinations.model.js';
import { HomeworkTestModel } from '../homework/homework.model.js';
import { StaffMemberModel } from '../people/people.model.js';
import { MongoAcademicsRepository } from './academics.repository.js';

afterEach(() => vi.restoreAllMocks());

describe('TeacherAssignment schema and repository constraints', () => {
  it('includes subjectId in the unique assignment index so a teacher can teach multiple subjects per section', () => {
    const index = TeacherAssignmentModel.schema
      .indexes()
      .find(
        ([, options]) =>
          options.name === 'uniq_teacher_subject_section_per_year_v2',
      );

    expect(index).toBeDefined();
    expect(index?.[0]).toEqual({
      organizationId: 1,
      teacherStaffId: 1,
      subjectId: 1,
      classId: 1,
      sectionId: 1,
      academicYearId: 1,
    });
    expect(index?.[1]).toMatchObject({ unique: true });
  });
});

describe('Academic year activation transaction', () => {
  const organizationId = '650000000000000000000001';
  const yearId = '650000000000000000000099';

  it('archives the previous active year and activates the selected year in one transaction', async () => {
    const target = {
      _id: new Types.ObjectId(yearId),
      organizationId: new Types.ObjectId(organizationId),
      name: '2027–2028',
      startDate: new Date('2027-09-01T00:00:00.000Z'),
      endDate: new Date('2028-06-30T00:00:00.000Z'),
      status: 'archived',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    const targetQuery = {
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(target),
    };
    const updatedQuery = {
      lean: vi.fn().mockResolvedValue({ ...target, status: 'active' }),
    };
    const startSession = vi
      .spyOn(mongoose, 'startSession')
      .mockResolvedValue(session as never);
    const findOne = vi
      .spyOn(AcademicYearModel, 'findOne')
      .mockReturnValue(targetQuery as never);
    const updateMany = vi
      .spyOn(AcademicYearModel, 'updateMany')
      .mockResolvedValue({ modifiedCount: 1 } as never);
    const findOneAndUpdate = vi
      .spyOn(AcademicYearModel, 'findOneAndUpdate')
      .mockReturnValue(updatedQuery as never);

    const result = await new MongoAcademicsRepository().activateAcademicYear(
      organizationId,
      yearId,
      { status: 'active' },
    );

    expect(result?.status).toBe('active');
    expect(startSession).toHaveBeenCalledOnce();
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(yearId),
      organizationId: new Types.ObjectId(organizationId),
    });
    expect(updateMany).toHaveBeenCalledWith(
      {
        organizationId: new Types.ObjectId(organizationId),
        status: 'active',
        _id: { $ne: new Types.ObjectId(yearId) },
      },
      { $set: { status: 'archived' } },
      { session },
    );
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(yearId),
        organizationId: new Types.ObjectId(organizationId),
      },
      { $set: { status: 'active' } },
      { new: true, runValidators: true, session },
    );
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('does not archive the current year when the requested target is missing', async () => {
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    const targetQuery = {
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    };
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
    vi.spyOn(AcademicYearModel, 'findOne').mockReturnValue(
      targetQuery as never,
    );
    const updateMany = vi.spyOn(AcademicYearModel, 'updateMany');

    await expect(
      new MongoAcademicsRepository().activateAcademicYear(
        organizationId,
        yearId,
        { status: 'active' },
      ),
    ).resolves.toBeNull();

    expect(updateMany).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});

describe('Section capacity update transaction', () => {
  const organizationId = '650000000000000000000001';
  const sectionId = '650000000000000000000004';

  it('rejects lowering capacity below the largest active academic-year roster', async () => {
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
    const lockQuery = {
      lean: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(sectionId) }),
    };
    const findOneAndUpdate = vi
      .spyOn(AcademicSectionModel, 'findOneAndUpdate')
      .mockReturnValue(lockQuery as never);
    const aggregate = {
      session: vi.fn().mockResolvedValue([{ maxCount: 13 }]),
    };
    vi.spyOn(StudentSectionPlacementModel, 'aggregate').mockReturnValue(
      aggregate as never,
    );

    await expect(
      new MongoAcademicsRepository().updateSection(organizationId, sectionId, {
        capacity: 12,
      }),
    ).rejects.toMatchObject({ code: 'SECTION_CAPACITY_BELOW_ENROLLMENT' });

    expect(findOneAndUpdate).toHaveBeenCalledOnce();
    expect(aggregate.session).toHaveBeenCalledWith(session);
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});

describe('MongoAcademicsRepository tenant and campus scopes', () => {
  it('lists only classes belonging to the organization and assigned campuses', async () => {
    const sort = vi.fn().mockReturnThis();
    const find = vi.spyOn(AcademicClassModel, 'find').mockReturnValue({
      sort,
      lean: vi.fn().mockResolvedValue([]),
    } as never);

    await new MongoAcademicsRepository().listClasses(
      '650000000000000000000001',
      ['650000000000000000000002'],
    );

    expect(find).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId('650000000000000000000001'),
      campusId: { $in: [new Types.ObjectId('650000000000000000000002')] },
    });
    expect(sort).toHaveBeenCalledWith({ sortOrder: 1, name: 1, code: 1 });
  });

  it('only accepts active teaching staff for teacher assignments', async () => {
    const exists = vi
      .spyOn(StaffMemberModel, 'exists')
      .mockResolvedValue({ _id: '650000000000000000000002' } as never);

    await new MongoAcademicsRepository().validateStaff(
      '650000000000000000000001',
      '650000000000000000000002',
    );

    expect(exists).toHaveBeenCalledWith({
      _id: new Types.ObjectId('650000000000000000000002'),
      organizationId: new Types.ObjectId('650000000000000000000001'),
      status: 'active',
      $or: [
        {
          designation: {
            $regex:
              '\\b(teacher|lecturer|professor|instructor|tutor|faculty)\\b',
            $options: 'i',
          },
        },
        { 'subjects.0': { $exists: true } },
      ],
    });
  });

  it('checks assignment conflicts within the organization, teacher, class, section, and year', async () => {
    const exists = vi
      .spyOn(TeacherAssignmentModel, 'exists')
      .mockResolvedValue(null);

    await new MongoAcademicsRepository().findTeacherAssignmentConflict(
      '650000000000000000000001',
      {
        teacherStaffId: '650000000000000000000002',
        subjectId: '650000000000000000000003',
        classId: '650000000000000000000004',
        sectionId: '650000000000000000000005',
        academicYearId: '650000000000000000000006',
      },
      '650000000000000000000007',
    );

    expect(exists).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId('650000000000000000000001'),
      teacherStaffId: new Types.ObjectId('650000000000000000000002'),
      subjectId: new Types.ObjectId('650000000000000000000003'),
      classId: new Types.ObjectId('650000000000000000000004'),
      sectionId: new Types.ObjectId('650000000000000000000005'),
      academicYearId: new Types.ObjectId('650000000000000000000006'),
      _id: { $ne: new Types.ObjectId('650000000000000000000007') },
    });
  });
});

describe('Academic structure deletion guards', () => {
  const organizationId = '650000000000000000000001';
  const recordId = '650000000000000000000099';

  it('protects academic years referenced by placements, fees, exams, attendance, or homework', async () => {
    vi.spyOn(TermModel, 'exists').mockResolvedValue(null);
    vi.spyOn(TeacherAssignmentModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentSectionPlacementModel, 'exists').mockResolvedValue({
      _id: recordId,
    } as never);
    vi.spyOn(StudentAttendanceModel, 'exists').mockResolvedValue(null);
    vi.spyOn(FeeStructureModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentInvoiceModel, 'exists').mockResolvedValue(null);
    vi.spyOn(ExamModel, 'exists').mockResolvedValue(null);
    vi.spyOn(HomeworkTestModel, 'exists').mockResolvedValue(null);

    await expect(
      new MongoAcademicsRepository().hasReference(
        organizationId,
        'academicYear',
        recordId,
      ),
    ).resolves.toBe(true);
  });

  it('protects classes referenced by student placements and operational records', async () => {
    vi.spyOn(AcademicSectionModel, 'exists').mockResolvedValue(null);
    vi.spyOn(SubjectModel, 'exists').mockResolvedValue(null);
    vi.spyOn(TeacherAssignmentModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentSectionPlacementModel, 'exists').mockResolvedValue({
      _id: recordId,
    } as never);
    vi.spyOn(StudentAttendanceModel, 'exists').mockResolvedValue(null);
    vi.spyOn(FeeStructureModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentInvoiceModel, 'exists').mockResolvedValue(null);
    vi.spyOn(ExamScheduleModel, 'exists').mockResolvedValue(null);
    vi.spyOn(HomeworkTestModel, 'exists').mockResolvedValue(null);

    await expect(
      new MongoAcademicsRepository().hasReference(
        organizationId,
        'class',
        recordId,
      ),
    ).resolves.toBe(true);
  });

  it('protects classes referenced by subject applicability mappings', async () => {
    vi.spyOn(AcademicSectionModel, 'exists').mockResolvedValue(null);
    vi.spyOn(SubjectModel, 'exists').mockResolvedValue({
      _id: recordId,
    } as never);
    vi.spyOn(TeacherAssignmentModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentSectionPlacementModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentAttendanceModel, 'exists').mockResolvedValue(null);
    vi.spyOn(FeeStructureModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentInvoiceModel, 'exists').mockResolvedValue(null);
    vi.spyOn(ExamScheduleModel, 'exists').mockResolvedValue(null);
    vi.spyOn(HomeworkTestModel, 'exists').mockResolvedValue(null);

    await expect(
      new MongoAcademicsRepository().hasReference(
        organizationId,
        'class',
        recordId,
      ),
    ).resolves.toBe(true);
  });

  it('protects sections referenced by student attendance and placements', async () => {
    vi.spyOn(TeacherAssignmentModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentSectionPlacementModel, 'exists').mockResolvedValue(null);
    vi.spyOn(StudentAttendanceModel, 'exists').mockResolvedValue({
      _id: recordId,
    } as never);
    vi.spyOn(ExamScheduleModel, 'exists').mockResolvedValue(null);
    vi.spyOn(HomeworkTestModel, 'exists').mockResolvedValue(null);

    await expect(
      new MongoAcademicsRepository().hasReference(
        organizationId,
        'section',
        recordId,
      ),
    ).resolves.toBe(true);
  });

  it('protects subjects referenced by exam schedules and homework', async () => {
    vi.spyOn(TeacherAssignmentModel, 'exists').mockResolvedValue(null);
    vi.spyOn(ExamScheduleModel, 'exists').mockResolvedValue(null);
    vi.spyOn(HomeworkTestModel, 'exists').mockResolvedValue({
      _id: recordId,
    } as never);

    await expect(
      new MongoAcademicsRepository().hasReference(
        organizationId,
        'subject',
        recordId,
      ),
    ).resolves.toBe(true);
  });

  it('protects terms referenced by exams', async () => {
    vi.spyOn(ExamModel, 'exists').mockResolvedValue({ _id: recordId } as never);

    await expect(
      new MongoAcademicsRepository().hasReference(
        organizationId,
        'term',
        recordId,
      ),
    ).resolves.toBe(true);
  });
});

it('protects teacher assignments referenced by timetable entries', async () => {
  const organizationId = '650000000000000000000001';
  const recordId = '650000000000000000000099';
  vi.spyOn(TeacherTimetableModel, 'exists').mockResolvedValue({
    _id: recordId,
  } as never);

  await expect(
    new MongoAcademicsRepository().hasReference(
      organizationId,
      'teacherAssignment',
      recordId,
    ),
  ).resolves.toBe(true);
});
