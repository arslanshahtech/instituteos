import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicClassModel,
  AcademicSectionModel,
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

describe('MongoAcademicsRepository tenant and campus scopes', () => {
  it('lists only classes belonging to the organization and assigned campuses', async () => {
    const find = vi.spyOn(AcademicClassModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
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
