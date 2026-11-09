import { describe, expect, it, vi } from 'vitest';
import { ExaminationsService } from './examinations.service.js';
import type {
  ExamRecord,
  ExamScheduleRecord,
  ExamRosterStudent,
  ExaminationsContext,
  ExaminationsRepository,
} from './examinations.types.js';

const organizationId = '650000000000000000000001';
const campusId = '650000000000000000000002';
const academicYearId = '650000000000000000000003';
const examId = '650000000000000000000004';
const scheduleId = '650000000000000000000005';
const classId = '650000000000000000000006';
const sectionId = '650000000000000000000007';
const subjectId = '650000000000000000000008';
const userId = '650000000000000000000009';

const exam: ExamRecord = {
  id: examId,
  organizationId,
  name: 'Midterm',
  type: 'midterm',
  academicYearId,
  termId: '650000000000000000000010',
  campusId,
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  resultsPublishedAt: null,
  resultsPublishedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const schedule: ExamScheduleRecord = {
  id: scheduleId,
  examId,
  organizationId,
  subjectId,
  classId,
  sectionId,
  date: '2026-10-10',
  startTime: '09:00',
  durationMinutes: 60,
  totalMarks: 100,
  passingMarks: 40,
  marksReviewStatus: 'submitted',
  marksSubmittedAt: '2026-10-11T00:00:00.000Z',
  marksSubmittedBy: userId,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const teacherContext: ExaminationsContext = {
  organizationId,
  campusIds: [campusId],
  role: 'teacher',
  userId,
};

function makeRepository(assigned: boolean) {
  return {
    isTeacherAssignedToSection: vi.fn().mockResolvedValue(assigned),
    getSchedule: vi.fn().mockResolvedValue(schedule),
    getExam: vi.fn().mockResolvedValue(exam),
    listSchedules: vi.fn().mockResolvedValue([schedule]),
    setMarksReviewStatus: vi.fn().mockImplementation(async (_organizationId: string, _scheduleId: string, status: 'draft' | 'submitted' | 'changes_requested', submittedBy: string | null) => ({ ...schedule, marksReviewStatus: status, marksSubmittedAt: status === 'submitted' ? '2026-11-07T00:00:00.000Z' : null, marksSubmittedBy: submittedBy })),
    setResultsPublication: vi
      .fn()
      .mockImplementation(
        async (
          _organizationId: string,
          _examId: string,
          publishedAt: string | null,
          publishedByUserId: string | null,
        ) => ({
          ...exam,
          resultsPublishedAt: publishedAt,
          resultsPublishedBy: publishedByUserId,
        }),
      ),
    listRoster: vi.fn().mockResolvedValue([]),
    validateAcademicYear: vi.fn().mockResolvedValue(true),
    validateCampus: vi.fn().mockResolvedValue(true),
    validateTerm: vi.fn().mockResolvedValue(true),
    createExam: vi.fn().mockResolvedValue(exam),
    updateExam: vi.fn().mockResolvedValue(exam),
    validateSubject: vi.fn().mockResolvedValue(true),
    getClassCampus: vi.fn().mockResolvedValue(campusId),
    validateSection: vi.fn().mockResolvedValue(true),
    createSchedule: vi.fn().mockResolvedValue(schedule),
  } as unknown as ExaminationsRepository;
}

const managerContext: ExaminationsContext = {
  ...teacherContext,
  role: 'organization_owner',
};

const markedStudent: ExamRosterStudent = {
  id: '650000000000000000000011',
  firstName: 'Ali',
  lastName: 'Khan',
  mark: {
    id: '650000000000000000000012',
    organizationId,
    examScheduleId: scheduleId,
    studentId: '650000000000000000000011',
    isAbsent: false,
    marksObtained: 80,
    percentage: 80,
    grade: 'A',
    gpa: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('ExaminationsService annual and term-based exams', () => {
  const examInput = {
    name: 'Annual Examination',
    type: 'final' as const,
    academicYearId,
    campusId,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  };

  it.each(['monthly_test', 'class_test', 'mid_year', 'send_up', 'annual', 'practical', 'viva', 'supplementary', 'improvement'] as const)('accepts the %s internal exam category', async (type) => {
    const repo = makeRepository(true);
    const service = new ExaminationsService(repo);

    await service.createExam(managerContext, { ...examInput, type });

    expect(repo.createExam).toHaveBeenCalledWith(organizationId, expect.objectContaining({ type }));
  });

  it('creates an annual exam without requiring a term', async () => {
    const repo = makeRepository(true);
    const service = new ExaminationsService(repo);

    await service.createExam(managerContext, examInput);

    expect(repo.validateAcademicYear).toHaveBeenCalledWith(organizationId, academicYearId);
    expect(repo.validateTerm).not.toHaveBeenCalled();
    expect(repo.createExam).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ ...examInput, termId: null }),
    );
  });

  it('validates a selected term against the same academic year and exam dates', async () => {
    const repo = makeRepository(true);
    const service = new ExaminationsService(repo);
    const termId = '650000000000000000000010';

    await service.createExam(managerContext, { ...examInput, termId });

    expect(repo.validateTerm).toHaveBeenCalledWith(
      organizationId, academicYearId, termId, examInput.startDate, examInput.endDate,
    );
  });

  it('rejects a term that does not belong to the selected academic year or dates', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.validateTerm).mockResolvedValue(false);
    const service = new ExaminationsService(repo);

    await expect(service.createExam(managerContext, {
      ...examInput, termId: '650000000000000000000010',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(repo.createExam).not.toHaveBeenCalled();
  });

  it('allows an existing term-based exam to be converted to annual by clearing its term', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.getExam).mockResolvedValue(exam);
    const service = new ExaminationsService(repo);

    await service.updateExam(managerContext, examId, { termId: null });

    expect(repo.validateTerm).not.toHaveBeenCalled();
    expect(repo.updateExam).toHaveBeenCalledWith(
      organizationId, examId, expect.objectContaining({ termId: null }),
    );
  });
});

describe('ExaminationsService class-specific subjects', () => {
  it('rejects scheduling a subject outside its assigned class/group', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.validateSubject).mockResolvedValue(false);
    const service = new ExaminationsService(repo);
    await expect(
      service.createSchedule(managerContext, examId, {
        subjectId,
        classId,
        sectionId,
        date: '2026-10-10',
        startTime: '09:00',
        durationMinutes: 60,
        totalMarks: 100,
        passingMarks: 40,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repo.validateSubject).toHaveBeenCalledWith(
      organizationId,
      subjectId,
      classId,
    );
    expect(repo.createSchedule).not.toHaveBeenCalled();
  });
});

describe('ExaminationsService result publication', () => {
  it('refuses to publish while a scheduled class has missing student marks', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.listRoster).mockResolvedValue([
      { id: markedStudent.id, firstName: 'Ali', lastName: 'Khan' },
    ]);
    const service = new ExaminationsService(repo);

    await expect(
      service.setResultsPublication(managerContext, examId, true),
    ).rejects.toMatchObject({ code: 'RESULTS_NOT_READY', statusCode: 409 });
    expect(repo.setResultsPublication).not.toHaveBeenCalled();
  });

  it('requires marks review before publishing even when marks exist', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.listSchedules).mockResolvedValue([{ ...schedule, marksReviewStatus: 'draft' }]);
    vi.mocked(repo.listRoster).mockResolvedValue([markedStudent]);
    const service = new ExaminationsService(repo);
    await expect(service.setResultsPublication(managerContext, examId, true)).rejects.toMatchObject({ code: 'REVIEW_PENDING', statusCode: 409 });
    expect(repo.setResultsPublication).not.toHaveBeenCalled();
  });

  it('locks teacher edits after submission until admin requests changes', async () => {
    const repo = makeRepository(true);
    const service = new ExaminationsService(repo);
    await expect(service.saveMarks(teacherContext, scheduleId, [])).rejects.toMatchObject({ code: 'MARKS_ALREADY_SUBMITTED', statusCode: 409 });
  });

  it('submits completed marks for admin review', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.getSchedule).mockResolvedValue({ ...schedule, marksReviewStatus: 'draft' });
    vi.mocked(repo.listRoster).mockResolvedValue([markedStudent]);
    const service = new ExaminationsService(repo);
    await expect(service.submitMarksForReview(teacherContext, scheduleId)).resolves.toMatchObject({ marksReviewStatus: 'submitted', marksSubmittedBy: userId });
    expect(repo.setMarksReviewStatus).toHaveBeenCalledWith(organizationId, scheduleId, 'submitted', userId);
  });

  it('returns submitted marks to the teacher for correction', async () => {
    const repo = makeRepository(true);
    const service = new ExaminationsService(repo);
    await expect(service.requestMarksChanges(managerContext, scheduleId)).resolves.toMatchObject({ marksReviewStatus: 'changes_requested' });
    expect(repo.setMarksReviewStatus).toHaveBeenCalledWith(organizationId, scheduleId, 'changes_requested', null);
  });

  it('publishes only after every scheduled roster has marks', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.listRoster).mockResolvedValue([markedStudent]);
    const service = new ExaminationsService(repo);

    await expect(
      service.setResultsPublication(managerContext, examId, true),
    ).resolves.toMatchObject({
      resultsPublishedAt: expect.any(String),
      resultsPublishedBy: userId,
    });
    expect(repo.setResultsPublication).toHaveBeenCalledWith(
      organizationId,
      examId,
      expect.any(String),
      userId,
    );
  });

  it('blocks mark edits until published results are unpublished', async () => {
    const repo = makeRepository(true);
    vi.mocked(repo.getExam).mockResolvedValue({
      ...exam,
      resultsPublishedAt: '2026-10-28T08:00:00.000Z',
      resultsPublishedBy: userId,
    });
    const service = new ExaminationsService(repo);

    await expect(
      service.saveMarks(teacherContext, scheduleId, []),
    ).rejects.toMatchObject({
      code: 'RESULTS_ALREADY_PUBLISHED',
      statusCode: 409,
    });
    expect(repo.listRoster).not.toHaveBeenCalled();
  });
});

describe('ExaminationsService teacher assignment scope', () => {
  it('blocks reading a marks sheet for a section not assigned to the teacher', async () => {
    const repo = makeRepository(false);
    const service = new ExaminationsService(repo);

    await expect(
      service.getMarkSheet(teacherContext, scheduleId, sectionId),
    ).rejects.toMatchObject({ code: 'TEACHER_ASSIGNMENT_REQUIRED' });

    expect(repo.listRoster).not.toHaveBeenCalled();
    expect(repo.isTeacherAssignedToSection).toHaveBeenCalledWith(
      organizationId,
      userId,
      { classId, sectionId, subjectId, academicYearId },
    );
  });

  it('returns the roster for a subject and section assigned to the teacher', async () => {
    const repo = makeRepository(true);
    const service = new ExaminationsService(repo);

    await expect(
      service.getMarkSheet(teacherContext, scheduleId, sectionId),
    ).resolves.toEqual([]);

    expect(repo.listRoster).toHaveBeenCalledWith(
      organizationId,
      scheduleId,
      classId,
      sectionId,
      academicYearId,
    );
  });
});
