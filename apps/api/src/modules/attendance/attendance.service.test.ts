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
    getAttendanceSettings: vi.fn().mockResolvedValue(null),
    getTeacherSelfAttendanceConfig: vi.fn().mockResolvedValue({
      viewOwnAttendance: true,
      selfMarkingEnabled: false,
      allowedStatuses: ['present'],
      timezone: 'Asia/Karachi',
    }),
    findActiveStaffForUser: vi
      .fn()
      .mockResolvedValue({ id: '650000000000000000000009', campusId }),
    isTeacherAssignedToSection: vi.fn().mockResolvedValue(true),
    getClassCampus: vi.fn().mockResolvedValue(campusId),
    validateSection: vi.fn().mockResolvedValue(true),
    listEligibleStudents: vi.fn().mockResolvedValue([]),
    validateAcademicYear: vi.fn().mockResolvedValue(true),
    validateActiveAcademicYear: vi.fn().mockResolvedValue(true),
    validateStudentEnrollment: vi.fn().mockResolvedValue(true),
    getSectionCapacity: vi.fn().mockResolvedValue(null),
    countActiveSectionPlacements: vi.fn().mockResolvedValue(0),
    validateStaff: vi.fn().mockResolvedValue({ campusId }),
    upsertStudentPlacements: vi.fn().mockResolvedValue({ id: 'placement' }),
    upsertStudentPlacementWithinCapacity: vi
      .fn()
      .mockResolvedValue({ id: 'placement' }),
    listStudentRoster: vi.fn().mockResolvedValue([
      { id: studentId, firstName: 'Ari', lastName: 'Lee' },
      { id: anotherStudentId, firstName: 'Sam', lastName: 'Kim' },
    ]),
    saveStudentAttendance: vi.fn().mockResolvedValue([]),
    listStudentAttendance: vi.fn().mockResolvedValue([]),
    saveStaffAttendance: vi.fn().mockResolvedValue({ id: 'staff-mark' }),
    createStaffAttendanceOnce: vi
      .fn()
      .mockResolvedValue({ id: 'self-staff-mark' }),
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

  it('blocks non-admin attendance submissions after the configured cutoff', async () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );
    const today =
      String(parts.year) + '-' + String(parts.month) + '-' + String(parts.day);
    const repo = repository({
      getAttendanceSettings: vi.fn().mockResolvedValue({
        timezone: 'Asia/Karachi',
        markingCutoffTime: '00:00',
        autoMarkUnmarkedAbsent: false,
        allowAdminOverride: false,
      }),
    });
    const service = new AttendanceService(repo);

    await expect(
      service.saveStudentAttendance(context, {
        ...baseBulkInput,
        date: today,
      }),
    ).rejects.toMatchObject({ code: 'ATTENDANCE_CUTOFF_PASSED' });
    expect(repo.listStudentRoster).not.toHaveBeenCalled();
    expect(repo.saveStudentAttendance).not.toHaveBeenCalled();
  });

  it('allows an organization admin to correct attendance after cutoff when override is enabled', async () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );
    const today =
      String(parts.year) + '-' + String(parts.month) + '-' + String(parts.day);
    const repo = repository({
      getAttendanceSettings: vi.fn().mockResolvedValue({
        timezone: 'Asia/Karachi',
        markingCutoffTime: '00:00',
        autoMarkUnmarkedAbsent: false,
        allowAdminOverride: true,
      }),
    });
    const service = new AttendanceService(repo);

    await service.saveStudentAttendance(
      { ...context, role: 'organization_admin' },
      {
        ...baseBulkInput,
        date: today,
      },
    );
    expect(repo.saveStudentAttendance).toHaveBeenCalledOnce();
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

  it('restricts teacher attendance history to academic years assigned for that section', async () => {
    const teacherContext: AttendanceContext = {
      ...context,
      role: 'teacher',
      userId: '650000000000000000000008',
    };
    const assignments = [
      {
        id: 'assignment-current',
        classId,
        className: 'Grade 8',
        sectionId,
        sectionName: 'A',
        academicYearId,
        academicYearName: '2026',
        campusId,
        campusName: 'Main Campus',
      },
      {
        id: 'assignment-other-section',
        classId,
        className: 'Grade 8',
        sectionId: '650000000000000000000099',
        sectionName: 'B',
        academicYearId: '650000000000000000000098',
        academicYearName: '2025',
        campusId,
        campusName: 'Main Campus',
      },
    ];
    const repo = repository({
      listTeacherAssignmentsForUser: vi.fn().mockResolvedValue(assignments),
    });
    const service = new AttendanceService(repo);

    await service.listStudentAttendance(teacherContext, {
      sectionId,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });

    expect(repo.listStudentAttendance).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        sectionId,
        academicYearIds: [academicYearId],
      }),
      [campusId],
    );
  });

  it('blocks attendance history when a teacher has no assignment for the selected section', async () => {
    const repo = repository({
      listTeacherAssignmentsForUser: vi.fn().mockResolvedValue([
        {
          id: 'other-assignment',
          classId,
          className: 'Grade 8',
          sectionId: '650000000000000000000099',
          sectionName: 'B',
          academicYearId,
          academicYearName: '2026',
          campusId,
          campusName: 'Main Campus',
        },
      ]),
    });
    const service = new AttendanceService(repo);

    await expect(
      service.listStudentAttendance(
        {
          ...context,
          role: 'teacher',
          userId: '650000000000000000000008',
        },
        { sectionId },
      ),
    ).rejects.toMatchObject({ code: 'TEACHER_ASSIGNMENT_REQUIRED' });
    expect(repo.listStudentAttendance).not.toHaveBeenCalled();
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
    expect(repo.upsertStudentPlacementWithinCapacity).not.toHaveBeenCalled();
  });

  it('blocks a new placement when the atomic repository capacity check is reached', async () => {
    const repo = repository({
      upsertStudentPlacementWithinCapacity: vi.fn().mockRejectedValue({
        statusCode: 409,
        code: 'SECTION_CAPACITY_REACHED',
      }),
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
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SECTION_CAPACITY_REACHED',
    });
    expect(repo.upsertStudentPlacementWithinCapacity).toHaveBeenCalledWith(
      organizationId,
      { studentId, classId, sectionId, academicYearId, campusId },
    );
  });

  it('uses the atomic repository method for a valid student placement', async () => {
    const repo = repository();
    const service = new AttendanceService(repo);

    await service.placeStudent(context, {
      studentId,
      classId,
      sectionId,
      academicYearId,
      campusId,
    });

    expect(repo.upsertStudentPlacementWithinCapacity).toHaveBeenCalledWith(
      organizationId,
      { studentId, classId, sectionId, academicYearId, campusId },
    );
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

  it('allows a teacher to view only their linked staff attendance history', async () => {
    const repo = repository({
      listStaffAttendance: vi.fn().mockResolvedValue([{ id: 'history' }]),
    });
    const service = new AttendanceService(repo);
    const teacherContext = {
      ...context,
      role: 'teacher',
      userId: '650000000000000000000008',
    };

    const result = await service.getTeacherSelfAttendance(teacherContext, {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });

    expect(result.items).toEqual([{ id: 'history' }]);
    expect(repo.findActiveStaffForUser).toHaveBeenCalledWith(
      organizationId,
      teacherContext.userId,
    );
    expect(repo.listStaffAttendance).toHaveBeenCalledWith(
      organizationId,
      {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        staffId: '650000000000000000000009',
      },
      [campusId],
    );
  });

  it('blocks non-teachers and respects the institute history policy', async () => {
    const repo = repository({
      getTeacherSelfAttendanceConfig: vi.fn().mockResolvedValue({
        viewOwnAttendance: false,
        selfMarkingEnabled: false,
        allowedStatuses: ['present'],
        timezone: 'Asia/Karachi',
      }),
    });
    const service = new AttendanceService(repo);
    await expect(
      service.getTeacherSelfAttendance(context),
    ).rejects.toMatchObject({ code: 'ROLE_REQUIRED' });
    await expect(
      service.getTeacherSelfAttendance({
        ...context,
        role: 'teacher',
        userId: '650000000000000000000008',
      }),
    ).rejects.toMatchObject({ code: 'SELF_ATTENDANCE_VIEW_DISABLED' });
    expect(repo.findActiveStaffForUser).not.toHaveBeenCalled();
  });

  it('allows self-marking only when enabled and uses the linked staff profile', async () => {
    const repo = repository({
      getTeacherSelfAttendanceConfig: vi.fn().mockResolvedValue({
        viewOwnAttendance: true,
        selfMarkingEnabled: true,
        allowedStatuses: ['present', 'half-day'],
        timezone: 'Asia/Karachi',
      }),
    });
    const service = new AttendanceService(repo);
    const teacherContext = {
      ...context,
      role: 'teacher',
      userId: '650000000000000000000008',
    };
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    await expect(
      service.saveTeacherSelfAttendance(teacherContext, {
        date: today,
        status: 'present',
        remarks: '  On time  ',
      }),
    ).resolves.toEqual({ id: 'self-staff-mark' });
    expect(repo.createStaffAttendanceOnce).toHaveBeenCalledWith(
      organizationId,
      campusId,
      teacherContext.userId,
      {
        staffId: '650000000000000000000009',
        date: today,
        status: 'present',
        remarks: 'On time',
      },
    );
    expect(repo.saveStaffAttendance).not.toHaveBeenCalled();
  });

  it('blocks self-marking when disabled, for disallowed statuses, or for past dates', async () => {
    const teacherContext = {
      ...context,
      role: 'teacher',
      userId: '650000000000000000000008',
    };
    const disabledRepo = repository();
    await expect(
      new AttendanceService(disabledRepo).saveTeacherSelfAttendance(
        teacherContext,
        {
          date: '2026-10-12',
          status: 'present',
        },
      ),
    ).rejects.toMatchObject({ code: 'SELF_ATTENDANCE_MARKING_DISABLED' });

    const enabledRepo = repository({
      getTeacherSelfAttendanceConfig: vi.fn().mockResolvedValue({
        viewOwnAttendance: true,
        selfMarkingEnabled: true,
        allowedStatuses: ['present'],
        timezone: 'Asia/Karachi',
      }),
    });
    const service = new AttendanceService(enabledRepo);
    await expect(
      service.saveTeacherSelfAttendance(teacherContext, {
        date: '2026-10-12',
        status: 'absent',
      }),
    ).rejects.toMatchObject({ code: 'SELF_ATTENDANCE_STATUS_NOT_ALLOWED' });
    await expect(
      service.saveTeacherSelfAttendance(teacherContext, {
        date: '2026-10-12',
        status: 'present',
      }),
    ).rejects.toMatchObject({ code: 'SELF_ATTENDANCE_DATE_RESTRICTED' });
    expect(enabledRepo.createStaffAttendanceOnce).not.toHaveBeenCalled();
  });
});
