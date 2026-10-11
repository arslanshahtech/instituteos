import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  ExamInput,
  ExamMarkInput,
  ExamRecord,
  ExamScheduleInput,
  ExaminationsContext,
  ExaminationsRepository,
  GradeBreakdown,
  GradingScaleInput,
  StudentExamReport,
} from './examinations.types.js';

const examTypes = ['midterm', 'final', 'quiz'] as const;

function text(value: string | undefined, field: string, max: number): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > max)
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return normalized;
}

function id(value: string | undefined, field: string): string {
  if (!value || !mongoose.isValidObjectId(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  return value;
}

function date(value: string | undefined, field: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return value;
}

function campusScope(context: ExaminationsContext): string[] | undefined {
  if (context.role === 'campus_admin' && context.campusIds.length === 0)
    return [];
  return context.campusIds.length ? context.campusIds : undefined;
}

function assertCampus(context: ExaminationsContext, campusId: string) {
  if (
    (context.role === 'campus_admin' || context.campusIds.length > 0) &&
    !context.campusIds.includes(campusId)
  )
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
}

function dateRange(startDate: string, endDate: string) {
  if (startDate > endDate)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'The end date must be on or after the start date.',
    );
}

function normalizeExam(input: ExamInput): ExamInput {
  const normalized = {
    name: text(input.name, 'exam name', 120),
    type: input.type,
    academicYearId: id(input.academicYearId, 'academic year'),
    termId: id(input.termId, 'term'),
    campusId: id(input.campusId, 'campus'),
    startDate: date(input.startDate, 'start date'),
    endDate: date(input.endDate, 'end date'),
  };
  if (!examTypes.includes(normalized.type))
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid exam type.');
  dateRange(normalized.startDate, normalized.endDate);
  return normalized;
}

function normalizeSchedule(input: ExamScheduleInput): ExamScheduleInput {
  const normalized = {
    subjectId: id(input.subjectId, 'subject'),
    classId: id(input.classId, 'class'),
    sectionId: id(input.sectionId, 'section'),
    date: date(input.date, 'schedule date'),
    startTime: text(input.startTime, 'start time', 5),
    durationMinutes: input.durationMinutes,
    totalMarks: input.totalMarks,
    passingMarks: input.passingMarks,
  };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized.startTime))
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid start time.');
  if (
    !Number.isInteger(normalized.durationMinutes) ||
    normalized.durationMinutes < 1 ||
    normalized.durationMinutes > 1440 ||
    !Number.isFinite(normalized.totalMarks) ||
    normalized.totalMarks <= 0 ||
    normalized.totalMarks > 100000 ||
    !Number.isFinite(normalized.passingMarks) ||
    normalized.passingMarks < 0 ||
    normalized.passingMarks > normalized.totalMarks
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter valid duration, total marks, and passing marks.',
    );
  return normalized;
}

function normalizeBreakdowns(values: GradeBreakdown[]): GradeBreakdown[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 30)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Add between 1 and 30 grade bands.',
    );
  const grades = new Set<string>();
  const sorted = values.map((item) => {
    const grade = text(item.grade, 'grade label', 10);
    if (grades.has(grade))
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Grade labels must be unique.',
      );
    grades.add(grade);
    if (
      !Number.isFinite(item.minPercentage) ||
      !Number.isFinite(item.maxPercentage) ||
      !Number.isFinite(item.gpa) ||
      item.minPercentage < 0 ||
      item.maxPercentage > 100 ||
      item.minPercentage > item.maxPercentage ||
      item.gpa < 0 ||
      item.gpa > 10
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter valid grade percentage ranges and GPA values.',
      );
    return { ...item, grade };
  });
  sorted.sort((a, b) => a.minPercentage - b.minPercentage);
  if (
    sorted[0]?.minPercentage !== 0 ||
    sorted[sorted.length - 1]?.maxPercentage !== 100 ||
    sorted.some((item, index) => {
      const next = sorted[index + 1];
      return next
        ? Math.abs(item.maxPercentage - next.minPercentage) > 0.000001
        : false;
    })
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Grade ranges must cover 0–100 without gaps or overlaps.',
    );
  return sorted;
}

export class ExaminationsService {
  constructor(private readonly repository: ExaminationsRepository) {}

  listExams(
    context: ExaminationsContext,
    filter: { campusId?: string; termId?: string },
  ) {
    if (filter.campusId) assertCampus(context, filter.campusId);
    return this.repository.listExams(
      context.organizationId,
      campusScope(context),
      filter.campusId,
      filter.termId,
    );
  }

  async createExam(context: ExaminationsContext, input: ExamInput) {
    const normalized = normalizeExam(input);
    assertCampus(context, normalized.campusId);
    if (!(await this.repository.validateCampus(context.organizationId, normalized.campusId)))
      throw new AppError(400, 'VALIDATION_ERROR', 'Select an active campus.');
    if (
      !(await this.repository.validateAcademicYear(
        context.organizationId,
        normalized.academicYearId,
      )) ||
      !(await this.repository.validateTerm(
        context.organizationId,
        normalized.academicYearId,
        normalized.termId,
        normalized.startDate,
        normalized.endDate,
      ))
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a term within the selected academic year and exam dates.',
      );
    return this.repository.createExam(context.organizationId, normalized);
  }

  async updateExam(
    context: ExaminationsContext,
    examId: string,
    input: Partial<ExamInput>,
  ) {
    const current = await this.requiredExam(context, examId);
    const normalized = normalizeExam({ ...current, ...input });
    assertCampus(context, normalized.campusId);
    if (!(await this.repository.validateCampus(context.organizationId, normalized.campusId)))
      throw new AppError(400, 'VALIDATION_ERROR', 'Select an active campus.');
    if (
      !(await this.repository.validateAcademicYear(
        context.organizationId,
        normalized.academicYearId,
      )) ||
      !(await this.repository.validateTerm(
        context.organizationId,
        normalized.academicYearId,
        normalized.termId,
        normalized.startDate,
        normalized.endDate,
      ))
    )
      throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid term.');
    return this.requiredResult(
      this.repository.updateExam(context.organizationId, examId, normalized),
      'Exam',
    );
  }

  async deleteExam(context: ExaminationsContext, examId: string) {
    await this.requiredExam(context, examId);
    if (await this.repository.hasSchedules(context.organizationId, examId))
      throw new AppError(
        409,
        'RESOURCE_IN_USE',
        'Remove exam schedules before deleting this exam.',
      );
    return this.repository.deleteExam(context.organizationId, examId);
  }

  async listSchedules(context: ExaminationsContext, examId: string) {
    const exam = await this.requiredExam(context, examId);
    assertCampus(context, exam.campusId);
    return this.repository.listSchedules(
      context.organizationId,
      examId,
      campusScope(context),
    );
  }

  async createSchedule(
    context: ExaminationsContext,
    examId: string,
    input: ExamScheduleInput,
  ) {
    const exam = await this.requiredExam(context, examId);
    assertCampus(context, exam.campusId);
    const normalized = normalizeSchedule(input);
    if (
      normalized.date < exam.startDate ||
      normalized.date > exam.endDate ||
      !(await this.repository.validateSubject(
        context.organizationId,
        normalized.subjectId,
      ))
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a subject and date within the exam period.',
      );
    const campusId = await this.repository.getClassCampus(
      context.organizationId,
      normalized.classId,
    );
    if (campusId !== exam.campusId)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'The class must belong to the exam campus.',
      );
    if (
      !(await this.repository.validateSection(
        context.organizationId,
        normalized.classId,
        normalized.sectionId,
      ))
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a section belonging to the class.',
      );
    return this.repository.createSchedule(
      context.organizationId,
      examId,
      normalized,
    );
  }

  async updateSchedule(
    context: ExaminationsContext,
    scheduleId: string,
    input: Partial<ExamScheduleInput>,
  ) {
    const current = await this.requiredSchedule(context, scheduleId);
    const exam = await this.requiredExam(context, current.examId);
    assertCampus(context, exam.campusId);
    const normalized = normalizeSchedule({ ...current, ...input });
    if (
      normalized.date < exam.startDate ||
      normalized.date > exam.endDate ||
      !(await this.repository.validateSubject(
        context.organizationId,
        normalized.subjectId,
      )) ||
      (await this.repository.getClassCampus(
        context.organizationId,
        normalized.classId,
      )) !== exam.campusId ||
      !(await this.repository.validateSection(
        context.organizationId,
        normalized.classId,
        normalized.sectionId,
      ))
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'The schedule must use a valid subject, class, section, and exam date.',
      );
    return this.requiredResult(
      this.repository.updateSchedule(context.organizationId, scheduleId, normalized),
      'Exam schedule',
    );
  }

  async deleteSchedule(context: ExaminationsContext, scheduleId: string) {
    const schedule = await this.requiredSchedule(context, scheduleId);
    const exam = await this.requiredExam(context, schedule.examId);
    assertCampus(context, exam.campusId);
    if (await this.repository.hasMarks(context.organizationId, scheduleId))
      throw new AppError(
        409,
        'RESOURCE_IN_USE',
        'Remove marks before deleting this schedule.',
      );
    return this.repository.deleteSchedule(context.organizationId, scheduleId);
  }

  listGradingScales(context: ExaminationsContext) {
    return this.repository.listGradingScales(context.organizationId);
  }

  async createGradingScale(
    context: ExaminationsContext,
    input: GradingScaleInput,
  ) {
    return this.repository.createGradingScale(context.organizationId, {
      name: text(input.name, 'grading scale name', 100),
      gradeBreakdowns: normalizeBreakdowns(input.gradeBreakdowns),
      isActive: input.isActive ?? true,
    });
  }

  async updateGradingScale(
    context: ExaminationsContext,
    scaleId: string,
    input: Partial<GradingScaleInput>,
  ) {
    const current = await this.repository.getGradingScale(
      context.organizationId,
      id(scaleId, 'grading scale'),
    );
    if (!current)
      throw new AppError(404, 'GRADING_SCALE_NOT_FOUND', 'Grading scale not found.');
    const changes: Partial<GradingScaleInput> = { ...input };
    if (input.name !== undefined)
      changes.name = text(input.name, 'grading scale name', 100);
    if (input.gradeBreakdowns !== undefined)
      changes.gradeBreakdowns = normalizeBreakdowns(input.gradeBreakdowns);
    return this.requiredResult(
      this.repository.updateGradingScale(
        context.organizationId,
        scaleId,
        changes,
      ),
      'Grading scale',
    );
  }

  async deleteGradingScale(context: ExaminationsContext, scaleId: string) {
    const current = await this.repository.getGradingScale(
      context.organizationId,
      id(scaleId, 'grading scale'),
    );
    if (!current)
      throw new AppError(404, 'GRADING_SCALE_NOT_FOUND', 'Grading scale not found.');
    if (current.isActive)
      throw new AppError(
        409,
        'RESOURCE_IN_USE',
        'Choose another active grading scale before deleting this one.',
      );
    return this.repository.deleteGradingScale(context.organizationId, scaleId);
  }

  async getMarkSheet(
    context: ExaminationsContext,
    scheduleId: string,
    sectionId: string,
  ) {
    const schedule = await this.requiredSchedule(context, scheduleId);
    const exam = await this.requiredExam(context, schedule.examId);
    assertCampus(context, exam.campusId);
    if (sectionId !== schedule.sectionId)
      throw new AppError(400, 'VALIDATION_ERROR', 'Select the scheduled section.');
    return this.repository.listRoster(
      context.organizationId,
      schedule.id,
      schedule.classId,
      schedule.sectionId,
      exam.academicYearId,
    );
  }

  async saveMarks(
    context: ExaminationsContext,
    scheduleId: string,
    records: ExamMarkInput[],
  ) {
    const schedule = await this.requiredSchedule(context, scheduleId);
    const exam = await this.requiredExam(context, schedule.examId);
    assertCampus(context, exam.campusId);
    if (!Array.isArray(records) || records.length === 0 || records.length > 1000)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Submit marks for the full roster (1–1000 students).',
      );
    const normalized = records.map((record) => {
      const studentId = id(record.studentId, 'student');
      if (typeof record.isAbsent !== 'boolean')
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Set an attendance status for each student.',
        );
      if (
        (record.isAbsent && record.marksObtained !== undefined) ||
        (!record.isAbsent &&
          (!Number.isFinite(record.marksObtained) ||
            (record.marksObtained ?? -1) < 0 ||
            (record.marksObtained ?? Infinity) > schedule.totalMarks))
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Marks must be between zero and the total, or mark the student absent.',
        );
      return {
        studentId,
        isAbsent: record.isAbsent,
        ...(record.marksObtained === undefined
          ? {}
          : { marksObtained: record.marksObtained }),
        ...(record.remarks === undefined
          ? {}
          : { remarks: text(record.remarks || '-', 'remarks', 500) }),
      };
    });
    if (new Set(normalized.map((record) => record.studentId)).size !== normalized.length)
      throw new AppError(
        400,
        'DUPLICATE_STUDENT',
        'Each student can appear only once.',
      );
    const roster = await this.repository.listRoster(
      context.organizationId,
      schedule.id,
      schedule.classId,
      schedule.sectionId,
      exam.academicYearId,
    );
    const expectedIds = new Set(roster.map((student) => student.id));
    if (
      expectedIds.size !== normalized.length ||
      normalized.some((record) => !expectedIds.has(record.studentId))
    )
      throw new AppError(
        400,
        'ROSTER_MISMATCH',
        'Marks must be submitted for every currently enrolled student in the scheduled section.',
      );
    const scale = await this.repository.getActiveGradingScale(
      context.organizationId,
    );
    return this.repository.saveMarks(
      context.organizationId,
      schedule,
      normalized,
      scale,
    );
  }

  async getStudentReport(
    context: ExaminationsContext,
    examId: string,
    studentId: string,
  ): Promise<StudentExamReport> {
    const exam = await this.requiredExam(context, examId);
    assertCampus(context, exam.campusId);
    const report = await this.repository.getStudentReport(
      context.organizationId,
      examId,
      id(studentId, 'student'),
    );
    if (!report)
      throw new AppError(
        404,
        'STUDENT_REPORT_NOT_FOUND',
        'Student report not found for this exam.',
      );
    const totalMarksPossible = report.results.reduce(
      (sum, result) => sum + result.schedule.totalMarks,
      0,
    );
    const totalMarksObtained = report.results.reduce(
      (sum, result) => sum + (result.mark?.marksObtained ?? 0),
      0,
    );
    const percentage =
      totalMarksPossible > 0
        ? Math.round((totalMarksObtained / totalMarksPossible) * 10000) / 100
        : null;
    const scale = await this.repository.getActiveGradingScale(
      context.organizationId,
    );
    const overallGrade =
      percentage === null
        ? null
        : (scale?.gradeBreakdowns.find(
            (item, index) =>
              percentage >= item.minPercentage &&
              (percentage < item.maxPercentage ||
                (index === scale.gradeBreakdowns.length - 1 &&
                  percentage <= item.maxPercentage)),
          )?.grade ?? null);
    return {
      ...report,
      totalMarksObtained,
      totalMarksPossible,
      percentage,
      overallGrade,
    };
  }

  private async requiredExam(context: ExaminationsContext, examId: string) {
    id(examId, 'exam');
    const exam = await this.repository.getExam(context.organizationId, examId);
    if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    return exam;
  }

  private async requiredSchedule(
    context: ExaminationsContext,
    scheduleId: string,
  ) {
    id(scheduleId, 'exam schedule');
    const schedule = await this.repository.getSchedule(
      context.organizationId,
      scheduleId,
    );
    if (!schedule)
      throw new AppError(404, 'EXAM_SCHEDULE_NOT_FOUND', 'Exam schedule not found.');
    return schedule;
  }

  private requiredResult<T>(value: Promise<T | null>, label: string): Promise<T> {
    return value.then((result) => {
      if (!result)
        throw new AppError(404, 'RESOURCE_NOT_FOUND', `${label} not found.`);
      return result;
    });
  }
}
