export type ExamType = 'midterm' | 'final' | 'quiz';

export interface ExaminationsContext {
  organizationId: string;
  campusIds: string[];
  role: string;
  userId?: string;
}

export interface ExamInput {
  name: string;
  type: ExamType;
  academicYearId: string;
  termId: string;
  campusId: string;
  startDate: string;
  endDate: string;
}

export interface ExamRecord extends ExamInput {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamScheduleInput {
  subjectId: string;
  classId: string;
  sectionId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
}

export interface ExamScheduleRecord extends ExamScheduleInput {
  id: string;
  examId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradeBreakdown {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gpa: number;
}

export interface GradingScaleInput {
  name: string;
  gradeBreakdowns: GradeBreakdown[];
  isActive?: boolean;
}

export interface GradingScaleRecord extends GradingScaleInput {
  id: string;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamMarkInput {
  studentId: string;
  marksObtained?: number;
  isAbsent: boolean;
  remarks?: string;
}

export interface ExamMarkRecord extends ExamMarkInput {
  id: string;
  examScheduleId: string;
  organizationId: string;
  percentage: number | null;
  grade: string | null;
  gpa: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamRosterStudent {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  mark?: ExamMarkRecord;
}

export interface StudentExamReport {
  exam: ExamRecord;
  results: Array<{
    schedule: ExamScheduleRecord;
    subjectName: string;
    mark: ExamMarkRecord | null;
  }>;
  totalMarksObtained: number;
  totalMarksPossible: number;
  percentage: number | null;
  overallGrade: string | null;
}

export interface ExaminationsRepository {
  isTeacherAssignedToSection(
    organizationId: string,
    userId: string,
    input: {
      classId: string;
      sectionId: string;
      academicYearId: string;
      subjectId: string;
    },
  ): Promise<boolean>;
  validateCampus(organizationId: string, campusId: string): Promise<boolean>;
  validateAcademicYear(organizationId: string, id: string): Promise<boolean>;
  validateTerm(
    organizationId: string,
    academicYearId: string,
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean>;
  getClassCampus(
    organizationId: string,
    classId: string,
  ): Promise<string | null>;
  validateSection(
    organizationId: string,
    classId: string,
    sectionId: string,
  ): Promise<boolean>;
  validateSubject(organizationId: string, subjectId: string): Promise<boolean>;
  listExams(
    organizationId: string,
    campusIds?: string[],
    campusId?: string,
    termId?: string,
  ): Promise<ExamRecord[]>;
  getExam(organizationId: string, id: string): Promise<ExamRecord | null>;
  createExam(organizationId: string, input: ExamInput): Promise<ExamRecord>;
  updateExam(
    organizationId: string,
    id: string,
    input: Partial<ExamInput>,
  ): Promise<ExamRecord | null>;
  deleteExam(organizationId: string, id: string): Promise<boolean>;
  hasSchedules(organizationId: string, examId: string): Promise<boolean>;
  listSchedules(
    organizationId: string,
    examId: string,
    campusIds?: string[],
  ): Promise<ExamScheduleRecord[]>;
  getSchedule(
    organizationId: string,
    id: string,
  ): Promise<ExamScheduleRecord | null>;
  createSchedule(
    organizationId: string,
    examId: string,
    input: ExamScheduleInput,
  ): Promise<ExamScheduleRecord>;
  updateSchedule(
    organizationId: string,
    id: string,
    input: Partial<ExamScheduleInput>,
  ): Promise<ExamScheduleRecord | null>;
  deleteSchedule(organizationId: string, id: string): Promise<boolean>;
  hasMarks(organizationId: string, scheduleId: string): Promise<boolean>;
  listGradingScales(organizationId: string): Promise<GradingScaleRecord[]>;
  getGradingScale(
    organizationId: string,
    id: string,
  ): Promise<GradingScaleRecord | null>;
  getActiveGradingScale(
    organizationId: string,
  ): Promise<GradingScaleRecord | null>;
  createGradingScale(
    organizationId: string,
    input: GradingScaleInput,
  ): Promise<GradingScaleRecord>;
  updateGradingScale(
    organizationId: string,
    id: string,
    input: Partial<GradingScaleInput>,
  ): Promise<GradingScaleRecord | null>;
  deleteGradingScale(organizationId: string, id: string): Promise<boolean>;
  listRoster(
    organizationId: string,
    scheduleId: string,
    classId: string,
    sectionId: string,
    academicYearId: string,
  ): Promise<ExamRosterStudent[]>;
  saveMarks(
    organizationId: string,
    schedule: ExamScheduleRecord,
    records: ExamMarkInput[],
    scale: GradingScaleRecord | null,
  ): Promise<ExamMarkRecord[]>;
  getStudentReport(
    organizationId: string,
    examId: string,
    studentId: string,
  ): Promise<{
    exam: ExamRecord;
    results: Array<{
      schedule: ExamScheduleRecord;
      subjectName: string;
      mark: ExamMarkRecord | null;
    }>;
  } | null>;
}
