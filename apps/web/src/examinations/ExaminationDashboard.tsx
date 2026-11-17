import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Printer,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicTerm,
  AcademicYear,
  AcademicSubject,
} from '../academics/academics-api.js';
import type {
  ExamRecord,
  ExamSchedule,
  GradeBreakdown,
} from './examinations-api.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import {
  useDeleteExam,
  useDeleteExamSchedule,
  useDeleteGradingScale,
  useExamMarkSheet,
  useExamSchedules,
  usePendingExamMarksReviews,
  useExaminationWorkspace,
  useSaveExam,
  useSaveExamMarks,
  useSubmitExamMarksForReview,
  useRequestExamMarksChanges,
  useSetExamResultsPublication,
  useSaveExamSchedule,
  useSaveGradingScale,
  useStudentExamReport,
} from './examinations-queries.js';

const examSchema = z.object({
  name: z.string().trim().min(1, 'Enter an exam name.').max(120),
  type: z.enum([
    'midterm',
    'final',
    'quiz',
    'monthly_test',
    'class_test',
    'mid_year',
    'send_up',
    'annual',
    'practical',
    'viva',
    'supplementary',
    'improvement',
  ]),
  academicYearId: z.string().min(1, 'Select an academic year.'),
  termId: z.string(),
  campusId: z.string().min(1, 'Select a campus.'),
  startDate: z.string().min(1, 'Select a start date.'),
  endDate: z.string().min(1, 'Select an end date.'),
});
type ExamFormValues = z.infer<typeof examSchema>;

const examTypeLabels: Record<import('./examinations-api.js').ExamType, string> =
  {
    midterm: 'Midterm',
    final: 'Final',
    quiz: 'Quiz (legacy)',
    monthly_test: 'Monthly Test',
    class_test: 'Class Test',
    mid_year: 'Mid-Year / Half-Yearly',
    send_up: 'Send-up / Pre-Board',
    annual: 'Annual Examination',
    practical: 'Practical Examination',
    viva: 'Viva / Oral',
    supplementary: 'Supplementary',
    improvement: 'Improvement',
  };

function examTypeLabel(type: import('./examinations-api.js').ExamType): string {
  return examTypeLabels[type] ?? type;
}

const scheduleSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject.'),
  classId: z.string().min(1, 'Select a class.'),
  sectionId: z.string().min(1, 'Select a section.'),
  date: z.string().min(1, 'Select a date.'),
  startTime: z.string().min(1, 'Enter a start time.'),
  durationMinutes: z.string().regex(/^\d+$/, 'Enter duration in minutes.'),
  totalMarks: z.string().regex(/^\d+(\.\d+)?$/, 'Enter total marks.'),
  passingMarks: z.string().regex(/^\d+(\.\d+)?$/, 'Enter passing marks.'),
});
type ScheduleFormValues = z.infer<typeof scheduleSchema>;

const defaultGrades: GradeBreakdown[] = [
  { grade: 'F', minPercentage: 0, maxPercentage: 50, gpa: 0 },
  { grade: 'D', minPercentage: 50, maxPercentage: 60, gpa: 1 },
  { grade: 'C', minPercentage: 60, maxPercentage: 70, gpa: 2 },
  { grade: 'B', minPercentage: 70, maxPercentage: 80, gpa: 3 },
  { grade: 'A', minPercentage: 80, maxPercentage: 90, gpa: 3.7 },
  { grade: 'A+', minPercentage: 90, maxPercentage: 100, gpa: 4 },
];

type Tab =
  | 'Overview'
  | 'Exams'
  | 'Schedules'
  | 'Exam calendar'
  | 'Marks sheet'
  | 'Student report'
  | 'Grading scales';

const examTabByQuery: Record<string, Tab> = {
  'exam-overview': 'Overview',
  'exam-exams': 'Exams',
  'exam-schedule': 'Schedules',
  'exam-marks': 'Marks sheet',
  'exam-results': 'Student report',
};

const examQueryByTab: Partial<Record<Tab, string>> = {
  Overview: 'exam-overview',
  Exams: 'exam-exams',
  Schedules: 'exam-schedule',
  'Exam calendar': 'exam-schedule',
  'Marks sheet': 'exam-marks',
  'Student report': 'exam-results',
};

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function examName(exam: ExamRecord, years: AcademicYear[]) {
  const year = years.find((item) => item.id === exam.academicYearId)?.name;
  return `${exam.name}${year ? ` · ${year}` : ''}`;
}

function studentName(student: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}) {
  return student.preferredName
    ? `${student.preferredName} (${student.firstName} ${student.lastName})`
    : `${student.firstName} ${student.lastName}`;
}

export function ExaminationDashboard() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canRead =
    access.data?.permissions.includes('examination.read') ?? false;
  const canWrite =
    access.data?.permissions.includes('examination.write') ?? false;
  const canManageExams =
    canWrite &&
    [
      'organization_owner',
      'organization_admin',
      'campus_admin',
      'principal_director',
      'academic_coordinator',
    ].includes(access.data?.role ?? '');
  const isTeacher = access.data?.role === 'teacher';
  const workspace = useExaminationWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const academics = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const exams = workspace.exams.data?.items ?? [];
  const [viewExam, setViewExam] = useState<(typeof exams)[number] | null>(null);
  const [viewSchedule, setViewSchedule] = useState<ExamSchedule | null>(null);
  const campuses = academics.campuses.data?.campuses ?? [];
  const years = academics.years.data?.items ?? [];
  const terms = academics.terms.data?.items ?? [];
  const classes = academics.classes.data?.items ?? [];
  const sections = academics.sections.data?.items ?? [];
  const subjects = academics.subjects.data?.items ?? [];
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab =
    examTabByQuery[searchParams.get('tab') ?? ''] ?? 'Overview';
  // The URL is the single source of truth for the active sub-module. Keeping
  // a second local tab state caused a render -> effect -> URL -> render cycle
  // whenever a sidebar item was selected, which looked like screen flicker.
  const tab: Tab =
    isTeacher &&
    requestedTab !== 'Marks sheet' &&
    requestedTab !== 'Student report'
      ? 'Marks sheet'
      : requestedTab;
  function setTab(nextTab: Tab) {
    const nextQueryTab = examQueryByTab[nextTab];
    if (!nextQueryTab || searchParams.get('tab') === nextQueryTab) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', nextQueryTab);
        return next;
      },
      { replace: true },
    );
  }

  const [campusFilter, setCampusFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [examId, setExamId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examEditId, setExamEditId] = useState('');
  const [scheduleEditId, setScheduleEditId] = useState('');
  const [marksByStudent, setMarksByStudent] = useState<
    Record<string, { marks: string; absent: boolean; remarks: string }>
  >({});
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportExamId, setReportExamId] = useState('');
  const [scaleEditId, setScaleEditId] = useState('');
  const [scaleName, setScaleName] = useState('');
  const [scaleBands, setScaleBands] = useState<GradeBreakdown[]>(defaultGrades);
  const [formError, setFormError] = useState('');
  const examSchedules = useExamSchedules(
    organizationId,
    examId,
    Boolean(access.data && canRead),
  );
  const pendingReviews = usePendingExamMarksReviews(
    organizationId,
    Boolean(access.data && canManageExams),
  );
  const schedules = examSchedules.data?.items ?? [];
  const selectedExam = exams.find((item) => item.id === examId);
  const selectedReportExam = exams.find((item) => item.id === reportExamId);
  // Teacher schedules are already assignment-filtered by the API. Build each
  // selector from that trusted list so unrelated classes and subjects stay hidden.
  const examClasses = classes.filter((item: AcademicClass) =>
    isTeacher
      ? schedules.some((schedule) => schedule.classId === item.id)
      : !selectedExam || item.campusId === selectedExam.campusId,
  );
  const currentClassId =
    classId && examClasses.some((item) => item.id === classId)
      ? classId
      : (examClasses[0]?.id ?? '');
  const classSections = sections.filter(
    (item: AcademicSection) =>
      item.classId === currentClassId &&
      (!isTeacher ||
        schedules.some(
          (schedule) =>
            schedule.classId === currentClassId &&
            schedule.sectionId === item.id,
        )),
  );
  const currentSectionId =
    sectionId && classSections.some((item) => item.id === sectionId)
      ? sectionId
      : (classSections[0]?.id ?? '');
  const availableMarkSubjects = subjects.filter(
    (item: AcademicSubject) =>
      !isTeacher ||
      schedules.some(
        (schedule) =>
          schedule.classId === currentClassId &&
          schedule.sectionId === currentSectionId &&
          schedule.subjectId === item.id,
      ),
  );
  const currentSubjectId =
    subjectId && availableMarkSubjects.some((item) => item.id === subjectId)
      ? subjectId
      : (availableMarkSubjects[0]?.id ?? '');
  const filteredSchedules = schedules.filter(
    (schedule) =>
      schedule.classId === currentClassId &&
      schedule.sectionId === currentSectionId &&
      schedule.subjectId === currentSubjectId,
  );
  const selectedSchedule =
    filteredSchedules.find((item) => item.id === scheduleId) ??
    filteredSchedules[0];
  const markSheet = useExamMarkSheet(
    organizationId,
    selectedSchedule?.id ?? '',
    currentSectionId,
    Boolean(access.data && canRead),
  );
  const markRoster = markSheet.data?.items ?? [];
  const markAbsentCount = markRoster.filter(
    (student) => marksByStudent[student.id]?.absent,
  ).length;
  const markEnteredCount = markRoster.filter((student) => {
    const value = marksByStudent[student.id]?.marks.trim() ?? '';
    const score = Number(value);
    return (
      !marksByStudent[student.id]?.absent &&
      value !== '' &&
      Number.isFinite(score) &&
      score >= 0 &&
      score <= (selectedSchedule?.totalMarks ?? 0)
    );
  }).length;
  const markRemainingCount =
    markRoster.length - markAbsentCount - markEnteredCount;
  const invalidMarkCount = markRoster.filter((student) => {
    const value = marksByStudent[student.id]?.marks.trim() ?? '';
    if (marksByStudent[student.id]?.absent || value === '') return false;
    const score = Number(value);
    return (
      !Number.isFinite(score) ||
      score < 0 ||
      score > (selectedSchedule?.totalMarks ?? 0)
    );
  }).length;
  const reportStudent = markSheet.data?.items.find(
    (item) => item.id === reportStudentId,
  );
  const report = useStudentExamReport(
    organizationId,
    reportExamId,
    reportStudentId,
    Boolean(access.data && canRead),
  );
  const reportResults = report.data?.report.results ?? [];
  const reportAssessedCount = reportResults.filter(
    (result) => result.mark !== null,
  ).length;
  const reportPendingCount = reportResults.length - reportAssessedCount;
  const reportAbsentCount = reportResults.filter(
    (result) => result.mark?.isAbsent,
  ).length;
  const reportIsComplete = reportResults.length > 0 && reportPendingCount === 0;
  const saveExam = useSaveExam(organizationId);
  const removeExam = useDeleteExam(organizationId);
  const setResultsPublication = useSetExamResultsPublication(organizationId);
  const saveSchedule = useSaveExamSchedule(organizationId);
  const removeSchedule = useDeleteExamSchedule(organizationId);
  const saveMarks = useSaveExamMarks(organizationId);
  const submitMarksForReview = useSubmitExamMarksForReview(organizationId);
  const requestMarksChanges = useRequestExamMarksChanges(organizationId);
  const saveScale = useSaveGradingScale(organizationId);
  const removeScale = useDeleteGradingScale(organizationId);
  const examForm = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: '',
      type: 'midterm',
      academicYearId: '',
      termId: '',
      campusId: '',
      startDate: '',
      endDate: '',
    },
  });
  const scheduleForm = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      subjectId: '',
      classId: '',
      sectionId: '',
      date: '',
      startTime: '09:00',
      durationMinutes: '60',
      totalMarks: '100',
      passingMarks: '40',
    },
  });
  const selectedYearId = examForm.watch('academicYearId');
  const availableTerms = terms.filter(
    (term: AcademicTerm) =>
      !selectedYearId || term.academicYearId === selectedYearId,
  );
  const visibleExams = exams.filter(
    (exam) =>
      (!campusFilter || exam.campusId === campusFilter) &&
      (!termFilter || exam.termId === termFilter),
  );
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const scheduledExamCount = exams.filter(
    (exam) => exam.endDate >= todayKey && !exam.resultsPublishedAt,
  ).length;
  const completedExamCount = exams.filter(
    (exam) => exam.endDate < todayKey,
  ).length;
  const publishedExamCount = exams.filter((exam) =>
    Boolean(exam.resultsPublishedAt),
  ).length;
  const upcomingExams = [...visibleExams]
    .filter((exam) => exam.startDate >= todayKey && !exam.resultsPublishedAt)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .slice(0, 4);
  const publishedExams = [...visibleExams]
    .filter((exam) => Boolean(exam.resultsPublishedAt))
    .sort((left, right) =>
      (right.resultsPublishedAt ?? '').localeCompare(
        left.resultsPublishedAt ?? '',
      ),
    )
    .slice(0, 4);
  const pendingReviewItems = pendingReviews.data?.items ?? [];
  // Grading scales are outside the first-launch MVP; do not fetch or depend on them.
  const scales: Array<{
    id: string;
    name: string;
    gradeBreakdowns: GradeBreakdown[];
    isActive: boolean;
  }> = [];

  useEffect(() => {
    if (!examId && exams[0]) setExamId(exams[0].id);
    else if (examId && !exams.some((item) => item.id === examId)) setExamId('');
  }, [examId, exams]);

  useEffect(() => {
    const roster = markSheet.data?.items ?? [];
    setMarksByStudent(
      Object.fromEntries(
        roster.map((student) => [
          student.id,
          {
            marks: student.mark?.marksObtained?.toString() ?? '',
            absent: student.mark?.isAbsent ?? false,
            remarks: student.mark?.remarks ?? '',
          },
        ]),
      ),
    );
  }, [markSheet.data]);

  const gradingScaleError = useMemo(() => {
    if (scaleBands.length === 0) return 'Add at least one grade band.';
    if (scaleBands.length > 30)
      return 'A scale can contain at most 30 grade bands.';
    const labels = scaleBands.map((item) => item.grade.trim());
    if (labels.some((label) => !label))
      return 'Enter a label for every grade band.';
    if (new Set(labels).size !== labels.length)
      return 'Grade labels must be unique.';
    const sorted = [...scaleBands].sort(
      (left, right) => left.minPercentage - right.minPercentage,
    );
    if (
      sorted.some(
        (item) =>
          !Number.isFinite(item.minPercentage) ||
          !Number.isFinite(item.maxPercentage) ||
          !Number.isFinite(item.gpa) ||
          item.minPercentage < 0 ||
          item.maxPercentage > 100 ||
          item.minPercentage > item.maxPercentage ||
          item.gpa < 0 ||
          item.gpa > 10,
      )
    )
      return 'Use percentage ranges from 0 to 100 and GPA values from 0 to 10.';
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
      return 'Grade ranges must cover 0–100 without gaps or overlaps.';
    return '';
  }, [scaleBands]);

  function setExamForEdit(exam: ExamRecord) {
    setExamEditId(exam.id);
    examForm.reset({
      name: exam.name,
      type: exam.type,
      academicYearId: exam.academicYearId,
      termId: exam.termId ?? '',
      campusId: exam.campusId,
      startDate: exam.startDate,
      endDate: exam.endDate,
    });
    setFormError('');
  }

  async function submitExam(values: ExamFormValues) {
    setFormError('');
    try {
      await saveExam.mutateAsync({
        id: examEditId || undefined,
        data: { ...values, termId: values.termId || null },
      });
      setExamEditId('');
      examForm.reset();
      setTab('Exams');
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  function setScheduleForEdit(schedule: ExamSchedule) {
    setScheduleEditId(schedule.id);
    scheduleForm.reset({
      subjectId: schedule.subjectId,
      classId: schedule.classId,
      sectionId: schedule.sectionId,
      date: schedule.date,
      startTime: schedule.startTime,
      durationMinutes: String(schedule.durationMinutes),
      totalMarks: String(schedule.totalMarks),
      passingMarks: String(schedule.passingMarks),
    });
  }

  async function submitSchedule(values: ScheduleFormValues) {
    if (!examId) return;
    setFormError('');
    try {
      await saveSchedule.mutateAsync({
        examId,
        id: scheduleEditId || undefined,
        data: {
          ...values,
          durationMinutes: Number(values.durationMinutes),
          totalMarks: Number(values.totalMarks),
          passingMarks: Number(values.passingMarks),
        },
      });
      setScheduleEditId('');
      scheduleForm.reset({
        ...scheduleForm.getValues(),
        date: '',
      });
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  function markRecords() {
    return (markSheet.data?.items ?? []).map((student) => {
      const current = marksByStudent[student.id] ?? {
        marks: '',
        absent: false,
        remarks: '',
      };
      return {
        studentId: student.id,
        isAbsent: current.absent,
        ...(!current.absent && current.marks.trim() !== ''
          ? { marksObtained: Number(current.marks) }
          : {}),
        ...(current.remarks.trim() ? { remarks: current.remarks.trim() } : {}),
      };
    });
  }

  async function saveMarkDraft() {
    if (!selectedSchedule || !markSheet.data?.items.length) return;
    setFormError('');
    try {
      await saveMarks.mutateAsync({
        scheduleId: selectedSchedule.id,
        records: markRecords(),
      });
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  async function submitMarkSheet() {
    if (!selectedSchedule || !markSheet.data?.items.length) return;
    setFormError('');
    try {
      await saveMarks.mutateAsync({
        scheduleId: selectedSchedule.id,
        records: markRecords(),
      });
      await submitMarksForReview.mutateAsync(selectedSchedule.id);
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  async function submitScale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (gradingScaleError) return;
    setFormError('');
    try {
      await saveScale.mutateAsync({
        id: scaleEditId || undefined,
        data: { name: scaleName, gradeBreakdowns: scaleBands, isActive: true },
      });
      setScaleEditId('');
      setScaleName('');
      setScaleBands(defaultGrades);
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  function editScale(scale: (typeof scales)[number]) {
    setScaleEditId(scale.id);
    setScaleName(scale.name);
    setScaleBands(scale.gradeBreakdowns.map((item) => ({ ...item })));
  }

  function updateScaleBand(
    index: number,
    field: keyof GradeBreakdown,
    value: string,
  ) {
    setScaleBands((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex !== index
          ? item
          : {
              ...item,
              [field]:
                field === 'grade'
                  ? value
                  : value === ''
                    ? Number.NaN
                    : Number(value),
            },
      ),
    );
  }

  function openStudentReport(studentId: string) {
    setReportStudentId(studentId);
    setReportExamId(examId);
    setTab('Student report');
  }

  if (access.isLoading)
    return <LoadingState message="Checking exam access..." />;
  if (access.error)
    return (
      <ErrorState
        title="Organization unavailable"
        description={apiMessage(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;

  // Only data needed by the active role should block the first-launch screen.
  const loading =
    workspace.exams.isLoading ||
    academics.classes.isLoading ||
    academics.sections.isLoading ||
    academics.subjects.isLoading ||
    (canManageExams &&
      (academics.years.isLoading || academics.campuses.isLoading));
  const queryError =
    workspace.exams.error ||
    academics.classes.error ||
    academics.sections.error ||
    academics.subjects.error ||
    (canManageExams ? academics.years.error || academics.campuses.error : null);
  if (loading) return <LoadingState message="Loading exams..." />;
  if (queryError)
    return (
      <ErrorState
        title="Exams could not be loaded"
        description={apiMessage(queryError)}
        onRetry={() => {
          void workspace.exams.refetch();
          void academics.years.refetch();
          void academics.classes.refetch();
          void academics.sections.refetch();
          void academics.subjects.refetch();
          void academics.campuses.refetch();
        }}
      />
    );

  return (
    <main className="examinations-page reference-live-module">
      {tab === 'Overview' ? (
        <WorkspacePageHeading
          className="examinations-page-heading"
          eyebrow=""
          title="Exam"
          description="Exams and student results."
          aside={
            canManageExams ? (
              <Button
                type="button"
                onClick={() => {
                  setExamEditId('');
                  examForm.reset();
                  setTab('Exams');
                }}
              >
                + Create exam
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="examinations-subpage-heading">
          {(!isTeacher || tab === 'Student report') && (
            <button
              type="button"
              className="examinations-back-button"
              onClick={() => {
                setTab(isTeacher ? 'Marks sheet' : 'Overview');
                setFormError('');
                setExamEditId('');
                setScheduleEditId('');
              }}
              aria-label={
                isTeacher
                  ? 'Back to marks sheet'
                  : 'Back to examinations overview'
              }
            >
              <span aria-hidden="true">←</span>
              <span>{isTeacher ? 'Back to marks' : 'Back to overview'}</span>
            </button>
          )}
          <div>
            {tab !== 'Marks sheet' && tab !== 'Student report' && (
              <span className="examinations-subpage-eyebrow">EXAMINATIONS</span>
            )}
            <h1>
              {tab === 'Exams'
                ? examEditId
                  ? 'Edit exam'
                  : 'Create exam'
                : tab === 'Schedules'
                  ? 'Schedule'
                  : tab === 'Marks sheet'
                    ? 'Marks sheet'
                    : 'Student results'}
            </h1>
            {tab === 'Marks sheet' && isTeacher && (
              <p className="examinations-subpage-description">
                Select your assigned assessment, then enter marks for each
                student.
              </p>
            )}
            {tab === 'Student report' && (
              <p className="examinations-subpage-description">
                Review a student’s subject-wise performance and assessment
                status.
              </p>
            )}
          </div>
        </div>
      )}
      {formError && (
        <div className="examinations-form-error" role="alert">
          {formError}
        </div>
      )}
      {!canWrite && (
        <div className="examinations-readonly-note" role="status">
          You have read-only access to examination records.
        </div>
      )}

      {tab === 'Overview' && canManageExams && (
        <section className="examinations-overview">
          <div className="examinations-stats-grid" aria-label="Exam summary">
            <article className="examinations-stat-card">
              <span className="examinations-stat-icon">
                <FileText size={19} />
              </span>
              <span className="examinations-stat-copy">
                <strong>{exams.length}</strong>
                <small>Total exams</small>
              </span>
            </article>
            <article className="examinations-stat-card">
              <span className="examinations-stat-icon">
                <CalendarDays size={19} />
              </span>
              <span className="examinations-stat-copy">
                <strong>{scheduledExamCount}</strong>
                <small>Scheduled</small>
              </span>
            </article>
            <article className="examinations-stat-card">
              <span className="examinations-stat-icon">
                <CheckCircle2 size={19} />
              </span>
              <span className="examinations-stat-copy">
                <strong>{completedExamCount}</strong>
                <small>Completed</small>
              </span>
            </article>
            <article className="examinations-stat-card">
              <span className="examinations-stat-icon">
                <Award size={19} />
              </span>
              <span className="examinations-stat-copy">
                <strong>{publishedExamCount}</strong>
                <small>Results published</small>
              </span>
            </article>
          </div>

          <div className="examinations-overview-panels">
            <section className="examinations-card examinations-upcoming-card">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Upcoming exams</h2>
                  <p>Next assessments across your campus</p>
                </div>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => setTab('Schedules')}
                >
                  View all
                </Button>
              </div>
              {upcomingExams.length === 0 ? (
                <EmptyState
                  title="No upcoming exams"
                  description="Your scheduled examinations will appear here."
                />
              ) : (
                <ul className="examinations-overview-list">
                  {upcomingExams.map((exam) => (
                    <li key={exam.id}>
                      <span className="examinations-overview-list-icon">
                        <CalendarDays size={17} />
                      </span>
                      <span className="examinations-overview-list-copy">
                        <strong>{exam.name}</strong>
                        <small>
                          {examTypeLabel(exam.type)} · {exam.startDate}
                          {exam.endDate !== exam.startDate
                            ? ` – ${exam.endDate}`
                            : ''}
                        </small>
                      </span>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => {
                          setExamId(exam.id);
                          setScheduleEditId('');
                          setTab('Schedules');
                        }}
                      >
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="examinations-card examinations-quick-actions">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Quick actions</h2>
                  <p>Common examination tasks</p>
                </div>
              </div>
              <div className="examinations-quick-action-list">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleEditId('');
                    setTab('Schedules');
                  }}
                >
                  <span className="examinations-quick-action-icon">
                    <CalendarDays size={18} />
                  </span>
                  <span>
                    <strong>Manage schedule</strong>
                    <small>Create and update exam papers</small>
                  </span>
                  <span
                    className="examinations-action-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
                <button type="button" onClick={() => setTab('Marks sheet')}>
                  <span className="examinations-quick-action-icon">
                    <ClipboardCheck size={18} />
                  </span>
                  <span>
                    <strong>Marks & review</strong>
                    <small>Check submissions and student marks</small>
                  </span>
                  <span
                    className="examinations-action-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
                <button type="button" onClick={() => setTab('Student report')}>
                  <span className="examinations-quick-action-icon">
                    <Award size={18} />
                  </span>
                  <span>
                    <strong>Result cards</strong>
                    <small>View published student results</small>
                  </span>
                  <span
                    className="examinations-action-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              </div>
            </section>
          </div>

          <div className="examinations-overview-panels examinations-overview-lower-panels">
            <section className="examinations-card examinations-review-card">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Marks review</h2>
                  <p>Teacher submissions awaiting Admin review</p>
                </div>
                <span className="examinations-review-count">
                  {pendingReviewItems.length}
                </span>
              </div>
              {pendingReviews.isLoading ? (
                <LoadingState message="Loading submissions..." />
              ) : pendingReviews.isError ? (
                <ErrorState
                  title="Review queue unavailable"
                  description="Pending submissions could not be loaded."
                  onRetry={() => void pendingReviews.refetch()}
                />
              ) : pendingReviewItems.length === 0 ? (
                <EmptyState
                  title="All caught up"
                  description="New teacher submissions will appear here for review."
                />
              ) : (
                <ul className="examinations-overview-list">
                  {pendingReviewItems.slice(0, 5).map((schedule) => (
                    <li key={schedule.id}>
                      <span className="examinations-overview-list-icon examinations-review-list-icon">
                        <ClipboardCheck size={17} />
                      </span>
                      <span className="examinations-overview-list-copy">
                        <strong>
                          {exams.find((exam) => exam.id === schedule.examId)
                            ?.name ?? 'Examination'}
                        </strong>
                        <small>
                          {subjects.find(
                            (subject) => subject.id === schedule.subjectId,
                          )?.name ?? 'Subject'}
                          {' · '}
                          {classes.find((item) => item.id === schedule.classId)
                            ?.name ?? 'Class'}
                          {' · '}
                          {sections.find(
                            (item) => item.id === schedule.sectionId,
                          )?.name ?? 'Section'}
                        </small>
                        <small>
                          {schedule.marksSubmittedAt
                            ? `Submitted ${new Date(schedule.marksSubmittedAt).toLocaleDateString()}`
                            : 'Recently submitted'}
                        </small>
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setExamId(schedule.examId);
                          setClassId(schedule.classId);
                          setSectionId(schedule.sectionId);
                          setSubjectId(schedule.subjectId);
                          setScheduleId(schedule.id);
                          setTab('Marks sheet');
                        }}
                      >
                        Review
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="examinations-card examinations-published-card">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Recently published results</h2>
                  <p>Results available to students and parents</p>
                </div>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => setTab('Student report')}
                >
                  View results
                </Button>
              </div>
              {publishedExams.length === 0 ? (
                <EmptyState
                  title="No published results yet"
                  description="Published result cards will appear here."
                />
              ) : (
                <ul className="examinations-overview-list examinations-published-list">
                  {publishedExams.map((exam) => (
                    <li key={exam.id}>
                      <span className="examinations-overview-list-icon">
                        <Award size={17} />
                      </span>
                      <span className="examinations-overview-list-copy">
                        <strong>{exam.name}</strong>
                        <small>
                          {exam.startDate} – {exam.endDate} · Published{' '}
                          {exam.resultsPublishedAt
                            ? new Date(
                                exam.resultsPublishedAt,
                              ).toLocaleDateString()
                            : ''}
                        </small>
                      </span>
                      <span className="examinations-published-status">
                        Published
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </section>
      )}

      {(tab === 'Exams' || tab === 'Schedules' || tab === 'Exam calendar') && (
        <section className="examinations-panel">
          {tab === 'Schedules' &&
          canManageExams &&
          pendingReviews.data?.items.length ? (
            <div className="examinations-card" role="status">
              <div className="examinations-panel-heading">
                <h2>Review pending</h2>
                <strong>{pendingReviews.data.items.length}</strong>
              </div>
              <ul className="examinations-record-list">
                {pendingReviews.data.items.map((schedule) => (
                  <li key={schedule.id}>
                    <div>
                      <strong>
                        {exams.find((exam) => exam.id === schedule.examId)
                          ?.name ?? 'Examination'}
                      </strong>
                      <span>
                        {subjects.find(
                          (subject) => subject.id === schedule.subjectId,
                        )?.name ?? 'Subject'}{' '}
                        -{' '}
                        {classes.find((item) => item.id === schedule.classId)
                          ?.name ?? 'Class'}{' '}
                        -{' '}
                        {sections.find((item) => item.id === schedule.sectionId)
                          ?.name ?? 'Section'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setExamId(schedule.examId);
                        setClassId(schedule.classId);
                        setSectionId(schedule.sectionId);
                        setSubjectId(schedule.subjectId);
                        setScheduleId(schedule.id);
                        setTab('Marks sheet');
                      }}
                    >
                      Review
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {tab === 'Schedules' && canManageExams && pendingReviews.isError && (
            <ErrorState
              title="Review queue unavailable"
              description="Try again."
              onRetry={() => void pendingReviews.refetch()}
            />
          )}
          <div
            className={`examinations-grid${tab === 'Exams' || tab === 'Schedules' ? ' examinations-grid-single examinations-grid-wide' : ''}`}
          >
            {(tab === 'Exams' || tab === 'Schedules') && (
              <section className="examinations-card">
                {tab === 'Exams' && (
                  <>
                    <h2>{examEditId ? 'Update exam' : 'Create exam'}</h2>
                    <form
                      className="examinations-form examinations-exam-form"
                      onSubmit={examForm.handleSubmit(submitExam)}
                    >
                      <label>
                        Exam name
                        <input
                          {...examForm.register('name')}
                          disabled={!canManageExams}
                        />
                        {examForm.formState.errors.name && (
                          <small>
                            {examForm.formState.errors.name.message}
                          </small>
                        )}
                      </label>
                      <label>
                        Exam type
                        <select
                          {...examForm.register('type')}
                          disabled={!canManageExams}
                        >
                          <option value="midterm">Midterm</option>
                          <option value="final">Final</option>
                          <option value="quiz">Quiz (legacy)</option>
                          <option value="monthly_test">Monthly Test</option>
                          <option value="class_test">Class Test</option>
                          <option value="mid_year">
                            Mid-Year / Half-Yearly
                          </option>
                          <option value="send_up">Send-up / Pre-Board</option>
                          <option value="annual">Annual Examination</option>
                          <option value="practical">
                            Practical Examination
                          </option>
                          <option value="viva">Viva / Oral</option>
                          <option value="supplementary">Supplementary</option>
                          <option value="improvement">Improvement</option>
                        </select>
                      </label>
                      <label>
                        Campus
                        <select
                          {...examForm.register('campusId')}
                          disabled={!canManageExams}
                        >
                          <option value="">Select campus</option>
                          {campuses.map((campus) => (
                            <option key={campus.id} value={campus.id}>
                              {campus.name}
                            </option>
                          ))}
                        </select>
                        {examForm.formState.errors.campusId && (
                          <small>
                            {examForm.formState.errors.campusId.message}
                          </small>
                        )}
                      </label>
                      <label>
                        Academic year
                        <select
                          {...examForm.register('academicYearId', {
                            onChange: (event) => {
                              const nextYearId = event.target.value as string;
                              const currentTermId =
                                examForm.getValues('termId');
                              if (
                                currentTermId &&
                                !terms.some(
                                  (term) =>
                                    term.id === currentTermId &&
                                    term.academicYearId === nextYearId,
                                )
                              )
                                examForm.setValue('termId', '', {
                                  shouldValidate: true,
                                });
                            },
                          })}
                          disabled={!canManageExams}
                        >
                          <option value="">Select academic year</option>
                          {years.map((year: AcademicYear) => (
                            <option key={year.id} value={year.id}>
                              {year.name}
                            </option>
                          ))}
                        </select>
                        {examForm.formState.errors.academicYearId && (
                          <small>
                            {examForm.formState.errors.academicYearId.message}
                          </small>
                        )}
                      </label>
                      <label>
                        Term (optional)
                        <select
                          {...examForm.register('termId')}
                          disabled={!canManageExams}
                        >
                          <option value="">Annual exam (no term)</option>
                          {availableTerms.map((term: AcademicTerm) => (
                            <option key={term.id} value={term.id}>
                              {term.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="examinations-form-row">
                        <label>
                          Start date
                          <input
                            type="date"
                            {...examForm.register('startDate')}
                            disabled={!canManageExams}
                          />
                        </label>
                        <label>
                          End date
                          <input
                            type="date"
                            {...examForm.register('endDate')}
                            disabled={!canManageExams}
                          />
                        </label>
                      </div>
                      <div className="examinations-actions examinations-form-submit-row">
                        {canManageExams && (
                          <Button type="submit" disabled={saveExam.isPending}>
                            {saveExam.isPending
                              ? 'Saving…'
                              : examEditId
                                ? 'Update exam'
                                : 'Create exam'}
                          </Button>
                        )}
                        {examEditId && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setExamEditId('');
                              examForm.reset();
                            }}
                          >
                            Cancel edit
                          </Button>
                        )}
                      </div>
                    </form>
                  </>
                )}
                {tab === 'Schedules' && (
                  <>
                    <h2>{scheduleEditId ? 'Edit schedule' : 'Add schedule'}</h2>
                    <form
                      className="examinations-form examinations-schedule-form"
                      onSubmit={scheduleForm.handleSubmit(submitSchedule)}
                    >
                      <label>
                        Exam
                        <select
                          value={examId}
                          onChange={(event) => setExamId(event.target.value)}
                          disabled={!canManageExams}
                        >
                          <option value="">Select an exam</option>
                          {exams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Class
                        <select
                          {...scheduleForm.register('classId')}
                          disabled={!canManageExams || !examId}
                          onChange={(event) => {
                            scheduleForm.setValue(
                              'classId',
                              event.target.value,
                            );
                            scheduleForm.setValue('sectionId', '');
                          }}
                        >
                          <option value="">Select class</option>
                          {examClasses.map((item: AcademicClass) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Section
                        <select
                          {...scheduleForm.register('sectionId')}
                          disabled={!canManageExams || !examId}
                        >
                          <option value="">Select section</option>
                          {sections
                            .filter(
                              (item: AcademicSection) =>
                                item.classId === scheduleForm.watch('classId'),
                            )
                            .map((item: AcademicSection) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Subject
                        <select
                          {...scheduleForm.register('subjectId')}
                          disabled={!canManageExams || !examId}
                        >
                          <option value="">Select subject</option>
                          {subjects.map((item: AcademicSubject) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="examinations-form-row">
                        <label>
                          Date
                          <input
                            type="date"
                            {...scheduleForm.register('date')}
                            disabled={!canManageExams || !examId}
                          />
                        </label>
                        <label>
                          Start time
                          <input
                            type="time"
                            {...scheduleForm.register('startTime')}
                            disabled={!canManageExams || !examId}
                          />
                        </label>
                      </div>
                      <div className="examinations-form-row examinations-form-row-three">
                        <label>
                          Duration (min)
                          <input
                            type="number"
                            min="1"
                            {...scheduleForm.register('durationMinutes')}
                            disabled={!canManageExams || !examId}
                          />
                        </label>
                        <label>
                          Total marks
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            {...scheduleForm.register('totalMarks')}
                            disabled={!canManageExams || !examId}
                          />
                        </label>
                        <label>
                          Passing marks
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            {...scheduleForm.register('passingMarks')}
                            disabled={!canManageExams || !examId}
                          />
                        </label>
                      </div>
                      {scheduleForm.formState.errors.root && (
                        <small>
                          {scheduleForm.formState.errors.root.message}
                        </small>
                      )}
                      <div className="examinations-actions examinations-form-submit-row">
                        {canManageExams && (
                          <Button
                            type="submit"
                            disabled={!examId || saveSchedule.isPending}
                          >
                            {scheduleEditId
                              ? 'Update schedule'
                              : 'Add schedule'}
                          </Button>
                        )}
                        {scheduleEditId && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setScheduleEditId('');
                              scheduleForm.reset();
                            }}
                          >
                            Cancel edit
                          </Button>
                        )}
                      </div>
                    </form>
                  </>
                )}
              </section>
            )}
            {(tab === 'Schedules' || tab === 'Exam calendar') && (
              <section className="examinations-card">
                <h2>
                  {tab === 'Exam calendar'
                    ? 'Exam calendar'
                    : 'Scheduled papers'}
                </h2>
                {tab === 'Exam calendar' && (
                  <>
                    <div className="examinations-filter-row">
                      <SelectField
                        label="Campus filter"
                        value={campusFilter}
                        onChange={setCampusFilter}
                      >
                        <option value="">All campuses</option>
                        {campuses.map((campus) => (
                          <option key={campus.id} value={campus.id}>
                            {campus.name}
                          </option>
                        ))}
                      </SelectField>
                      <SelectField
                        label="Term filter"
                        value={termFilter}
                        onChange={setTermFilter}
                      >
                        <option value="">All terms</option>
                        {terms.map((term: AcademicTerm) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    {visibleExams.length === 0 ? (
                      <EmptyState
                        title="No exams yet"
                        description="Create an exam to begin scheduling assessments."
                      />
                    ) : (
                      <ul className="examinations-record-list">
                        {visibleExams.map((exam) => (
                          <li key={exam.id}>
                            <div>
                              <strong>{examName(exam, years)}</strong>
                              <span>
                                {examTypeLabel(exam.type)} ·{' '}
                                {exam.termId
                                  ? (terms.find(
                                      (term) => term.id === exam.termId,
                                    )?.name ?? 'Term-based')
                                  : 'Annual (no term)'}{' '}
                                · {exam.startDate} to {exam.endDate}
                              </span>
                            </div>
                            {canManageExams && (
                              <div className="examinations-actions">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => {
                                    setExamForEdit(exam);
                                    setExamId(exam.id);
                                    setTab('Exams');
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="quiet"
                                  onClick={() => {
                                    void removeExam
                                      .mutateAsync(exam.id)
                                      .catch((error: unknown) =>
                                        setFormError(apiMessage(error)),
                                      );
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {tab === 'Schedules' && selectedExam && (
                  <>
                    <h3 className="examinations-subheading">
                      {selectedExam.name} · Schedules
                    </h3>

                    {examSchedules.isLoading ? (
                      <LoadingState message="Loading schedules..." />
                    ) : schedules.length === 0 ? (
                      <EmptyState
                        title="No schedules yet"
                        description="Add a class, section, and subject schedule."
                      />
                    ) : (
                      <ul className="examinations-record-list examinations-schedule-list">
                        {schedules.map((schedule) => (
                          <li key={schedule.id}>
                            <div>
                              <strong>
                                {subjects.find(
                                  (subject) =>
                                    subject.id === schedule.subjectId,
                                )?.name ?? 'Subject'}
                              </strong>
                              <span>
                                {classes.find(
                                  (item) => item.id === schedule.classId,
                                )?.name ?? 'Class'}{' '}
                                ·{' '}
                                {sections.find(
                                  (item) => item.id === schedule.sectionId,
                                )?.name ?? 'Section'}{' '}
                                · {schedule.date} {schedule.startTime}
                              </span>
                              <span>
                                {schedule.marksReviewStatus === 'submitted'
                                  ? 'Review pending'
                                  : schedule.marksReviewStatus ===
                                      'changes_requested'
                                    ? 'Changes requested'
                                    : 'Marks pending'}
                              </span>
                              <span>
                                {schedule.totalMarks} marks · pass{' '}
                                {schedule.passingMarks}
                              </span>
                            </div>
                            {canManageExams && (
                              <div className="examinations-actions">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => setViewSchedule(schedule)}
                                >
                                  View
                                </Button>
                                {schedule.marksReviewStatus === 'submitted' &&
                                  !selectedExam.resultsPublishedAt && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                          setClassId(schedule.classId);
                                          setSectionId(schedule.sectionId);
                                          setSubjectId(schedule.subjectId);
                                          setScheduleId(schedule.id);
                                          setTab('Marks sheet');
                                        }}
                                      >
                                        Review
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="quiet"
                                        disabled={requestMarksChanges.isPending}
                                        onClick={() => {
                                          void requestMarksChanges
                                            .mutateAsync(schedule.id)
                                            .catch((error: unknown) =>
                                              setFormError(apiMessage(error)),
                                            );
                                        }}
                                      >
                                        Request changes
                                      </Button>
                                    </>
                                  )}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => setScheduleForEdit(schedule)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="quiet"
                                  onClick={() => {
                                    void removeSchedule
                                      .mutateAsync(schedule.id)
                                      .catch((error: unknown) =>
                                        setFormError(apiMessage(error)),
                                      );
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
          {tab === 'Exams' && (
            <section className="examinations-card examinations-exam-list-card">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Created exams</h2>
                  <p>Review, edit or schedule an examination</p>
                </div>
                <span className="examinations-review-count">
                  {visibleExams.length}
                </span>
              </div>
              {visibleExams.length === 0 ? (
                <EmptyState
                  title="No exams created yet"
                  description="Create your first exam using the form above."
                />
              ) : (
                <ul className="examinations-record-list">
                  {visibleExams.map((exam) => (
                    <li key={exam.id} className="examinations-exam-record">
                      <div className="examinations-exam-record-copy">
                        <strong>{exam.name}</strong>
                        <span>Exam ID · {exam.id.slice(-8).toUpperCase()}</span>
                      </div>
                      {canManageExams && (
                        <div className="examinations-actions examinations-exam-record-actions">
                          <Button
                            type="button"
                            variant="quiet"
                            className="examinations-exam-action"
                            onClick={() => setViewExam(exam)}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="quiet"
                            className="examinations-exam-action"
                            onClick={() => {
                              setExamForEdit(exam);
                              setTab('Exams');
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="quiet"
                            className="examinations-exam-action"
                            onClick={() => {
                              setExamId(exam.id);
                              setScheduleEditId('');
                              setTab('Schedules');
                            }}
                          >
                            Schedule
                          </Button>
                          <Button
                            type="button"
                            variant="quiet"
                            className="examinations-exam-action is-delete"
                            onClick={() => {
                              void removeExam
                                .mutateAsync(exam.id)
                                .catch((error: unknown) =>
                                  setFormError(apiMessage(error)),
                                );
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </section>
      )}

      {tab === 'Marks sheet' && (
        <section className="examinations-panel">
          <div className="examinations-filter-toolbar examinations-mark-filter-toolbar">
            <div className="examinations-filter-heading">
              <div>
                <span>ASSESSMENT SELECTION</span>
                <strong>Choose an assessment</strong>
              </div>
              <p>
                Start with the exam, then narrow down to the scheduled class and
                subject.
              </p>
            </div>
            <div className="examinations-filters examinations-mark-filters">
              <SelectField
                label="Exam"
                value={examId}
                onChange={(value) => {
                  setExamId(value);
                  setClassId('');
                  setSectionId('');
                  setScheduleId('');
                }}
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Class"
                value={currentClassId}
                onChange={setClassId}
              >
                <option value="">Select class</option>
                {examClasses.map((item: AcademicClass) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Section"
                value={currentSectionId}
                onChange={setSectionId}
              >
                <option value="">Select section</option>
                {classSections.map((item: AcademicSection) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Subject"
                value={currentSubjectId}
                onChange={setSubjectId}
              >
                <option value="">Select subject</option>
                {availableMarkSubjects.map((item: AcademicSubject) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Scheduled assessment"
                value={selectedSchedule?.id ?? ''}
                onChange={setScheduleId}
              >
                {filteredSchedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.date} · {schedule.startTime} ·{' '}
                    {schedule.totalMarks} marks
                  </option>
                ))}
                {filteredSchedules.length === 0 && (
                  <option value="">No matching schedule</option>
                )}
              </SelectField>
            </div>
          </div>
          {examSchedules.error && (
            <ErrorState
              title="Schedules could not be loaded"
              description={apiMessage(examSchedules.error)}
              onRetry={() => void examSchedules.refetch()}
            />
          )}
          {markSheet.isLoading ? (
            <LoadingState message="Loading student roster..." />
          ) : markSheet.error ? (
            <ErrorState
              title="Student roster unavailable"
              description={apiMessage(markSheet.error)}
              onRetry={() => void markSheet.refetch()}
            />
          ) : !selectedSchedule ? (
            <EmptyState
              title="Select a scheduled assessment"
              description="Choose an exam, class, section, and subject with an active schedule."
            />
          ) : !markSheet.data?.items.length ? (
            <EmptyState
              title="No enrolled students"
              description="There are no active students in this section for the exam academic year."
            />
          ) : (
            <div className="examinations-card examinations-mark-card">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Mark sheet</h2>
                  <p className="examinations-mark-context">
                    {selectedExam?.name ?? 'Exam'} ·{' '}
                    {subjects.find(
                      (item) => item.id === selectedSchedule.subjectId,
                    )?.name ?? 'Subject'}{' '}
                    ·{' '}
                    {classes.find(
                      (item) => item.id === selectedSchedule.classId,
                    )?.name ?? 'Class'}{' '}
                    ·{' '}
                    {sections.find(
                      (item) => item.id === selectedSchedule.sectionId,
                    )?.name ?? 'Section'}{' '}
                    · {selectedSchedule.date} · Total{' '}
                    {selectedSchedule.totalMarks} · Pass{' '}
                    {selectedSchedule.passingMarks} ·{' '}
                    {selectedSchedule.durationMinutes} min
                  </p>
                  <p className="examinations-mark-review-note" role="status">
                    Status:{' '}
                    {selectedSchedule.marksReviewStatus === 'submitted'
                      ? 'Submitted for admin review'
                      : selectedSchedule.marksReviewStatus ===
                          'changes_requested'
                        ? 'Changes requested — update and resubmit'
                        : 'Draft — not submitted'}
                  </p>
                </div>
                {canWrite && (
                  <div className="examinations-actions examinations-mark-actions">
                    {isTeacher ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void saveMarkDraft()}
                          disabled={
                            saveMarks.isPending ||
                            submitMarksForReview.isPending ||
                            selectedSchedule.marksReviewStatus ===
                              'submitted' ||
                            invalidMarkCount > 0
                          }
                        >
                          {saveMarks.isPending ? 'Saving…' : 'Save draft'}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void submitMarkSheet()}
                          disabled={
                            saveMarks.isPending ||
                            submitMarksForReview.isPending ||
                            selectedSchedule.marksReviewStatus ===
                              'submitted' ||
                            markRemainingCount > 0 ||
                            invalidMarkCount > 0
                          }
                        >
                          {submitMarksForReview.isPending
                            ? 'Submitting…'
                            : 'Submit for review'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => void saveMarkDraft()}
                        disabled={saveMarks.isPending || invalidMarkCount > 0}
                      >
                        {saveMarks.isPending ? 'Saving…' : 'Save marks'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div
                className="examinations-mark-stats"
                aria-label="Marks entry progress"
              >
                <div>
                  <span>Total students</span>
                  <strong>{markRoster.length}</strong>
                </div>
                <div>
                  <span>Marks entered</span>
                  <strong>{markEnteredCount}</strong>
                </div>
                <div>
                  <span>Absent</span>
                  <strong>{markAbsentCount}</strong>
                </div>
                <div
                  className={
                    markRemainingCount > 0 ? 'is-pending' : 'is-complete'
                  }
                >
                  <span>Remaining</span>
                  <strong>{markRemainingCount}</strong>
                </div>
              </div>
              <div
                className="examinations-mark-progress"
                role="progressbar"
                aria-label="Marks entry completion"
                aria-valuemin={0}
                aria-valuemax={markRoster.length}
                aria-valuenow={markEnteredCount + markAbsentCount}
              >
                <span
                  style={{
                    width: `${((markEnteredCount + markAbsentCount) / markRoster.length) * 100}%`,
                  }}
                />
              </div>
              {formError && (
                <p className="examinations-form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="examinations-mark-list-heading">
                <div>
                  <strong>Student roster</strong>
                  <span>
                    {markRoster.length} enrolled students · Enter marks or mark
                    absent
                  </span>
                </div>
                <span>Out of {selectedSchedule.totalMarks}</span>
              </div>
              <div className="examinations-mark-list">
                {markSheet.data.items.map((student, index) => {
                  const current = marksByStudent[student.id] ?? {
                    marks: '',
                    absent: false,
                    remarks: '',
                  };
                  return (
                    <article className="examinations-mark-row" key={student.id}>
                      <div className="examinations-mark-student">
                        <span className="examinations-mark-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="examinations-mark-student-details">
                          <strong>{studentName(student)}</strong>
                          <small>
                            {student.registrationNumber
                              ? `Admission No. ${student.registrationNumber}`
                              : 'Admission No. —'}
                          </small>
                        </div>
                        {student.mark?.grade && (
                          <span className="examinations-grade-pill">
                            {student.mark.grade}
                          </span>
                        )}
                      </div>
                      <label className="examinations-mark-input">
                        Marks
                        <input
                          aria-label={`Marks for ${studentName(student)}`}
                          type="number"
                          min="0"
                          max={selectedSchedule.totalMarks}
                          step="0.01"
                          inputMode="decimal"
                          aria-invalid={
                            !current.absent &&
                            current.marks.trim() !== '' &&
                            (!Number.isFinite(Number(current.marks)) ||
                              Number(current.marks) < 0 ||
                              Number(current.marks) >
                                selectedSchedule.totalMarks)
                          }
                          value={current.marks}
                          disabled={
                            !canWrite ||
                            current.absent ||
                            (access.data?.role === 'teacher' &&
                              selectedSchedule.marksReviewStatus ===
                                'submitted')
                          }
                          onChange={(event) =>
                            setMarksByStudent((previous) => ({
                              ...previous,
                              [student.id]: {
                                ...current,
                                marks: event.target.value,
                              },
                            }))
                          }
                        />
                        {!current.absent &&
                          current.marks.trim() !== '' &&
                          (!Number.isFinite(Number(current.marks)) ||
                            Number(current.marks) < 0 ||
                            Number(current.marks) >
                              selectedSchedule.totalMarks) && (
                            <small className="examinations-mark-validation">
                              Enter 0 to {selectedSchedule.totalMarks}.
                            </small>
                          )}
                      </label>
                      <label className="examinations-absent">
                        <input
                          type="checkbox"
                          checked={current.absent}
                          disabled={
                            !canWrite ||
                            (access.data?.role === 'teacher' &&
                              selectedSchedule.marksReviewStatus ===
                                'submitted')
                          }
                          onChange={(event) =>
                            setMarksByStudent((previous) => ({
                              ...previous,
                              [student.id]: {
                                ...current,
                                absent: event.target.checked,
                                marks: '',
                              },
                            }))
                          }
                        />{' '}
                        Absent
                      </label>
                      <label className="examinations-remark-input">
                        Remarks
                        <input
                          aria-label={`Remarks for ${studentName(student)}`}
                          maxLength={500}
                          value={current.remarks}
                          disabled={
                            !canWrite ||
                            (access.data?.role === 'teacher' &&
                              selectedSchedule.marksReviewStatus ===
                                'submitted')
                          }
                          onChange={(event) =>
                            setMarksByStudent((previous) => ({
                              ...previous,
                              [student.id]: {
                                ...current,
                                remarks: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => openStudentReport(student.id)}
                      >
                        View report
                      </Button>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'Grading scales' && (
        <section className="examinations-panel">
          <div className="examinations-grid examinations-grid-scales">
            <form
              className="examinations-card examinations-form"
              onSubmit={(event) => void submitScale(event)}
            >
              <h2>
                {scaleEditId ? 'Edit grading scale' : 'Create grading scale'}
              </h2>
              <label>
                Scale name
                <input
                  value={scaleName}
                  maxLength={100}
                  onChange={(event) => setScaleName(event.target.value)}
                  disabled={!canWrite}
                  required
                />
              </label>
              <div className="examinations-grade-editor">
                <div className="examinations-grade-editor-heading">
                  <div>
                    <h3>Grade bands</h3>
                    <p>
                      Set inclusive percentage boundaries and the GPA for each
                      grade.
                    </p>
                  </div>
                  {canWrite && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="examinations-add-band"
                      disabled={scaleBands.length >= 30}
                      onClick={() =>
                        setScaleBands((previous) => [
                          ...previous,
                          {
                            grade: '',
                            minPercentage: 0,
                            maxPercentage: 100,
                            gpa: 0,
                          },
                        ])
                      }
                    >
                      + Add Band
                    </Button>
                  )}
                </div>
                <div className="examinations-grade-table-wrap">
                  <table className="examinations-grade-table">
                    <thead>
                      <tr>
                        <th scope="col">Grade</th>
                        <th scope="col">Min %</th>
                        <th scope="col">Max %</th>
                        <th scope="col">GPA</th>
                        {canWrite && (
                          <th scope="col">
                            <span className="visually-hidden">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {scaleBands.map((band, index) => (
                        <tr key={`${index}-${band.grade}`}>
                          <td data-label="Grade">
                            <input
                              aria-label={`Grade label ${index + 1}`}
                              maxLength={10}
                              value={band.grade}
                              onChange={(event) =>
                                updateScaleBand(
                                  index,
                                  'grade',
                                  event.target.value,
                                )
                              }
                              disabled={!canWrite}
                            />
                          </td>
                          <td data-label="Min %">
                            <input
                              aria-label={`Minimum percentage for ${band.grade || `band ${index + 1}`}`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={
                                Number.isFinite(band.minPercentage)
                                  ? band.minPercentage
                                  : ''
                              }
                              onChange={(event) =>
                                updateScaleBand(
                                  index,
                                  'minPercentage',
                                  event.target.value,
                                )
                              }
                              disabled={!canWrite}
                            />
                          </td>
                          <td data-label="Max %">
                            <input
                              aria-label={`Maximum percentage for ${band.grade || `band ${index + 1}`}`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={
                                Number.isFinite(band.maxPercentage)
                                  ? band.maxPercentage
                                  : ''
                              }
                              onChange={(event) =>
                                updateScaleBand(
                                  index,
                                  'maxPercentage',
                                  event.target.value,
                                )
                              }
                              disabled={!canWrite}
                            />
                          </td>
                          <td data-label="GPA">
                            <input
                              aria-label={`GPA for ${band.grade || `band ${index + 1}`}`}
                              type="number"
                              min="0"
                              max="10"
                              step="0.01"
                              value={Number.isFinite(band.gpa) ? band.gpa : ''}
                              onChange={(event) =>
                                updateScaleBand(
                                  index,
                                  'gpa',
                                  event.target.value,
                                )
                              }
                              disabled={!canWrite}
                            />
                          </td>
                          {canWrite && (
                            <td className="examinations-grade-row-action">
                              <Button
                                type="button"
                                variant="quiet"
                                aria-label={`Remove ${band.grade || `grade band ${index + 1}`}`}
                                disabled={scaleBands.length === 1}
                                onClick={() =>
                                  setScaleBands((previous) =>
                                    previous.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <small className="examinations-helper-text">
                  Bands must be unique and cover 0–100 without gaps or overlaps.
                </small>
                {gradingScaleError && (
                  <small className="examinations-validation-hint" role="status">
                    {gradingScaleError}
                  </small>
                )}
              </div>
              {canWrite && (
                <div className="examinations-actions">
                  <Button
                    type="submit"
                    disabled={
                      saveScale.isPending ||
                      Boolean(gradingScaleError) ||
                      !scaleName.trim()
                    }
                  >
                    {scaleEditId ? 'Save changes' : 'Create active scale'}
                  </Button>
                  {scaleEditId && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setScaleEditId('');
                        setScaleName('');
                        setScaleBands(defaultGrades);
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              )}
            </form>
            <section className="examinations-card">
              <h2>Organization grading scales</h2>
              {scales.length === 0 ? (
                <EmptyState
                  title="No grading scales"
                  description="Create a scale to calculate student letter grades."
                />
              ) : (
                <ul className="examinations-record-list">
                  {scales.map((scale) => (
                    <li key={scale.id}>
                      <div>
                        <strong>
                          {scale.name}{' '}
                          {scale.isActive && (
                            <span className="examinations-active-badge">
                              Active
                            </span>
                          )}
                        </strong>
                        <span>
                          {scale.gradeBreakdowns
                            .map(
                              (item) =>
                                `${item.grade} ${item.minPercentage}–${item.maxPercentage}%`,
                            )
                            .join(' · ')}
                        </span>
                      </div>
                      {canWrite && (
                        <div className="examinations-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => editScale(scale)}
                          >
                            Edit
                          </Button>
                          {!scale.isActive && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                void saveScale
                                  .mutateAsync({
                                    id: scale.id,
                                    data: { isActive: true },
                                  })
                                  .catch((error: unknown) =>
                                    setFormError(apiMessage(error)),
                                  );
                              }}
                            >
                              Set active
                            </Button>
                          )}
                          {!scale.isActive && (
                            <Button
                              type="button"
                              variant="quiet"
                              onClick={() => {
                                void removeScale
                                  .mutateAsync(scale.id)
                                  .catch((error: unknown) =>
                                    setFormError(apiMessage(error)),
                                  );
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </section>
      )}

      {tab === 'Student report' && (
        <section className="examinations-panel">
          <div className="examinations-filter-toolbar examinations-report-filter-toolbar">
            <div className="examinations-filter-heading">
              <div>
                <span>STUDENT LOOKUP</span>
                <strong>Choose a result to review</strong>
              </div>
              <p>
                Select an exam, class, section and student. The report includes
                every scheduled subject for that student.
              </p>
            </div>
            <div className="examinations-report-select examinations-report-filters">
              <SelectField
                label="Exam"
                value={reportExamId}
                onChange={(value) => {
                  setReportExamId(value);
                  setExamId(value);
                  setReportStudentId('');
                }}
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Class"
                value={currentClassId}
                onChange={(value) => {
                  setClassId(value);
                  setSectionId('');
                  setReportStudentId('');
                }}
              >
                <option value="">Select class</option>
                {examClasses.map((item: AcademicClass) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Section"
                value={currentSectionId}
                onChange={(value) => {
                  setSectionId(value);
                  setReportStudentId('');
                }}
              >
                <option value="">Select section</option>
                {classSections.map((item: AcademicSection) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Student"
                value={reportStudentId}
                onChange={setReportStudentId}
                disabled={!markSheet.data?.items.length}
              >
                <option value="">Select student</option>
                {(markSheet.data?.items ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {studentName(student)}
                  </option>
                ))}
              </SelectField>
            </div>
            <p className="examinations-helper-text">
              Choose an exam, class, section, subject and student to preview the
              complete subject-wise result record.
            </p>
          </div>
          {canManageExams && selectedReportExam && (
            <div className="examinations-result-publish-bar">
              <div>
                <strong>
                  {selectedReportExam.resultsPublishedAt
                    ? 'Results are published'
                    : 'Results are not published'}
                </strong>
                <span>
                  {selectedReportExam.resultsPublishedAt
                    ? 'Parents and students can view this official result.'
                    : 'Publish only after every scheduled subject has been reviewed and submitted.'}
                </span>
              </div>
              <Button
                type="button"
                variant={
                  selectedReportExam.resultsPublishedAt
                    ? 'secondary'
                    : 'primary'
                }
                disabled={
                  setResultsPublication.isPending ||
                  (!selectedReportExam.resultsPublishedAt &&
                    (examSchedules.isLoading ||
                      schedules.length === 0 ||
                      schedules.some(
                        (item) => item.marksReviewStatus !== 'submitted',
                      )))
                }
                onClick={() => {
                  const published = !selectedReportExam.resultsPublishedAt;
                  const message = published
                    ? 'Publish results to parent and student portals?'
                    : 'Hide results from parent and student portals?';
                  if (!window.confirm(message)) return;
                  setFormError('');
                  void setResultsPublication
                    .mutateAsync({ examId: selectedReportExam.id, published })
                    .catch((error: unknown) => setFormError(apiMessage(error)));
                }}
              >
                {setResultsPublication.isPending
                  ? 'Updating…'
                  : selectedReportExam.resultsPublishedAt
                    ? 'Unpublish results'
                    : 'Publish results'}
              </Button>
            </div>
          )}
          {report.isFetching && (
            <LoadingState message="Loading student report..." />
          )}
          {report.error && (
            <ErrorState
              title="Student report unavailable"
              description={apiMessage(report.error)}
              onRetry={() => void report.refetch()}
            />
          )}
          {!report.isFetching && !report.error && !report.data && (
            <EmptyState
              title="Choose a student report"
              description="Select an exam, then choose a student from its currently selected class roster. You can also open a report directly from the marks sheet."
            />
          )}
          {report.data?.report && (
            <>
              <div
                className="examinations-result-actions"
                aria-label="Result card actions"
              >
                <p>
                  Ready to share? Print this result or choose “Save as PDF” in
                  your browser’s print dialog.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={16} aria-hidden="true" />
                  Print / Save PDF
                </Button>
              </div>
              <article className="examinations-card report-card examinations-official-result">
                <header className="examinations-result-card-header">
                  <div className="examinations-result-brand">
                    <span
                      className="examinations-result-brand-mark"
                      aria-hidden="true"
                    >
                      I
                    </span>
                    <div>
                      <p className="eyebrow">INSTITUTEOS · ACADEMIC RECORD</p>
                      <h2>
                        {report.data.report.exam.resultsPublishedAt
                          ? 'Official Result Card'
                          : 'Result Preview'}
                      </h2>
                      <p>
                        {report.data.report.exam.name} ·{' '}
                        {examTypeLabel(report.data.report.exam.type)}
                      </p>
                      <p className="examinations-result-date">
                        {report.data.report.exam.startDate} –{' '}
                        {report.data.report.exam.endDate}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      report.data.report.exam.resultsPublishedAt
                        ? 'examinations-result-status is-published'
                        : 'examinations-result-status is-pending'
                    }
                  >
                    <span aria-hidden="true" />
                    {report.data.report.exam.resultsPublishedAt
                      ? 'Published result'
                      : 'Admin preview · Not published'}
                  </span>
                </header>

                <section className="examinations-result-student">
                  <div className="examinations-result-section-heading">
                    <span>STUDENT INFORMATION</span>
                    <span>EXAM RECORD</span>
                  </div>
                  <div className="examinations-result-identity-grid">
                    <div className="is-student-name">
                      <span>Student name</span>
                      <strong>
                        {reportStudent
                          ? studentName(reportStudent)
                          : 'Student result'}
                      </strong>
                    </div>
                    <div>
                      <span>Admission number</span>
                      <strong>
                        {reportStudent?.registrationNumber ?? '—'}
                      </strong>
                    </div>
                    <div>
                      <span>Class</span>
                      <strong>
                        {classes.find((item) => item.id === currentClassId)
                          ?.name ?? '—'}
                      </strong>
                    </div>
                    <div>
                      <span>Section</span>
                      <strong>
                        {sections.find((item) => item.id === currentSectionId)
                          ?.name ?? '—'}
                      </strong>
                    </div>
                  </div>
                </section>

                <section
                  className="examinations-result-performance"
                  aria-label="Overall performance"
                >
                  <div className="examinations-result-metric is-primary">
                    <span>Overall percentage</span>
                    <strong>
                      {!reportIsComplete ||
                      report.data.report.percentage === null
                        ? 'Pending'
                        : `${report.data.report.percentage}%`}
                    </strong>
                    <small>
                      {reportPendingCount > 0
                        ? `${reportPendingCount} subject(s) awaiting marks`
                        : `${reportAssessedCount} of ${reportResults.length} subjects assessed`}
                    </small>
                  </div>
                  <div className="examinations-result-metric">
                    <span>Marks recorded</span>
                    <strong>{report.data.report.totalMarksObtained}</strong>
                    <small>
                      {reportIsComplete
                        ? `Out of ${report.data.report.totalMarksPossible}`
                        : 'Across assessed subjects only'}
                    </small>
                  </div>
                  <div className="examinations-result-metric">
                    <span>Overall grade</span>
                    <strong>{report.data.report.overallGrade ?? '—'}</strong>
                    <small>
                      {scales.find((item) => item.isActive)?.name ??
                        'Grading scale not configured'}
                    </small>
                  </div>
                  <div className="examinations-result-metric">
                    <span>Subjects assessed</span>
                    <strong>
                      {reportAssessedCount}/{reportResults.length}
                    </strong>
                    <small>
                      {reportPendingCount} pending · {reportAbsentCount} absent
                    </small>
                  </div>
                </section>

                <section className="examinations-result-subjects">
                  <div className="examinations-result-section-heading">
                    <span>Subject-wise Performance</span>
                    <span>
                      {report.data.report.results.length}{' '}
                      {report.data.report.results.length === 1
                        ? 'subject'
                        : 'subjects'}
                    </span>
                  </div>
                  {report.data.report.results.length === 0 ? (
                    <EmptyState
                      title="No subject results"
                      description="This student has no scheduled subjects for the selected exam."
                    />
                  ) : (
                    <div className="examinations-report-table-wrap">
                      <table className="examinations-report-table">
                        <thead>
                          <tr>
                            <th scope="col">Subject</th>
                            <th scope="col">Obtained</th>
                            <th scope="col">Total</th>
                            <th scope="col">Percentage</th>
                            <th scope="col">Grade</th>
                            <th scope="col">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.data.report.results.map((result) => (
                            <tr key={result.schedule.id}>
                              <th scope="row" data-label="Subject">
                                {result.subjectName}
                              </th>
                              <td data-label="Obtained Marks">
                                {result.mark?.isAbsent
                                  ? 'Absent'
                                  : (result.mark?.marksObtained ?? 'Pending')}
                              </td>
                              <td data-label="Total Marks">
                                {result.schedule.totalMarks}
                              </td>
                              <td data-label="Percentage">
                                {result.mark?.isAbsent
                                  ? '—'
                                  : !result.mark
                                    ? 'Pending'
                                    : result.mark.percentage === null
                                      ? '—'
                                      : `${result.mark.percentage}%`}
                              </td>
                              <td data-label="Grade">
                                {result.mark?.isAbsent
                                  ? '—'
                                  : !result.mark
                                    ? 'Pending'
                                    : (result.mark.grade ?? '—')}
                              </td>
                              <td data-label="Remarks">
                                {result.mark?.remarks || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row" data-label="Summary">
                              Total
                            </th>
                            <td data-label="Obtained">
                              {report.data.report.totalMarksObtained}
                            </td>
                            <td data-label="Maximum">
                              {report.data.report.totalMarksPossible}
                            </td>
                            <td data-label="Overall percentage">
                              {reportIsComplete &&
                              report.data.report.percentage !== null
                                ? `${report.data.report.percentage}%`
                                : 'Pending'}
                            </td>
                            <td data-label="Overall grade">
                              {report.data.report.overallGrade ?? '—'}
                            </td>
                            <td data-label="Remarks">
                              {reportPendingCount > 0
                                ? `${reportPendingCount} subject(s) pending`
                                : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>
                <footer className="examinations-result-footer">
                  <div
                    className="examinations-result-signatures"
                    aria-label="Verification signatures"
                  >
                    <div>
                      <span>Class Teacher</span>
                      <i />
                    </div>
                    <div>
                      <span>Examination In-charge</span>
                      <i />
                    </div>
                    <div>
                      <span>Principal / Head</span>
                      <i />
                    </div>
                  </div>
                  <div className="examinations-result-footnote">
                    <span>
                      Generated from the institute examination records.
                    </span>
                    <strong>
                      {report.data.report.exam.resultsPublishedAt
                        ? 'Official published record'
                        : 'Preview only · Not an official published result'}
                    </strong>
                  </div>
                </footer>
              </article>
            </>
          )}
        </section>
      )}
      {viewSchedule && (
        <div
          className="examinations-detail-backdrop"
          onClick={() => setViewSchedule(null)}
        >
          <section
            className="examinations-detail-dialog examinations-schedule-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="examinations-schedule-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="examinations-detail-heading">
              <div>
                <p className="eyebrow">SCHEDULED PAPER</p>
                <h2 id="examinations-schedule-detail-title">
                  {subjects.find((item) => item.id === viewSchedule.subjectId)
                    ?.name ?? 'Subject'}
                </h2>
                <p>
                  {selectedExam?.name ?? 'Examination'} ·{' '}
                  {classes.find((item) => item.id === viewSchedule.classId)
                    ?.name ?? 'Class'}{' '}
                  ·{' '}
                  {sections.find((item) => item.id === viewSchedule.sectionId)
                    ?.name ?? 'Section'}
                </p>
              </div>
              <Button
                type="button"
                variant="quiet"
                aria-label="Close schedule details"
                onClick={() => setViewSchedule(null)}
              >
                ×
              </Button>
            </header>
            <div className="examinations-detail-grid">
              <div>
                <span>Exam date</span>
                <strong>{viewSchedule.date}</strong>
              </div>
              <div>
                <span>Start time</span>
                <strong>{viewSchedule.startTime}</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{viewSchedule.durationMinutes} minutes</strong>
              </div>
              <div>
                <span>Total marks</span>
                <strong>{viewSchedule.totalMarks}</strong>
              </div>
              <div>
                <span>Passing marks</span>
                <strong>{viewSchedule.passingMarks}</strong>
              </div>
              <div>
                <span>Marks status</span>
                <strong>
                  {viewSchedule.marksReviewStatus === 'submitted'
                    ? 'Submitted for review'
                    : viewSchedule.marksReviewStatus === 'changes_requested'
                      ? 'Changes requested'
                      : 'Pending'}
                </strong>
              </div>
            </div>
            <div className="examinations-actions examinations-detail-actions">
              {canManageExams && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setScheduleForEdit(viewSchedule);
                    setViewSchedule(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Edit paper
                </Button>
              )}
              <Button type="button" onClick={() => setViewSchedule(null)}>
                Close
              </Button>
            </div>
          </section>
        </div>
      )}
      {viewExam && (
        <div
          className="examinations-detail-backdrop"
          onClick={() => setViewExam(null)}
        >
          <section
            className="examinations-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="examinations-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="examinations-detail-heading">
              <div>
                <p className="eyebrow">EXAM DETAILS</p>
                <h2 id="examinations-detail-title">
                  {examName(viewExam, years)}
                </h2>
                <p>{examTypeLabel(viewExam.type)}</p>
              </div>
              <Button
                type="button"
                variant="quiet"
                aria-label="Close exam details"
                onClick={() => setViewExam(null)}
              >
                ×
              </Button>
            </header>
            <div className="examinations-detail-grid">
              <div>
                <span>Campus</span>
                <strong>
                  {campuses.find((item) => item.id === viewExam.campusId)
                    ?.name ?? '—'}
                </strong>
              </div>
              <div>
                <span>Academic year</span>
                <strong>
                  {years.find((item) => item.id === viewExam.academicYearId)
                    ?.name ?? '—'}
                </strong>
              </div>
              <div>
                <span>Term</span>
                <strong>
                  {terms.find((item) => item.id === viewExam.termId)?.name ??
                    'Annual'}
                </strong>
              </div>
              <div>
                <span>Start date</span>
                <strong>{viewExam.startDate}</strong>
              </div>
              <div>
                <span>End date</span>
                <strong>{viewExam.endDate}</strong>
              </div>
              <div>
                <span>Result status</span>
                <strong>
                  {viewExam.resultsPublishedAt ? 'Published' : 'Not published'}
                </strong>
              </div>
            </div>
            <div className="examinations-actions examinations-detail-actions">
              {canManageExams && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setViewExam(null);
                    setExamForEdit(viewExam);
                    setTab('Exams');
                  }}
                >
                  Edit exam
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  setExamId(viewExam.id);
                  setScheduleEditId('');
                  setViewExam(null);
                  setTab('Schedules');
                }}
              >
                Manage schedule
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
