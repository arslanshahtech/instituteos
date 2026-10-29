import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useParams } from 'react-router-dom';
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
  useExaminationWorkspace,
  useSaveExam,
  useSaveExamMarks,
  useSetExamResultsPublication,
  useSaveExamSchedule,
  useSaveGradingScale,
  useStudentExamReport,
} from './examinations-queries.js';

const examSchema = z.object({
  name: z.string().trim().min(1, 'Enter an exam name.').max(120),
  type: z.enum(['midterm', 'final', 'quiz']),
  academicYearId: z.string().min(1, 'Select an academic year.'),
  termId: z.string().min(1, 'Select a term.'),
  campusId: z.string().min(1, 'Select a campus.'),
  startDate: z.string().min(1, 'Select a start date.'),
  endDate: z.string().min(1, 'Select an end date.'),
});
type ExamFormValues = z.infer<typeof examSchema>;

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

const tabs = [
  'Exams & schedules',
  'Marks entry sheet',
  'Grading scales',
  'Student report',
] as const;
type Tab = (typeof tabs)[number];

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
  const workspace = useExaminationWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const academics = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const exams = workspace.exams.data?.items ?? [];
  const campuses = academics.campuses.data?.campuses ?? [];
  const years = academics.years.data?.items ?? [];
  const terms = academics.terms.data?.items ?? [];
  const classes = academics.classes.data?.items ?? [];
  const sections = academics.sections.data?.items ?? [];
  const subjects = academics.subjects.data?.items ?? [];
  const [tab, setTab] = useState<Tab>('Exams & schedules');
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
  const schedules = examSchedules.data?.items ?? [];
  const selectedExam = exams.find((item) => item.id === examId);
  const examClasses = classes.filter(
    (item: AcademicClass) =>
      !selectedExam || item.campusId === selectedExam.campusId,
  );
  const currentClassId =
    classId && examClasses.some((item) => item.id === classId)
      ? classId
      : (examClasses[0]?.id ?? '');
  const classSections = sections.filter(
    (item: AcademicSection) => item.classId === currentClassId,
  );
  const currentSectionId =
    sectionId && classSections.some((item) => item.id === sectionId)
      ? sectionId
      : (classSections[0]?.id ?? '');
  const currentSubjectId =
    subjectId && subjects.some((item) => item.id === subjectId)
      ? subjectId
      : (subjects[0]?.id ?? '');
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
  const report = useStudentExamReport(
    organizationId,
    reportExamId,
    reportStudentId,
    Boolean(access.data && canRead),
  );
  const saveExam = useSaveExam(organizationId);
  const removeExam = useDeleteExam(organizationId);
  const setResultsPublication = useSetExamResultsPublication(organizationId);
  const saveSchedule = useSaveExamSchedule(organizationId);
  const removeSchedule = useDeleteExamSchedule(organizationId);
  const saveMarks = useSaveExamMarks(organizationId);
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
  const scales = workspace.scales.data?.items ?? [];

  useEffect(() => {
    if (examId && !exams.some((item) => item.id === examId)) setExamId('');
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
      termId: exam.termId,
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
        data: values,
      });
      setExamEditId('');
      examForm.reset();
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

  async function submitMarkSheet() {
    if (!selectedSchedule || !markSheet.data?.items.length) return;
    const records = markSheet.data.items.map((student) => {
      const current = marksByStudent[student.id] ?? {
        marks: '',
        absent: false,
        remarks: '',
      };
      return {
        studentId: student.id,
        isAbsent: current.absent,
        ...(current.absent ? {} : { marksObtained: Number(current.marks) }),
        ...(current.remarks ? { remarks: current.remarks } : {}),
      };
    });
    setFormError('');
    try {
      await saveMarks.mutateAsync({
        scheduleId: selectedSchedule.id,
        records,
      });
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
    return <LoadingState message="Checking examination access..." />;
  if (access.error)
    return (
      <ErrorState
        title="Organization unavailable"
        description={apiMessage(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;

  const loading =
    workspace.exams.isLoading ||
    workspace.scales.isLoading ||
    academics.years.isLoading ||
    academics.terms.isLoading ||
    academics.classes.isLoading ||
    academics.sections.isLoading ||
    academics.subjects.isLoading ||
    academics.campuses.isLoading;
  const queryError =
    workspace.exams.error ||
    workspace.scales.error ||
    academics.years.error ||
    academics.terms.error ||
    academics.classes.error ||
    academics.sections.error ||
    academics.subjects.error ||
    academics.campuses.error;
  if (loading) return <LoadingState message="Loading examinations..." />;
  if (queryError)
    return (
      <ErrorState
        title="Examinations could not be loaded"
        description={apiMessage(queryError)}
        onRetry={() => {
          void workspace.exams.refetch();
          void workspace.scales.refetch();
          void academics.years.refetch();
          void academics.terms.refetch();
          void academics.classes.refetch();
          void academics.sections.refetch();
          void academics.subjects.refetch();
          void academics.campuses.refetch();
        }}
      />
    );

  return (
    <main className="examinations-page reference-live-module">
      <WorkspacePageHeading
        className="examinations-page-heading"
        eyebrow="Academic workspace"
        title="Examinations & assessment"
        description="Manage exam schedules, enter marks, configure grading, and review student results."
      />
      <label className="examinations-mobile-tab-switcher">
        <span className="visually-hidden">Examination view</span>
        <select
          aria-label="Examination view"
          value={tab}
          onChange={(event) => {
            const nextTab = tabs.find(
              (item) => item === event.currentTarget.value,
            );
            if (nextTab) {
              setTab(nextTab);
              setFormError('');
            }
          }}
        >
          {tabs.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <nav
        className="academics-tabs attendance-tabs"
        aria-label="Examination sections"
      >
        {tabs.map((item) => (
          <button
            aria-current={tab === item ? 'page' : undefined}
            className={`academics-tab${tab === item ? ' academics-tab-active' : ''}`}
            key={item}
            onClick={() => {
              setTab(item);
              setFormError('');
            }}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>
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

      {tab === 'Exams & schedules' && (
        <section className="examinations-panel">
          <div className="examinations-grid">
            <section className="examinations-card">
              <h2>{examEditId ? 'Update exam' : 'Create exam'}</h2>
              <form
                className="examinations-form"
                onSubmit={examForm.handleSubmit(submitExam)}
              >
                <label>
                  Exam name
                  <input {...examForm.register('name')} disabled={!canWrite} />
                  {examForm.formState.errors.name && (
                    <small>{examForm.formState.errors.name.message}</small>
                  )}
                </label>
                <label>
                  Exam type
                  <select {...examForm.register('type')} disabled={!canWrite}>
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                    <option value="quiz">Quiz</option>
                  </select>
                </label>
                <label>
                  Campus
                  <select
                    {...examForm.register('campusId')}
                    disabled={!canWrite}
                  >
                    <option value="">Select campus</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                  {examForm.formState.errors.campusId && (
                    <small>{examForm.formState.errors.campusId.message}</small>
                  )}
                </label>
                <label>
                  Academic year
                  <select
                    {...examForm.register('academicYearId')}
                    disabled={!canWrite}
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
                  Term
                  <select {...examForm.register('termId')} disabled={!canWrite}>
                    <option value="">Select term</option>
                    {availableTerms.map((term: AcademicTerm) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                  {examForm.formState.errors.termId && (
                    <small>{examForm.formState.errors.termId.message}</small>
                  )}
                </label>
                <div className="examinations-form-row">
                  <label>
                    Start date
                    <input
                      type="date"
                      {...examForm.register('startDate')}
                      disabled={!canWrite}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      {...examForm.register('endDate')}
                      disabled={!canWrite}
                    />
                  </label>
                </div>
                <div className="examinations-actions">
                  {canWrite && (
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
              <h3 className="examinations-subheading">Add a schedule</h3>
              <SelectField label="Exam" value={examId} onChange={setExamId}>
                <option value="">Select an exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </SelectField>
              <form
                className="examinations-form"
                onSubmit={scheduleForm.handleSubmit(submitSchedule)}
              >
                <label>
                  Class
                  <select
                    {...scheduleForm.register('classId')}
                    disabled={!canWrite || !examId}
                    onChange={(event) => {
                      scheduleForm.setValue('classId', event.target.value);
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
                    disabled={!canWrite || !examId}
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
                    disabled={!canWrite || !examId}
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
                      disabled={!canWrite || !examId}
                    />
                  </label>
                  <label>
                    Start time
                    <input
                      type="time"
                      {...scheduleForm.register('startTime')}
                      disabled={!canWrite || !examId}
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
                      disabled={!canWrite || !examId}
                    />
                  </label>
                  <label>
                    Total marks
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      {...scheduleForm.register('totalMarks')}
                      disabled={!canWrite || !examId}
                    />
                  </label>
                  <label>
                    Passing marks
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      {...scheduleForm.register('passingMarks')}
                      disabled={!canWrite || !examId}
                    />
                  </label>
                </div>
                {scheduleForm.formState.errors.root && (
                  <small>{scheduleForm.formState.errors.root.message}</small>
                )}
                <div className="examinations-actions">
                  {canWrite && (
                    <Button
                      type="submit"
                      disabled={!examId || saveSchedule.isPending}
                    >
                      {scheduleEditId ? 'Update schedule' : 'Add schedule'}
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
            </section>
            <section className="examinations-card">
              <h2>Exam calendar</h2>
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
                          {exam.type} · {exam.startDate} to {exam.endDate}
                        </span>
                      </div>
                      {canWrite && (
                        <div className="examinations-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setExamForEdit(exam);
                              setExamId(exam.id);
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
              {selectedExam && (
                <>
                  <h3 className="examinations-subheading">
                    Schedules · {selectedExam.name}
                  </h3>
                  <p className="examinations-readonly-note" role="status">
                    {selectedExam.resultsPublishedAt
                      ? `Results published on ${new Date(selectedExam.resultsPublishedAt).toLocaleString()}. Unpublish before editing marks or schedules.`
                      : 'Results are in draft. Parents and students cannot see them until they are published.'}
                  </p>
                  {canManageExams && (
                    <div className="examinations-actions">
                      <Button
                        type="button"
                        variant={
                          selectedExam.resultsPublishedAt
                            ? 'secondary'
                            : 'primary'
                        }
                        disabled={
                          setResultsPublication.isPending ||
                          (!selectedExam.resultsPublishedAt &&
                            (examSchedules.isLoading || schedules.length === 0))
                        }
                        onClick={() => {
                          const published = !selectedExam.resultsPublishedAt;
                          const message = published
                            ? 'Publish these exam results to linked parent and student portals? This requires marks for every student in every scheduled class.'
                            : 'Unpublish these results? Parents and students will no longer see them.';
                          if (!window.confirm(message)) return;
                          setFormError('');
                          void setResultsPublication
                            .mutateAsync({ examId: selectedExam.id, published })
                            .catch((error: unknown) =>
                              setFormError(apiMessage(error)),
                            );
                        }}
                      >
                        {setResultsPublication.isPending
                          ? 'Updating…'
                          : selectedExam.resultsPublishedAt
                            ? 'Unpublish results'
                            : 'Publish results'}
                      </Button>
                    </div>
                  )}
                  {examSchedules.isLoading ? (
                    <LoadingState message="Loading schedules..." />
                  ) : schedules.length === 0 ? (
                    <EmptyState
                      title="No schedules yet"
                      description="Add a class, section, and subject schedule."
                    />
                  ) : (
                    <ul className="examinations-record-list">
                      {schedules.map((schedule) => (
                        <li key={schedule.id}>
                          <div>
                            <strong>
                              {subjects.find(
                                (subject) => subject.id === schedule.subjectId,
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
                              {schedule.totalMarks} marks · pass{' '}
                              {schedule.passingMarks}
                            </span>
                          </div>
                          {canWrite && (
                            <div className="examinations-actions">
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
          </div>
        </section>
      )}

      {tab === 'Marks entry sheet' && (
        <section className="examinations-panel">
          <div className="examinations-filter-toolbar">
            <div className="examinations-filters">
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
                {subjects.map((item: AcademicSubject) => (
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
            <div className="examinations-card">
              <div className="examinations-panel-heading">
                <div>
                  <h2>Marks entry</h2>
                  <p>
                    Enter values out of {selectedSchedule.totalMarks}. Mark
                    absent students separately.
                  </p>
                </div>
                {canWrite && (
                  <Button
                    type="button"
                    onClick={() => void submitMarkSheet()}
                    disabled={
                      saveMarks.isPending ||
                      markSheet.data.items.some(
                        (student) =>
                          !marksByStudent[student.id]?.absent &&
                          marksByStudent[student.id]?.marks === '',
                      )
                    }
                  >
                    {saveMarks.isPending ? 'Saving marks…' : 'Bulk save marks'}
                  </Button>
                )}
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
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{studentName(student)}</strong>
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
                          value={current.marks}
                          disabled={!canWrite || current.absent}
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
                      </label>
                      <label className="examinations-absent">
                        <input
                          type="checkbox"
                          checked={current.absent}
                          disabled={!canWrite}
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
                          disabled={!canWrite}
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
                        Report
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
          <div className="examinations-filter-toolbar">
            <div className="examinations-report-select">
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
              The student list follows the class, section, and subject selected
              on the Marks entry sheet.
            </p>
          </div>
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
            <article className="examinations-card report-card">
              <header>
                <div>
                  <p className="eyebrow">
                    {report.data.report.exam.type} assessment
                  </p>
                  <h2>{report.data.report.exam.name}</h2>
                  <p>
                    {report.data.report.exam.startDate} to{' '}
                    {report.data.report.exam.endDate}
                  </p>
                </div>
                <div className="examinations-report-badges">
                  <span className="examinations-summary-badge">
                    {report.data.report.percentage === null
                      ? 'No marks'
                      : `${report.data.report.percentage}% overall`}
                  </span>
                  <span className="examinations-grade-pill">
                    {report.data.report.overallGrade ?? 'No grade'}
                  </span>
                </div>
              </header>
              <div className="report-summary">
                <div>
                  <span>Total obtained</span>
                  <strong>
                    {report.data.report.totalMarksObtained} /{' '}
                    {report.data.report.totalMarksPossible}
                  </strong>
                </div>
                <div>
                  <span>Grading scale</span>
                  <strong>
                    {scales.find((item) => item.isActive)?.name ??
                      'Not configured'}
                  </strong>
                </div>
              </div>
              <h3>Subject breakdown</h3>
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
                        <th scope="col">Marks obtained</th>
                        <th scope="col">Total marks</th>
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
                          <td data-label="Marks obtained">
                            {result.mark?.isAbsent
                              ? 'Absent'
                              : (result.mark?.marksObtained ?? '—')}
                          </td>
                          <td data-label="Total marks">
                            {result.schedule.totalMarks}
                          </td>
                          <td data-label="Grade">
                            {result.mark?.isAbsent
                              ? '—'
                              : (result.mark?.grade ?? '—')}
                          </td>
                          <td data-label="Remarks">
                            {result.mark?.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}
        </section>
      )}
    </main>
  );
}
