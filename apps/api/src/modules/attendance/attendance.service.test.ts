import { describe, expect, it, vi } from 'vitest';
import { AttendanceService } from './attendance.service.js';
import type {
  AttendanceContext,
  AttendanceRepository,
  StudentAttendanceBulkInput,
} from './attendance.types.js';

const organizationId = '650000000000000000000001';
const campusId = '650000000000000000000002';
const classId = '650000000000000000000003';
const sectionId = '650000000000000000000004';
const academicYearId = '650000000000000000000005';
const studentId = '650000000000000000000006';
const anotherStudentId = '650000000000000000000007';

const context: AttendanceContext = {
  organizationId,
  campusIds: [campusId],
  role: 'academic_coordinator',
};

function repository(overrides: Partial<AttendanceRepository> = {}) {
  return {
    listTeacherAssignmentsForUser: vi.fn().mockResolvedValue([]),
    isTeacherAssignedToSection: vi.fn().mockResolvedValue(true),
    getClassCampus: vi.fn().mockResolvedValue(campusId),
    validateSection: vi.fn().mockResolvedValue(true),
    listEligibleStudents: vi.fn().mockResolvedValue([]),
    validateAcademicYear: vi.fn().mockResolvedValue(true),
    validateActiveAcademicYear: vi.fn().mockResolvedValue(true),
    validateStudentEnrollment: vi.fn().mockResolvedValue(true),
    validateStaff: vi.fn().mockResolvedValue({ campusId }),
    upsertStudentPlacements: vi.fn().mockResolvedValue({ id: 'placement' }),
    listStudentRoster: vi.fn().mockResolvedValue([
      { id: studentId, firstName: 'Ari', lastName: 'Lee' },
      { id: anotherStudentId, firstName: 'Sam', lastName: 'Kim' },
    ]),
    saveStudentAttendance: vi.fn().mockResolvedValue([]),
    listStudentAttendance: vi.fn().mockResolvedValue([]),
    saveStaffAttendance: vi.fn().mockResolvedValue({ id: 'staff-mark' }),
    listStaffAttendance: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as AttendanceRepository;
}

const baseBulkInput: StudentAttendanceBulkInput = {
  classId,
  sectionId,
  academicYearId,
  campusId,
  date: '2026-10-12',
  records: [
    { studentId, status: 'present' },
    { studentId: anotherStudentId, status: 'absent' },
  ],
};

describe('AttendanceService', () => {
  it('removes a student from the selected section without deleting the student record', async () => {
    const repo = repository({
      deactivateStudentPlacement: vi.fn().mockResolvedValue(true),
    });
    const service = new AttendanceService(repo);

    await expect(
      service.removeStudentFromSection(context, {
        studentId,
        classId,
        sectionId,
        academicYearId,
        campusId,
      }),
    ).resolves.toEqual({ removed: true });
    expect(repo.deactivateStudentPlacement).toHaveBeenCalledWith(
      organizationId,
      {
        studentId,
        classId,
        sectionId,
        academicYearId,
        campusId,
      },
    );
  });

  it('accepts Leave as a valid student attendance status', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await service.saveStudentAttendance(context, {
      ...baseBulkInput,
      records: [
        { studentId, status: 'leave' },
        { studentId: anotherStudentId, status: 'present' },
      ],
    });

    expect(repo.saveStudentAttendance).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        records: [
          { studentId, status: 'leave' },
          { studentId: anotherStudentId, status: 'present' },
        ],
      }),
    );
  });

  it('accepts Late as a valid student attendance status', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await service.saveStudentAttendance(context, {
      ...baseBulkInput,
      records: [
        { studentId, status: 'late' },
        { studentId: anotherStudentId, status: 'present' },
      ],
    });

    expect(repo.saveStudentAttendance).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        records: [
          { studentId, status: 'late' },
          { studentId: anotherStudentId, status: 'present' },
        ],
      }),
    );
  });

  it('lets a teacher take attendance only for an assigned section', async () => {
    const repo = repository({
      isTeacherAssignedToSection: vi.fn().mockResolvedValue(true),
    });
    const service = new AttendanceService(repo);
    const teacherContext: AttendanceContext = {
      ...context,
      role: 'teacher',
      userId: '650000000000000000000008',
    };

    await service.listStudentRoster(teacherContext, {
      classId,
      sectionId,
      academicYearId,
      campusId,
      date: '2026-10-12',
    });

    expect(repo.isTeacherAssignedToSection).toHaveBeenCalledWith(
      organizationId,
      teacherContext.userId,
      { classId, sectionId, academicYearId },
    );
    expect(repo.listStudentRoster).toHaveBeenCalled();
  });

  it('blocks a teacher from reading another section', async () => {
    const repo = repository({
      isTeacherAssignedToSection: vi.fn().mockResolvedValue(false),
    });
    const service = new AttendanceService(repo);
    const teacherContext: AttendanceContext = {
      ...context,
      role: 'teacher',
      userId: '650000000000000000000008',
    };

    await expect(
      service.listStudentRoster(teacherContext, {
        classId,
        sectionId,
        academicYearId,
        campusId,
        date: '2026-10-12',
      }),
    ).rejects.toMatchObject({ code: 'TEACHER_ASSIGNMENT_REQUIRED' });

    expect(repo.listStudentRoster).not.toHaveBeenCalled();
  });

  it('rejects dates outside the active academic year', async () => {
    const repo = repository({
      validateAcademicYear: vi.fn().mockResolvedValue(false),
    });
    const service = new AttendanceService(repo);

    await expect(
      service.listStudentRoster(context, {
        classId,
        sectionId,
        academicYearId,
        campusId,
        date: '2026-10-12',
      }),
    ).rejects.toMatchObject({ code: 'DATE_OUTSIDE_ACADEMIC_YEAR' });

    expect(repo.listStudentRoster).not.toHaveBeenCalled();
  });

  it('rejects campus administrators outside their assigned campus', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await expect(
      service.listStudentRoster(
        { ...context, role: 'campus_admin' },
        {
          classId,
          sectionId,
          academicYearId,
          campusId: '650000000000000000000099',
          date: '2026-10-12',
        },
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    expect(repo.getClassCampus).not.toHaveBeenCalled();
  });

  it('requires the complete section roster for a bulk submission', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await expect(
      service.saveStudentAttendance(context, {
        ...baseBulkInput,
        records: [{ studentId, status: 'present' }],
      }),
    ).rejects.toMatchObject({ code: 'ROSTER_MISMATCH' });

    expect(repo.saveStudentAttendance).not.toHaveBeenCalled();
  });

  it('rejects duplicate students in a bulk submission', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await expect(
      service.saveStudentAttendance(context, {
        ...baseBulkInput,
        records: [
          { studentId, status: 'present' },
          { studentId, status: 'absent' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_STUDENT' });

    expect(repo.saveStudentAttendance).not.toHaveBeenCalled();
  });

  it('rejects invalid calendar dates before reading the roster', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await expect(
      service.saveStudentAttendance(context, {
        ...baseBulkInput,
        date: '2026-02-30',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(repo.listStudentRoster).not.toHaveBeenCalled();
  });

  it('validates enrollment and selected section before placing a student', async () => {
    const repo = repository({
      validateStudentEnrollment: vi.fn().mockResolvedValue(false),
    });
    const service = new AttendanceService(repo);

    await expect(
      service.placeStudent(context, {
        studentId,
        classId,
        sectionId,
        academicYearId,
        campusId,
      }),
    ).rejects.toMatchObject({ code: 'STUDENT_NOT_ACTIVE_AT_CAMPUS' });

    expect(repo.validateSection).toHaveBeenCalledWith(
      organizationId,
      classId,
      sectionId,
    );
    expect(repo.upsertStudentPlacements).not.toHaveBeenCalled();
  });

  it('rejects staff records outside the current campus scope', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await expect(
      service.saveStaffAttendance(
        {
          ...context,
          role: 'campus_admin',
          campusIds: ['650000000000000000000099'],
        },
        { staffId: studentId, date: '2026-10-12', status: 'present' },
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    expect(repo.saveStaffAttendance).not.toHaveBeenCalled();
  });

  it('rejects a roster class-section mismatch', async () => {
    const repo = repository({
      validateSection: vi.fn().mockResolvedValue(false),
    });
    const service = new AttendanceService(repo);

    await expect(
      service.saveStudentAttendance(context, baseBulkInput),
    ).rejects.toMatchObject({ code: 'SECTION_NOT_FOUND' });

    expect(repo.saveStudentAttendance).not.toHaveBeenCalled();
  });
});
