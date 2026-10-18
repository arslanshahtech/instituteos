import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Pagination } from '../components/ui/Pagination.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getCampuses } from '../organizations/organizations-api.js';
import type { Campus } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { OrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { StudentForm } from './StudentForm.js';
import { StudentGuardiansSection } from '../guardians/GuardianPages.js';
import { ChildPickupPanel } from './ChildPickupPanel.js';
import type { StudentInput, StudentStatus } from './students-api.js';
import {
  useCreateStudent,
  useStudent,
  useStudents,
  useUpdateStudent,
} from './student-queries.js';

const PAGE_SIZE = 20;

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The request could not be completed. Try again.';
}

function useOrganizationAccess(organizationId: string) {
  return useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
}

function useCampusChoices(
  organizationId: string,
  access?: OrganizationAccessContext,
) {
  return useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(access?.permissions.includes('campus.read')),
    retry: false,
  });
}

function AccessState({
  loading,
  error,
  access,
  requiredPermission,
  children,
  onRetry,
}: {
  loading: boolean;
  error: Error | null;
  access?: OrganizationAccessContext;
  requiredPermission: string;
  children: ReactNode;
  onRetry: () => void;
}) {
  if (loading) return <LoadingState message="Checking student access…" />;
  if (error || !access)
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          error
            ? apiMessage(error)
            : 'Student access could not be verified for this organization.'
        }
        onRetry={onRetry}
      />
    );
  if (!access.permissions.includes(requiredPermission))
    return <PermissionDeniedState />;
  return children;
}

function StudentPageHeading({
  title,
  description,
  organizationId,
  action,
}: {
  title: string;
  description: string;
  organizationId: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-heading student-page-heading">
      <div>
        <p className="eyebrow">Organization workspace</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="student-page-actions">
        <Link
          className="button button-secondary"
          to={`/admin/organizations/${encodeURIComponent(organizationId)}/students`}
        >
          Student list
        </Link>
        {action}
      </div>
    </section>
  );
}

function StudentCampusName({
  campusId,
  campuses,
}: {
  campusId?: string;
  campuses: Campus[];
}) {
  if (!campusId) return <>—</>;
  return (
    <>
      {campuses.find((campus) => campus.id === campusId)?.name ??
        'Assigned campus'}
    </>
  );
}

export function StudentsListPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StudentStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const students = useStudents(
    organizationId,
    { search, status: status || undefined, page, pageSize: PAGE_SIZE },
    Boolean(access.data?.permissions.includes('student.read')),
  );
  const canCreate =
    access.data?.permissions.includes('student.create') ?? false;

  return (
    <AccessState
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="student.read"
    >
      <main className="page-stack student-management-page reference-live-module">
        <StudentPageHeading
          action={
            <>
              {canCreate && (
                <Link
                  className="button button-primary"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/new`}
                >
                  Add student
                </Link>
              )}
            </>
          }
          description="Search and manage students in this organization."
          organizationId={organizationId}
          title="Students"
        />

        <section className="student-list-panel panel">
          <div className="student-filters">
            <label className="student-search-field">
              <span>Search students</span>
              <input
                autoComplete="off"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name, email, or phone"
                type="search"
                value={searchInput}
              />
            </label>
            <label className="student-status-filter">
              <span>Status</span>
              <select
                onChange={(event) => {
                  setStatus(event.target.value as StudentStatus | '');
                  setPage(1);
                }}
                value={status}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          </div>
          {students.isPending ? (
            <LoadingState message="Loading students…" />
          ) : students.isError ? (
            <ErrorState
              title="Students unavailable"
              description={apiMessage(students.error)}
              onRetry={() => void students.refetch()}
            />
          ) : (
            <>
              {students.data.items.length === 0 ? (
                <DataTable
                  caption="Students"
                  columns={[
                    {
                      header: 'Student',
                      render: (student) => (
                        <Link
                          className="student-name-link"
                          to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`}
                        >
                          {student.firstName} {student.lastName}
                        </Link>
                      ),
                    },
                  ]}
                  emptyDescription={
                    search || status
                      ? 'Try changing or clearing your search and filters.'
                      : 'Create the first student record for this organization.'
                  }
                  emptyTitle={
                    search || status
                      ? 'No students match these filters'
                      : 'No students yet'
                  }
                  rowKey={(student) => student.id}
                  rows={students.data.items}
                />
              ) : (
                <div className="reference-student-grid student-live-grid">
                  {students.data.items.map((student) => {
                    const initials =
                      (
                        student.firstName.trim().charAt(0) || 'S'
                      ).toUpperCase() +
                      (student.lastName.trim().charAt(0) || '').toUpperCase();
                    return (
                      <Link
                        aria-label={`${student.firstName} ${student.lastName}`}
                        className="reference-student-card student-live-card"
                        key={student.id}
                        to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`}
                      >
                        <span className="reference-student-card-top">
                          <span
                            className="reference-student-avatar"
                            aria-hidden="true"
                          >
                            {initials}
                          </span>
                          <span
                            className={`reference-status ${student.status === 'active' ? 'reference-status-approved' : 'reference-status-pending'}`}
                          >
                            {student.status}
                          </span>
                        </span>
                        <strong>
                          {student.firstName} {student.lastName}
                        </strong>
                        <small>
                          <StudentCampusName
                            campusId={student.campusId}
                            campuses={campuses.data?.campuses ?? []}
                          />
                        </small>
                        <span className="reference-student-card-bottom">
                          <span>
                            {student.guardianIds.length} linked guardian
                            {student.guardianIds.length === 1 ? '' : 's'}
                          </span>
                          <span>{student.phone || 'Phone not provided'}</span>
                          <b>{student.contactEmail || 'Email not provided'}</b>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <Pagination
                currentPage={students.data.page}
                onPageChange={setPage}
                pageSize={students.data.pageSize}
                totalItems={students.data.total}
              />
            </>
          )}
        </section>
      </main>
    </AccessState>
  );
}

export function StudentCreatePage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const mutation = useCreateStudent(organizationId);
  const { showToast } = useToast();

  const submit = (input: StudentInput) => {
    mutation.mutate(input, {
      onSuccess: ({ student }) => {
        showToast('Student created successfully.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`,
        );
      },
    });
  };

  return (
    <AccessState
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="student.create"
    >
      <main className="page-stack student-management-page reference-live-module">
        <StudentPageHeading
          description="Add a student record to this organization."
          organizationId={organizationId}
          title="Add student"
        />
        <section className="student-form-panel panel">
          <StudentForm
            campusError={
              campuses.isError ? apiMessage(campuses.error) : undefined
            }
            campuses={campuses.data?.campuses ?? []}
            canAssignCampus={
              access.data?.permissions.includes('campus.read') ?? false
            }
            campusRequired={access.data?.role === 'campus_admin'}
            isSaving={mutation.isPending}
            onSubmit={submit}
            saveError={
              mutation.isError ? apiMessage(mutation.error) : undefined
            }
          />
        </section>
      </main>
    </AccessState>
  );
}

export function StudentDetailPage() {
  const { organizationId = '', studentId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const student = useStudent(
    organizationId,
    studentId,
    Boolean(access.data?.permissions.includes('student.read')),
  );
  const campuses = useCampusChoices(organizationId, access.data);

  if (access.isPending)
    return <LoadingState message="Checking student access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="Student access could not be verified for this organization."
        onRetry={() => void access.refetch()}
      />
    );
  if (!access.data.permissions.includes('student.read'))
    return <PermissionDeniedState />;
  if (student.isPending) return <LoadingState message="Loading student…" />;
  if (student.isError)
    return (
      <ErrorState
        title="Student unavailable"
        description={apiMessage(student.error)}
        onRetry={() => void student.refetch()}
      />
    );

  const record = student.data.student;
  const canUpdate = access.data.permissions.includes('student.update');

  return (
    <main className="page-stack student-management-page reference-live-module">
      <StudentPageHeading
        action={
          <>
            {access.data.permissions.includes('guardian.read') && (
              <Link
                className="button button-secondary"
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/guardians`}
              >
                Guardian directory
              </Link>
            )}
            {canUpdate && (
              <Link
                className="button button-primary"
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}/edit`}
              >
                Edit student
              </Link>
            )}
          </>
        }
        description="Student record and contact information."
        organizationId={organizationId}
        title={`${record.firstName} ${record.lastName}`}
      />
      <section className="student-detail-panel panel">
        <div className="student-detail-heading">
          <h2>Student details</h2>
          <span
            className={`status-badge ${record.status === 'active' ? 'status-positive' : 'status-negative'}`}
          >
            {record.status}
          </span>
        </div>
        <dl className="student-details">
          <div>
            <dt>Preferred name</dt>
            <dd>{record.preferredName || '—'}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>
              {record.dateOfBirth ? record.dateOfBirth.slice(0, 10) : '—'}
            </dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{record.gender || '—'}</dd>
          </div>
          <div>
            <dt>Contact email</dt>
            <dd>{record.contactEmail || '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{record.phone || '—'}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>
              <StudentCampusName
                campusId={record.campusId}
                campuses={campuses.data?.campuses ?? []}
              />
            </dd>
          </div>
          {record.address && (
            <div>
              <dt>Address</dt>
              <dd>
                {[
                  record.address.line1,
                  record.address.line2,
                  record.address.city,
                  record.address.region,
                  record.address.postalCode,
                  record.address.country,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </dd>
            </div>
          )}
          {record.emergencyContact && (
            <div>
              <dt>Emergency contact</dt>
              <dd>
                {[
                  record.emergencyContact.name,
                  record.emergencyContact.relationship,
                  record.emergencyContact.phone,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {access.data.permissions.includes('guardian.read') && (
        <StudentGuardiansSection
          canRead
          canUpdate={
            canUpdate && access.data.permissions.includes('guardian.update')
          }
          organizationId={organizationId}
          studentId={studentId}
        />
      )}

      {/* Phase C: Child Pickup & Gate-Pass Protocol UI */}
      <ChildPickupPanel
        organizationId={organizationId}
        studentId={studentId}
        userRole={access.data.role}
      />
    </main>
  );
}

export function StudentEditPage() {
  const { organizationId = '', studentId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const student = useStudent(
    organizationId,
    studentId,
    Boolean(access.data?.permissions.includes('student.update')),
  );
  const campuses = useCampusChoices(organizationId, access.data);
  const mutation = useUpdateStudent(organizationId, studentId);
  const { showToast } = useToast();

  const submit = (input: StudentInput) => {
    mutation.mutate(input, {
      onSuccess: () => {
        showToast('Student changes saved.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}`,
        );
      },
    });
  };

  return (
    <AccessState
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="student.update"
    >
      {student.isPending ? (
        <LoadingState message="Loading student…" />
      ) : student.isError ? (
        <ErrorState
          title="Student unavailable"
          description={apiMessage(student.error)}
          onRetry={() => void student.refetch()}
        />
      ) : (
        <main className="page-stack student-management-page reference-live-module">
          <StudentPageHeading
            description="Update the student's record."
            organizationId={organizationId}
            title="Edit student"
          />
          <section className="student-form-panel panel">
            <StudentForm
              campusError={
                campuses.isError ? apiMessage(campuses.error) : undefined
              }
              campuses={campuses.data?.campuses ?? []}
              canAssignCampus={
                access.data?.permissions.includes('campus.read') ?? false
              }
              campusRequired={access.data?.role === 'campus_admin'}
              isSaving={mutation.isPending}
              onSubmit={submit}
              saveError={
                mutation.isError ? apiMessage(mutation.error) : undefined
              }
              student={student.data.student}
            />
          </section>
        </main>
      )}
    </AccessState>
  );
}
