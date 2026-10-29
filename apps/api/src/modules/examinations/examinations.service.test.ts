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
