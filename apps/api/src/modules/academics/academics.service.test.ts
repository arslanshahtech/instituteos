import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../errors/app-error.js';
import { AcademicsService } from './academics.service.js';
import type {
  AcademicsContext,
  AcademicsRepository,
  ClassRecord,
  SectionRecord,
} from './academics.types.js';

const context: AcademicsContext = {
  organizationId: '650000000000000000000001',
  campusIds: ['650000000000000000000002'],
  role: 'academic_coordinator',
};

const classRecord: ClassRecord = {
  id: '650000000000000000000003',
  organizationId: context.organizationId,
  campusId: context.campusIds[0]!,
  name: 'Grade 8',
  code: 'G8',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sectionRecord: SectionRecord = {
  id: '650000000000000000000004',
  organizationId: context.organizationId,
  classId: classRecord.id,
  name: 'A',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function repository(overrides: Partial<AcademicsRepository> = {}) {
  return {
    validateStaff: vi.fn().mockResolvedValue(true),
    validateSubject: vi.fn().mockResolvedValue(true),
    getSubject: vi.fn().mockResolvedValue({
      id: '650000000000000000000007',
      organizationId: context.organizationId,
      name: 'Mathematics',
      code: 'MATH',
      classIds: [],
    }),
    getClass: vi.fn().mockResolvedValue(classRecord),
    getSection: vi.fn().mockResolvedValue(sectionRecord),
    validateAcademicYear: vi.fn().mockResolvedValue(true),
    findTeacherAssignmentConflict: vi.fn().mockResolvedValue(false),
    createTeacherAssignment: vi.fn().mockResolvedValue({ id: 'assignment' }),
    getAcademicYear: vi.fn().mockResolvedValue({
      id: '650000000000000000000005',
      organizationId: context.organizationId,
      name: '2026–2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    createTerm: vi.fn().mockResolvedValue({ id: 'term' }),
    hasOverlappingTerm: vi.fn().mockResolvedValue(false),
    termsFitAcademicYear: vi.fn().mockResolvedValue(true),
    createAcademicYear: vi.fn(),
    updateAcademicYear: vi.fn(),
    activateAcademicYear: vi.fn(),
    createClass: vi.fn(),
    createSubject: vi.fn().mockResolvedValue({ id: 'subject' }),
    ...overrides,
  } as unknown as AcademicsRepository;
}

describe('AcademicsService', () => {
  it('creates new academic years as archived until an authorized lifecycle activation', async () => {
    const repo = repository({
      createAcademicYear: vi
        .fn()
        .mockResolvedValue({ id: 'year', status: 'archived' }),
    });
    const service = new AcademicsService(repo);

    await service.createAcademicYear(context, {
      name: '2027–2028',
      startDate: '2027-09-01',
      endDate: '2028-06-30',
    });

    expect(repo.createAcademicYear).toHaveBeenCalledWith(
      context.organizationId,
      {
        name: '2027–2028',
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        status: 'archived',
      },
    );
  });

  it('persists a validated class display order', async () => {
    const repo = repository({
      createClass: vi.fn().mockResolvedValue({ ...classRecord, sortOrder: 4 }),
    });
    const service = new AcademicsService(repo);

    await service.createClass(context, {
      name: 'Grade 8',
      code: 'G8',
      campusId: context.campusIds[0]!,
      sortOrder: 4,
    });

    expect(repo.createClass).toHaveBeenCalledWith(
      context.organizationId,
      expect.objectContaining({ sortOrder: 4 }),
    );
  });

  it('rejects an invalid class display order', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);

    await expect(
      service.createClass(context, {
        name: 'Grade 8',
        code: 'G8',
        campusId: context.campusIds[0]!,
        sortOrder: -1,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repo.createClass).not.toHaveBeenCalled();
  });

  it('activates a new academic year through the atomic repository transition', async () => {
    const repo = repository({
      activateAcademicYear: vi.fn().mockResolvedValue({
        id: '650000000000000000000005',
        status: 'active',
      }),
    });
    const service = new AcademicsService(repo);

    await service.updateAcademicYear(context, '650000000000000000000005', {
      status: 'active',
    });

    expect(repo.activateAcademicYear).toHaveBeenCalledWith(
      context.organizationId,
      '650000000000000000000005',
      { status: 'active' },
    );
    expect(repo.updateAcademicYear).not.toHaveBeenCalled();
  });

  it('rejects academic year dates with an invalid range', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);

    await expect(
      service.createAcademicYear(context, {
        name: '2026–2027',
        startDate: '2027-06-30',
        endDate: '2026-09-01',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(repo.createAcademicYear).not.toHaveBeenCalled();
  });

  it('keeps terms within the selected academic year', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);

    await expect(
      service.createTerm(context, {
        name: 'Summer term',
        academicYearId: '650000000000000000000005',
        startDate: '2027-06-01',
        endDate: '2027-07-01',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(repo.createTerm).not.toHaveBeenCalled();
  });

  it('rejects a term whose dates overlap another term in the same year', async () => {
    const repo = repository({
      hasOverlappingTerm: vi.fn().mockResolvedValue(true),
    });
    const service = new AcademicsService(repo);

    await expect(
      service.createTerm(context, {
        name: 'Term 2',
        academicYearId: '650000000000000000000005',
        startDate: '2027-01-01',
        endDate: '2027-03-31',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TERM_DATE_OVERLAP' });
    expect(repo.createTerm).not.toHaveBeenCalled();
  });

  it('does not allow changing an academic year to exclude an existing term', async () => {
    const repo = repository({
      termsFitAcademicYear: vi.fn().mockResolvedValue(false),
    });
    const service = new AcademicsService(repo);

    await expect(
      service.updateAcademicYear(context, '650000000000000000000005', {
        endDate: '2027-06-01',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_IN_USE' });

    expect(repo.updateAcademicYear).not.toHaveBeenCalled();
  });

  it('requires new subjects to be assigned to at least one class or college group', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);
    await expect(
      service.createSubject(context, {
        name: 'Biology',
        code: 'BIO',
        classIds: [],
        totalMarks: 100,
        passingPercentage: 40,
      }),
    ).rejects.toMatchObject({ code: 'SUBJECT_CLASS_REQUIRED' });
    expect(repo.createSubject).not.toHaveBeenCalled();
  });

  it('validates class mapping when creating a subject', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);
    await service.createSubject(context, {
      name: 'Biology',
      code: 'BIO',
      classIds: [classRecord.id],
      totalMarks: 100,
      passingPercentage: 40,
    });
    expect(repo.getClass).toHaveBeenCalledWith(
      context.organizationId,
      classRecord.id,
      context.campusIds,
    );
    expect(repo.createSubject).toHaveBeenCalledWith(
      context.organizationId,
      expect.objectContaining({ classIds: [classRecord.id] }),
    );
  });

  it('requires a program/group name when a college study level is selected', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);
    await expect(
      service.createClass(context, {
        name: 'First Year',
        code: 'FY',
        campusId: context.campusIds[0]!,
        studyLevel: 'first_year',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repo.createClass).not.toHaveBeenCalled();
  });

  it('stores college study level and program name on the class record', async () => {
    const repo = repository({
      createClass: vi.fn().mockResolvedValue({
        ...classRecord,
        studyLevel: 'first_year',
        programName: 'FSc Pre-Medical',
      }),
    });
    const service = new AcademicsService(repo);
    await service.createClass(context, {
      name: 'First Year',
      code: 'FY-FSC-PM',
      campusId: context.campusIds[0]!,
      studyLevel: 'first_year',
      programName: 'FSc Pre-Medical',
    });
    expect(repo.createClass).toHaveBeenCalledWith(
      context.organizationId,
      expect.objectContaining({
        studyLevel: 'first_year',
        programName: 'FSc Pre-Medical',
      }),
    );
  });

  it('rejects classes outside the authenticated campus scope', async () => {
    const repo = repository();
    const service = new AcademicsService(repo);

    await expect(
      service.createClass(context, {
        name: 'Grade 9',
        code: 'G9',
        campusId: '650000000000000000000099',
      }),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    expect(repo.createClass).not.toHaveBeenCalled();
  });

  it('rejects a non-teaching staff profile as a teacher assignment', async () => {
    const repo = repository({
      validateStaff: vi.fn().mockResolvedValue(false),
    });
    const service = new AcademicsService(repo);

    await expect(
      service.createTeacherAssignment(context, {
        teacherStaffId: '650000000000000000000006',
        subjectId: '650000000000000000000007',
        classId: classRecord.id,
        sectionId: sectionRecord.id,
        academicYearId: '650000000000000000000005',
      }),
    ).rejects.toMatchObject({ code: 'STAFF_MEMBER_NOT_FOUND' });

    expect(repo.createTeacherAssignment).not.toHaveBeenCalled();
    expect(repo.validateSubject).not.toHaveBeenCalled();
  });

  it('rejects a teacher assignment when the teacher is already assigned to that section and year', async () => {
    const repo = repository({
      findTeacherAssignmentConflict: vi.fn().mockResolvedValue(true),
    });
    const service = new AcademicsService(repo);

    await expect(
      service.createTeacherAssignment(context, {
        teacherStaffId: '650000000000000000000006',
        subjectId: '650000000000000000000007',
        classId: classRecord.id,
        sectionId: sectionRecord.id,
        academicYearId: '650000000000000000000005',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'TEACHER_ASSIGNMENT_CONFLICT',
    } satisfies Partial<AppError>);

    expect(repo.createTeacherAssignment).not.toHaveBeenCalled();
  });

  it('rejects teacher assignment when the subject is not mapped to the selected college group', async () => {
    const repo = repository({
      getSubject: vi.fn().mockResolvedValue({
        id: '650000000000000000000007',
        organizationId: context.organizationId,
        name: 'Biology',
        code: 'BIO',
        classIds: ['650000000000000000000099'],
      }),
    });
    const service = new AcademicsService(repo);
    await expect(
      service.createTeacherAssignment(context, {
        teacherStaffId: '650000000000000000000006',
        subjectId: '650000000000000000000007',
        classId: classRecord.id,
        sectionId: sectionRecord.id,
        academicYearId: '650000000000000000000005',
      }),
    ).rejects.toMatchObject({ code: 'SUBJECT_NOT_AVAILABLE_FOR_CLASS' });
    expect(repo.createTeacherAssignment).not.toHaveBeenCalled();
  });

  it('rejects assignments when their section does not belong to the selected class', async () => {
    const repo = repository({
      getSection: vi.fn().mockResolvedValue({
        ...sectionRecord,
        classId: '650000000000000000000099',
      }),
    });
    const service = new AcademicsService(repo);

    await expect(
      service.createTeacherAssignment(context, {
        teacherStaffId: '650000000000000000000006',
        subjectId: '650000000000000000000007',
        classId: classRecord.id,
        sectionId: sectionRecord.id,
        academicYearId: '650000000000000000000005',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(repo.findTeacherAssignmentConflict).not.toHaveBeenCalled();
  });
});

it('does not delete a term that is already used by an exam', async () => {
  const term = {
    id: '650000000000000000000008',
    organizationId: context.organizationId,
    name: 'First term',
    academicYearId: '650000000000000000000005',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const repo = repository({
    getTerm: vi.fn().mockResolvedValue(term),
    hasReference: vi.fn().mockResolvedValue(true),
    deleteTerm: vi.fn(),
  });
  const service = new AcademicsService(repo);

  await expect(service.deleteTerm(context, term.id)).rejects.toMatchObject({
    statusCode: 409,
    code: 'RESOURCE_IN_USE',
  });
  expect(repo.hasReference).toHaveBeenCalledWith(
    context.organizationId,
    'term',
    term.id,
  );
  expect(repo.deleteTerm).not.toHaveBeenCalled();
});

it('does not change an assignment while a timetable entry depends on it', async () => {
  const assignment = {
    id: '650000000000000000000009',
    organizationId: context.organizationId,
    teacherStaffId: '650000000000000000000006',
    subjectId: '650000000000000000000007',
    classId: classRecord.id,
    sectionId: sectionRecord.id,
    academicYearId: '650000000000000000000005',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const repo = repository({
    getTeacherAssignment: vi.fn().mockResolvedValue(assignment),
    hasReference: vi.fn().mockResolvedValue(true),
    updateTeacherAssignment: vi.fn(),
  });
  const service = new AcademicsService(repo);

  await expect(
    service.updateTeacherAssignment(context, assignment.id, {
      ...assignment,
      teacherStaffId: '650000000000000000000010',
    }),
  ).rejects.toMatchObject({ code: 'RESOURCE_IN_USE' });
  expect(repo.updateTeacherAssignment).not.toHaveBeenCalled();
});
