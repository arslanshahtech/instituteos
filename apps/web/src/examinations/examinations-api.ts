import { apiRequest } from '../api/client.js';

export type ExamType = 'midterm' | 'final' | 'quiz';

export interface ExamRecord {
  id: string;
  organizationId: string;
  name: string;
  type: ExamType;
  academicYearId: string;
  termId: string;
  campusId: string;
  startDate: string;
  endDate: string;
}

export interface ExamSchedule {
  id: string;
  examId: string;
  subjectId: string;
  classId: string;
  sectionId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
}

export interface GradeBreakdown {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gpa: number;
}

export interface GradingScale {
  id: string;
  name: string;
  gradeBreakdowns: GradeBreakdown[];
  isActive: boolean;
}

export interface ExamMark {
  id: string;
  studentId: string;
  marksObtained?: number;
  isAbsent: boolean;
  remarks?: string;
  percentage: number | null;
  grade: string | null;
  gpa: number | null;
}

export interface ExamRosterStudent {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  mark?: ExamMark;
}

export interface StudentExamReport {
  exam: ExamRecord;
  results: Array<{
    schedule: ExamSchedule;
    subjectName: string;
    mark: ExamMark | null;
  }>;
  totalMarksObtained: number;
  totalMarksPossible: number;
  percentage: number | null;
  overallGrade: string | null;
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

const organizationPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;
const examPath = (organizationId: string) =>
  `${organizationPath(organizationId)}/examinations`;

export function listExams(
  organizationId: string,
  filters: { campusId?: string; termId?: string } = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );
  return apiRequest<{ items: ExamRecord[] }>(
    `${examPath(organizationId)}${query.size ? `?${query}` : ''}`,
  );
}

export function saveExam(
  organizationId: string,
  input: ExamInput,
  id?: string,
) {
  return apiRequest<{ exam: ExamRecord }>(
    `${examPath(organizationId)}${id ? `/${encodeURIComponent(id)}` : ''}`,
    {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function deleteExam(organizationId: string, id: string) {
  return apiRequest<void>(
    `${examPath(organizationId)}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export function listExamSchedules(organizationId: string, examId: string) {
  return apiRequest<{ items: ExamSchedule[] }>(
    `${examPath(organizationId)}/${encodeURIComponent(examId)}/schedules`,
  );
}

export function saveExamSchedule(
  organizationId: string,
  examId: string,
  input: ExamScheduleInput,
  id?: string,
) {
  const path = id
    ? `${examPath(organizationId)}/schedules/${encodeURIComponent(id)}`
    : `${examPath(organizationId)}/${encodeURIComponent(examId)}/schedules`;
  return apiRequest<{ schedule: ExamSchedule }>(path, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteExamSchedule(organizationId: string, scheduleId: string) {
  return apiRequest<void>(
    `${examPath(organizationId)}/schedules/${encodeURIComponent(scheduleId)}`,
    { method: 'DELETE' },
  );
}

export function listGradingScales(organizationId: string) {
  return apiRequest<{ items: GradingScale[] }>(
    `${examPath(organizationId)}/grading-scales`,
  );
}

export type GradingScaleInput = {
  name?: string;
  gradeBreakdowns?: GradeBreakdown[];
  isActive?: boolean;
};

export function saveGradingScale(
  organizationId: string,
  input: GradingScaleInput,
  id?: string,
) {
  return apiRequest<{ gradingScale: GradingScale }>(
    `${examPath(organizationId)}/grading-scales${id ? `/${encodeURIComponent(id)}` : ''}`,
    {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function deleteGradingScale(organizationId: string, scaleId: string) {
  return apiRequest<void>(
    `${examPath(organizationId)}/grading-scales/${encodeURIComponent(scaleId)}`,
    { method: 'DELETE' },
  );
}

export function getExamMarkSheet(
  organizationId: string,
  scheduleId: string,
  sectionId: string,
) {
  const query = new URLSearchParams({ sectionId });
  return apiRequest<{ items: ExamRosterStudent[] }>(
    `${examPath(organizationId)}/schedules/${encodeURIComponent(scheduleId)}/marks?${query}`,
  );
}

export function saveExamMarks(
  organizationId: string,
  scheduleId: string,
  records: Array<{
    studentId: string;
    marksObtained?: number;
    isAbsent: boolean;
    remarks?: string;
  }>,
) {
  return apiRequest<{ items: ExamMark[] }>(
    `${examPath(organizationId)}/schedules/${encodeURIComponent(scheduleId)}/marks`,
    { method: 'PUT', body: JSON.stringify({ records }) },
  );
}

export function getStudentExamReport(
  organizationId: string,
  examId: string,
  studentId: string,
) {
  return apiRequest<{ report: StudentExamReport }>(
    `${examPath(organizationId)}/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/report`,
  );
}
