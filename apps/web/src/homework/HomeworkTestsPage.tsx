import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  BookOpenText,
  CalendarCheck,
  ClipboardCheck,
  Plus,
  Trash2,
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
  updateHomeworkTestStatus,
} from './homework-api.js';
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
  const role = access.data?.role ?? '';
  const canRead =
    access.data?.permissions.includes('examination.read') ?? false;
  const canWrite =
    access.data?.permissions.includes('examination.write') ?? false;
  const isTeacher = role === 'teacher';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<HomeworkTestType>('homework');
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(localDate);
  const [totalMarks, setTotalMarks] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [yearId, setYearId] = useState('');
  const [formError, setFormError] = useState('');
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

  const createMutation = useMutation({
    mutationFn: (input: HomeworkTestInput) =>
      createHomeworkTest(organizationId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['homework-tests', organizationId],
      });
      setFormOpen(false);
      setTitle('');
      setInstructions('');
      setTotalMarks('');
      setFormError('');
    },
    onError: (error: unknown) => setFormError(apiMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HomeworkTestStatus }) =>
      updateHomeworkTestStatus(organizationId, id, status),
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

  if (access.isPending)
    return (
      <LoadingState message="Checking homework and assessment permissions..." />
    );
  if (!access.data || access.isError)
    return (
      <ErrorState
        title="Homework & tests unavailable"
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
  if (!canRead || (!isTeacher && !allowedManager))
    return <PermissionDeniedState />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
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
      tab === 'test' &&
      totalMarks.trim() &&
      (!Number.isFinite(Number(totalMarks)) || Number(totalMarks) < 0)
    ) {
      setFormError('Enter valid non-negative total marks.');
      return;
    }
    createMutation.mutate({
      campusId: selectedClass.campusId,
      academicYearId: yearId,
      classId,
      sectionId,
      subjectId,
      title: title.trim(),
      instructions: instructions.trim(),
      type: tab,
      dueDate,
      ...(tab === 'test' && totalMarks.trim()
        ? { totalMarks: Number(totalMarks) }
        : {}),
    });
  };
  const pageRecords = records.filter((item) => item.type === tab);

  return (
    <main className="page-stack homework-tests-page reference-live-module">
      <WorkspacePageHeading
        eyebrow="Academic workspace"
        title="Homework & tests"
        description="Create, publish and review class homework and tests. Teachers can only manage items for their assigned class sections and subjects."
        aside={
          canWrite && (
            <Button onClick={() => setFormOpen((open) => !open)}>
              <Plus size={15} />{' '}
              {formOpen
                ? 'Close form'
                : tab === 'homework'
                  ? 'Add homework'
                  : 'Add test'}
            </Button>
          )
        }
      />

      <nav className="homework-tabs" aria-label="Homework and test types">
        <button
          type="button"
          aria-pressed={tab === 'homework'}
          className={tab === 'homework' ? 'is-active' : ''}
          onClick={() => {
            setTab('homework');
            setFormOpen(false);
            setFormError('');
          }}
        >
          <BookOpenText size={16} /> Homework
        </button>
        <button
          type="button"
          aria-pressed={tab === 'test'}
          className={tab === 'test' ? 'is-active' : ''}
          onClick={() => {
            setTab('test');
            setFormOpen(false);
            setFormError('');
          }}
        >
          <ClipboardCheck size={16} /> Tests
        </button>
      </nav>

      {formOpen && canWrite && (
        <section className="panel homework-form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {tab === 'homework' ? 'Create homework' : 'Schedule a test'}
              </h2>
              <p>
                Saved to the selected college with server-side class and teacher
                scope checks.
              </p>
            </div>
          </div>
          <form className="homework-form-grid" onSubmit={submit}>
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
              Due date
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            {tab === 'test' && (
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? 'Saving…'
                  : tab === 'homework'
                    ? 'Save homework'
                    : 'Save test'}
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="panel homework-records-panel">
        <div className="panel-heading">
          <div>
            <h2>{tab === 'homework' ? 'Homework list' : 'Tests list'}</h2>
            <p>
              {pageRecords.length}{' '}
              {pageRecords.length === 1 ? 'record' : 'records'}{' '}
              {tab === 'homework' ? 'in this college' : 'scheduled'}
            </p>
          </div>
        </div>
        {itemsQuery.isPending ? (
          <LoadingState message="Loading homework and tests..." />
        ) : itemsQuery.isError ? (
          <ErrorState
            title="Records could not be loaded"
            description={apiMessage(itemsQuery.error)}
            onRetry={() => void itemsQuery.refetch()}
          />
        ) : pageRecords.length === 0 ? (
          <EmptyState
            title={tab === 'homework' ? 'No homework yet' : 'No tests yet'}
            description={
              canWrite
                ? 'Use the add action to create the first record.'
                : 'Published work for your assigned classes will appear here.'
            }
          />
        ) : (
          <div className="homework-record-grid">
            {pageRecords.map((item: HomeworkTestRecord) => (
              <article className="homework-record-card" key={item.id}>
                <div className="homework-record-top">
                  <span className="homework-record-icon">
                    {tab === 'homework' ? (
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
                <p>
                  {item.instructions || 'No additional instructions provided.'}
                </p>
                <div className="homework-record-meta">
                  <span>
                    {item.className} · {item.sectionName}
                  </span>
                  <span>
                    {item.subjectName} · {item.academicYearName}
                  </span>
                  <span>
                    <CalendarCheck size={13} /> Due {item.dueDate}
                  </span>
                  {item.type === 'test' && item.totalMarks !== undefined && (
                    <span>Total marks: {item.totalMarks}</span>
                  )}
                </div>
                {canWrite && (
                  <div className="homework-record-actions">
                    {item.status !== 'published' && (
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
                    {item.status === 'published' && (
                      <Button
                        variant="secondary"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            id: item.id,
                            status: 'archived',
                          })
                        }
                      >
                        Archive
                      </Button>
                    )}
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
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {(statusMutation.isError || deleteMutation.isError) && (
          <p className="homework-form-error" role="alert">
            {apiMessage(statusMutation.error ?? deleteMutation.error)}
          </p>
        )}
      </section>
    </main>
  );
}
