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
    createAcademicYear: vi.fn(),
    updateAcademicYear: vi.fn(),
    createClass: vi.fn(),
    ...overrides,
  } as unknown as AcademicsRepository;
}

describe('AcademicsService', () => {
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
