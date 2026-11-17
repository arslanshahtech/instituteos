import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import {
  ArrowLeft,
  BookOpenText,
  CalendarCheck,
  ClipboardCheck,
  Plus,
  Trash2,
  Pencil,
  Search,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import {
  createHomeworkTest,
  deleteHomeworkTest,
  listHomeworkTests,
  updateHomeworkTest,
} from './homework-api.js';
import './daily-diary.css';
import type {
  HomeworkTestInput,
  HomeworkTestRecord,
  HomeworkTestStatus,
  HomeworkTestType,
} from './homework-api.js';

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function HomeworkTestsPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const { user } = useAuth();
  const role = access.data?.role ?? '';
  const canRead =
    access.data?.permissions.includes('examination.read') ?? false;
  const canWrite =
    access.data?.permissions.includes('examination.write') ?? false;
  const isTeacher = role === 'teacher';
  const queryClient = useQueryClient();
  const [teacherEntryType, setTeacherEntryType] =
    useState<HomeworkTestType>('homework');
  const tab: HomeworkTestType = isTeacher ? teacherEntryType : 'test';
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HomeworkTestRecord | null>(
    null,
  );
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(localDate);
  const [totalMarks, setTotalMarks] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [yearId, setYearId] = useState('');
  const [formError, setFormError] = useState('');
  const [diarySearch, setDiarySearch] = useState('');
  const [diaryClassFilter, setDiaryClassFilter] = useState('all');
  const [diarySubjectFilter, setDiarySubjectFilter] = useState('all');
  const [diaryStatusFilter, setDiaryStatusFilter] = useState<
    'all' | HomeworkTestStatus
  >('all');
  const [diaryTypeFilter, setDiaryTypeFilter] = useState<
    'all' | 'homework' | 'class_test'
  >('all');
  const [diaryDateFilter, setDiaryDateFilter] = useState('');
  const academics = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const itemsQuery = useQuery({
    queryKey: ['homework-tests', organizationId],
    queryFn: () => listHomeworkTests(organizationId),
    enabled: Boolean(organizationId && access.data && canRead),
    retry: false,
  });
  const records = itemsQuery.data?.items ?? [];
  const assignments = academics.assignments.data?.items ?? [];
  const classes = academics.classes.data?.items ?? [];
  const sections = academics.sections.data?.items ?? [];
  const subjects = academics.subjects.data?.items ?? [];
  const years = (academics.years.data?.items ?? []).filter(
    (year) => year.status === 'active',
  );
  const assignedClassIds = useMemo(
    () =>
      isTeacher ? new Set(assignments.map((item) => item.classId)) : undefined,
    [assignments, isTeacher],
  );
  const availableClasses = classes.filter(
    (item) => !assignedClassIds || assignedClassIds.has(item.id),
  );
  const availableSections = sections.filter(
    (item) =>
      item.classId === classId &&
      (!isTeacher ||
        assignments.some(
          (assignment) =>
            assignment.classId === item.classId &&
            assignment.sectionId === item.id &&
            (!yearId || assignment.academicYearId === yearId),
        )),
  );
  const availableSubjects = subjects.filter(
    (item) =>
      !isTeacher ||
      assignments.some(
        (assignment) =>
          assignment.subjectId === item.id &&
          assignment.classId === classId &&
          assignment.sectionId === sectionId &&
          (!yearId || assignment.academicYearId === yearId),
      ),
  );
  const availableYears = years.filter(
    (year) =>
      !isTeacher ||
      assignments.some(
        (assignment) =>
          assignment.academicYearId === year.id &&
          assignment.classId === classId &&
          assignment.sectionId === sectionId &&
          assignment.subjectId === subjectId,
      ),
  );
  const selectedClass = classes.find((item) => item.id === classId);
  const selectedAssignment = assignments.find(
    (item) =>
      item.classId === classId &&
      item.sectionId === sectionId &&
      item.subjectId === subjectId &&
      item.academicYearId === yearId,
  );

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: HomeworkTestInput }) =>
      id
        ? updateHomeworkTest(organizationId, id, input)
        : createHomeworkTest(organizationId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['homework-tests', organizationId],
      });
      setFormOpen(false);
      setEditingItem(null);
      setTitle('');
      setInstructions('');
      setTotalMarks('');
      setFormError('');
    },
    onError: (error: unknown) => setFormError(apiMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HomeworkTestStatus }) =>
      updateHomeworkTest(organizationId, id, { status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['homework-tests', organizationId],
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHomeworkTest(organizationId, id),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['homework-tests', organizationId],
      }),
  });

  const pageRecords = useMemo(
    () =>
      records.filter((item) =>
        isTeacher
          ? item.type === 'homework' || item.type === 'class_test'
          : item.type === 'test',
      ),
    [records, isTeacher],
  );
  const filteredDiaryRecords = useMemo(() => {
    const query = diarySearch.trim().toLocaleLowerCase();
    return pageRecords.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.title,
          item.instructions,
          item.className,
          item.sectionName,
          item.subjectName,
        ].some((value) => value.toLocaleLowerCase().includes(query));
      return (
        matchesSearch &&
        (diaryClassFilter === 'all' || item.classId === diaryClassFilter) &&
        (diarySubjectFilter === 'all' ||
          item.subjectId === diarySubjectFilter) &&
        (diaryStatusFilter === 'all' || item.status === diaryStatusFilter) &&
        (diaryTypeFilter === 'all' || item.type === diaryTypeFilter) &&
        (!diaryDateFilter || item.dueDate.slice(0, 10) === diaryDateFilter)
      );
    });
  }, [
    pageRecords,
    diarySearch,
    diaryClassFilter,
    diarySubjectFilter,
    diaryStatusFilter,
    diaryTypeFilter,
    diaryDateFilter,
  ]);
  const diaryStats = useMemo(
    () => ({
      total: pageRecords.length,
      published: pageRecords.filter((item) => item.status === 'published')
        .length,
      drafts: pageRecords.filter((item) => item.status === 'draft').length,
      classTests: pageRecords.filter((item) => item.type === 'class_test')
        .length,
    }),
    [pageRecords],
  );

  useEffect(() => {
    if (!formOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saveMutation.isPending) {
        setFormOpen(false);
        setEditingItem(null);
        setFormError('');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [formOpen, saveMutation.isPending]);

  useEffect(() => {
    if (!formOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen]);

  if (access.isPending)
    return <LoadingState message="Checking module permissions..." />;
  if (!access.data || access.isError)
    return (
      <ErrorState
        title={isTeacher ? 'Daily Diary unavailable' : 'Tests unavailable'}
        description={apiMessage(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  const allowedManager = [
    'organization_owner',
    'organization_admin',
    'campus_admin',
    'principal_director',
    'academic_coordinator',
  ].includes(role);
  const canCreate = canWrite && (isTeacher || allowedManager);
  const canModerate = allowedManager && canWrite;
  if (!canRead || (!isTeacher && !allowedManager))
    return <PermissionDeniedState />;

  const saveWithStatus = (
    event: FormEvent<HTMLFormElement>,
    status: HomeworkTestStatus,
  ) => {
    event.preventDefault();
    setFormError('');
    if (
      !title.trim() ||
      !classId ||
      !sectionId ||
      !subjectId ||
      !yearId ||
      !dueDate ||
      !selectedClass?.campusId
    ) {
      setFormError(
        'Complete the title, class, section, subject, academic year and due date.',
      );
      return;
    }
    if (isTeacher && !selectedAssignment) {
      setFormError(
        'Choose a class, section, subject and year assigned to your teacher account.',
      );
      return;
    }
    if (
      tab !== 'homework' &&
      totalMarks.trim() &&
      (!Number.isFinite(Number(totalMarks)) || Number(totalMarks) < 0)
    ) {
      setFormError('Enter valid non-negative total marks.');
      return;
    }
    saveMutation.mutate({
      id: editingItem?.id,
      input: {
        campusId: selectedClass.campusId,
        academicYearId: yearId,
        classId,
        sectionId,
        subjectId,
        title: title.trim(),
        instructions: instructions.trim(),
        type: tab,
        dueDate,
        ...(tab !== 'homework' && totalMarks.trim()
          ? { totalMarks: Number(totalMarks) }
          : {}),
        status,
      },
    });
  };
  const closeForm = () => {
    if (saveMutation.isPending) return;
    setFormOpen(false);
    setEditingItem(null);
    setFormError('');
  };

  const beginEdit = (item: HomeworkTestRecord) => {
    setEditingItem(item);
    setTitle(item.title);
    setTeacherEntryType(item.type);
    setInstructions(item.instructions);
    setDueDate(item.dueDate);
    setTotalMarks(item.totalMarks === undefined ? '' : String(item.totalMarks));
    setClassId(item.classId);
    setSectionId(item.sectionId);
    setSubjectId(item.subjectId);
    setYearId(item.academicYearId);
    setFormError('');
    setFormOpen(true);
  };

  return (
    <main
      className={`page-stack homework-tests-page reference-live-module${isTeacher ? ' daily-diary-page' : ''}`}
    >
      <WorkspacePageHeading
        className="homework-page-heading"
        eyebrow=""
        title={isTeacher ? 'Daily Diary' : 'Tests'}
        description={
          isTeacher
            ? 'Record homework, classwork and quick class tests for your assigned students.'
            : 'Create class tests and manage marks.'
        }
        aside={
          canCreate && (
            <Button
              onClick={() => {
                setEditingItem(null);
                setTeacherEntryType('homework');
                setTitle('');
                setInstructions('');
                setDueDate(localDate());
                setTotalMarks('');
                setClassId('');
                setSectionId('');
                setSubjectId('');
                setYearId('');
                setFormError('');
                setFormOpen(true);
              }}
            >
              <Plus size={15} />{' '}
              {formOpen
                ? 'Close form'
                : isTeacher
                  ? 'Add diary entry'
                  : 'Add test'}
            </Button>
          )
        }
      />

      {isTeacher && (
        <>
          <section className="daily-diary-stats" aria-label="Diary overview">
            <article className="daily-diary-stat">
              <span>Total entries</span>
              <strong>{diaryStats.total}</strong>
              <small>Across your assigned classes</small>
            </article>
            <article className="daily-diary-stat">
              <span>Published</span>
              <strong>{diaryStats.published}</strong>
              <small>Visible to learners</small>
            </article>
            <article className="daily-diary-stat">
              <span>Drafts</span>
              <strong>{diaryStats.drafts}</strong>
              <small>Not yet published</small>
            </article>
            <article className="daily-diary-stat">
              <span>Class tests</span>
              <strong>{diaryStats.classTests}</strong>
              <small>Quick assessments</small>
            </article>
          </section>
          <section
            className="daily-diary-filters"
            aria-label="Filter diary entries"
          >
            <label className="daily-diary-date-filter">
              <span>Date</span>
              <input
                type="date"
                value={diaryDateFilter}
                onChange={(event) => setDiaryDateFilter(event.target.value)}
              />
            </label>
            <div className="daily-diary-search">
              <span>Search</span>
              <div className="daily-diary-search-control">
                <input
                  value={diarySearch}
                  onChange={(event) => setDiarySearch(event.target.value)}
                  placeholder="Search diary entries"
                  aria-label="Search diary entries"
                />
                {diarySearch && (
                  <button
                    type="button"
                    onClick={() => setDiarySearch('')}
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
                <Search
                  className="daily-diary-search-icon"
                  size={17}
                  aria-hidden="true"
                />
              </div>
            </div>
            <label>
              <span>Class</span>
              <select
                value={diaryClassFilter}
                onChange={(event) => setDiaryClassFilter(event.target.value)}
              >
                <option value="all">All classes</option>
                {classes
                  .filter((item) =>
                    assignments.some(
                      (assignment) => assignment.classId === item.id,
                    ),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Subject</span>
              <select
                value={diarySubjectFilter}
                onChange={(event) => setDiarySubjectFilter(event.target.value)}
              >
                <option value="all">All subjects</option>
                {subjects
                  .filter((item) =>
                    assignments.some(
                      (assignment) => assignment.subjectId === item.id,
                    ),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Entry type</span>
              <select
                value={diaryTypeFilter}
                onChange={(event) =>
                  setDiaryTypeFilter(
                    event.target.value as typeof diaryTypeFilter,
                  )
                }
              >
                <option value="all">All types</option>
                <option value="homework">Homework / Classwork</option>
                <option value="class_test">Class test</option>
              </select>
            </label>
            <label>
              <span>Publication</span>
              <select
                value={diaryStatusFilter}
                onChange={(event) =>
                  setDiaryStatusFilter(
                    event.target.value as typeof diaryStatusFilter,
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <button
              className="daily-diary-clear"
              type="button"
              onClick={() => {
                setDiarySearch('');
                setDiaryClassFilter('all');
                setDiarySubjectFilter('all');
                setDiaryTypeFilter('all');
                setDiaryStatusFilter('all');
                setDiaryDateFilter('');
              }}
            >
              Clear filters
            </button>
          </section>
        </>
      )}

      {formOpen && canCreate && (
        <div
          className="daily-diary-form-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="panel homework-form-panel daily-diary-form-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-diary-form-title"
          >
            <header className="daily-diary-form-header">
              <button
                className="daily-diary-back-button"
                type="button"
                onClick={closeForm}
                disabled={saveMutation.isPending}
              >
                <ArrowLeft size={17} />
                <span>Back to diary</span>
              </button>
              <div className="daily-diary-form-heading">
                <h2 id="daily-diary-form-title">
                  {editingItem
                    ? isTeacher
                      ? 'Edit diary entry'
                      : 'Edit test'
                    : tab === 'homework'
                      ? 'Create diary entry'
                      : isTeacher
                        ? 'Add class test'
                        : 'Schedule a test'}
                </h2>
                <p>
                  {isTeacher
                    ? 'Add the class details and instructions for your students.'
                    : 'Set the class, subject, test date and marks.'}
                </p>
              </div>
              <button
                className="daily-diary-close-button"
                type="button"
                onClick={closeForm}
                disabled={saveMutation.isPending}
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </header>
            <form
              className="homework-form-grid"
              onSubmit={(event) => saveWithStatus(event, 'draft')}
            >
              {isTeacher && (
                <label>
                  Entry type
                  <select
                    value={tab}
                    onChange={(event) =>
                      setTeacherEntryType(
                        event.target.value as HomeworkTestType,
                      )
                    }
                  >
                    <option value="homework">Homework / Classwork</option>
                    <option value="class_test">Class test</option>
                  </select>
                </label>
              )}
              <label className="homework-wide">
                Title
                <input
                  maxLength={160}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    tab === 'homework'
                      ? 'e.g. Chapter 4 exercises'
                      : tab === 'class_test'
                        ? 'e.g. Mathematics class test'
                        : 'e.g. Mathematics weekly test'
                  }
                />
              </label>
              <label>
                Class
                <select
                  required
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId('');
                    setSubjectId('');
                    setYearId('');
                  }}
                >
                  <option value="">Select class</option>
                  {availableClasses.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  required
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    setSubjectId('');
                    setYearId('');
                  }}
                >
                  <option value="">Select section</option>
                  {availableSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <select
                  required
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setYearId('');
                  }}
                >
                  <option value="">Select subject</option>
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Academic year
                <select
                  required
                  value={yearId}
                  onChange={(e) => setYearId(e.target.value)}
                >
                  <option value="">Select active year</option>
                  {availableYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tab === 'class_test' ? 'Test date' : 'Due date'}
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              {tab !== 'homework' && (
                <label>
                  Total marks
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    step="0.5"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                  />
                </label>
              )}
              <label className="homework-wide">
                Instructions
                <textarea
                  maxLength={5000}
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instructions for students"
                />
              </label>
              {formError && (
                <p className="homework-form-error homework-wide" role="alert">
                  {formError}
                </p>
              )}
              <div className="homework-form-actions homework-wide">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save as draft'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saveMutation.isPending}
                  onClick={() =>
                    saveWithStatus(
                      { preventDefault() {} } as FormEvent<HTMLFormElement>,
                      'published',
                    )
                  }
                >
                  {editingItem ? 'Save & publish' : 'Publish'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="panel homework-records-panel">
        <div className="panel-heading">
          <div>
            <h2>{isTeacher ? 'Diary entries' : 'Tests list'}</h2>
            <p>
              {isTeacher
                ? `${filteredDiaryRecords.length} of ${pageRecords.length} diary entries`
                : `${pageRecords.length} ${pageRecords.length === 1 ? 'record' : 'records'} scheduled`}
            </p>
          </div>
        </div>
        {itemsQuery.isPending ? (
          <LoadingState
            message={isTeacher ? 'Loading daily diary...' : 'Loading tests...'}
          />
        ) : itemsQuery.isError ? (
          <ErrorState
            title="Records could not be loaded"
            description={apiMessage(itemsQuery.error)}
            onRetry={() => void itemsQuery.refetch()}
          />
        ) : pageRecords.length === 0 ? (
          <EmptyState
            title={isTeacher ? 'No diary entries yet' : 'No tests yet'}
            description={
              canCreate
                ? isTeacher
                  ? 'Add homework, classwork or a quick class test for your assigned class.'
                  : 'Create the first test for a class and section.'
                : 'Published work for your assigned classes will appear here.'
            }
          />
        ) : isTeacher && filteredDiaryRecords.length === 0 ? (
          <EmptyState
            title="No matching entries"
            description="Try changing your search or filters."
          />
        ) : (
          <div className="homework-record-grid">
            {(isTeacher ? filteredDiaryRecords : pageRecords).map(
              (item: HomeworkTestRecord) => (
                <article className="homework-record-card" key={item.id}>
                  <div className="homework-record-top">
                    <span className="homework-record-icon">
                      {item.type === 'homework' ? (
                        <BookOpenText size={18} />
                      ) : (
                        <ClipboardCheck size={18} />
                      )}
                    </span>
                    <span
                      className={`homework-status homework-status-${item.status}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  {isTeacher && (
                    <span className="homework-record-type">
                      {item.type === 'class_test'
                        ? 'Class test'
                        : 'Homework / Classwork'}
                    </span>
                  )}
                  <p>
                    {item.instructions ||
                      'No additional instructions provided.'}
                  </p>
                  <div className="homework-record-meta">
                    <span>
                      {item.className} · {item.sectionName}
                    </span>
                    <span>
                      {item.subjectName} · {item.academicYearName}
                    </span>
                    <span>
                      {isTeacher ? 'Added by' : 'Created by'}{' '}
                      {item.createdByName ?? 'School administration'}
                    </span>
                    <span>
                      <CalendarCheck size={13} /> Due {item.dueDate}
                    </span>
                    {item.type !== 'homework' &&
                      item.totalMarks !== undefined && (
                        <span>Total marks: {item.totalMarks}</span>
                      )}
                  </div>
                  {(isTeacher || canModerate) && (
                    <div className="homework-record-actions">
                      {(canModerate || item.createdBy === user?.id) && (
                        <Button
                          variant="secondary"
                          disabled={statusMutation.isPending}
                          onClick={() => beginEdit(item)}
                        >
                          <Pencil size={13} /> Edit
                        </Button>
                      )}
                      {(canModerate || item.createdBy === user?.id) &&
                        item.status === 'draft' && (
                          <Button
                            variant="secondary"
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              statusMutation.mutate({
                                id: item.id,
                                status: 'published',
                              })
                            }
                          >
                            Publish
                          </Button>
                        )}
                      {(canModerate || item.createdBy === user?.id) &&
                        item.status === 'published' && (
                          <Button
                            variant="quiet"
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              statusMutation.mutate({
                                id: item.id,
                                status: 'draft',
                              })
                            }
                          >
                            Move to draft
                          </Button>
                        )}
                      {(canModerate || item.createdBy === user?.id) && (
                        <Button
                          variant="quiet"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Delete this homework or test record? This action cannot be undone.',
                              )
                            )
                              deleteMutation.mutate(item.id);
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        )}
        {(statusMutation.isError || deleteMutation.isError) && (
          <p className="homework-form-error" role="alert">
            {apiMessage(
              saveMutation.error ??
                statusMutation.error ??
                deleteMutation.error,
            )}
          </p>
        )}
      </section>
    </main>
  );
}
