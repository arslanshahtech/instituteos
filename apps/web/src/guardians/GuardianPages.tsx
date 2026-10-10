import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Pagination } from '../components/ui/Pagination.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { listStudents } from '../students/students-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { OrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { GuardianForm } from './GuardianForm.js';
import type { GuardianInput } from './guardians-api.js';
import { listGuardians } from './guardians-api.js';
import type { GuardianRelationship } from './guardians-api.js';
import {
  useCreateGuardian,
  useGuardian,
  useGuardians,
  useLinkGuardian,
  useStudentGuardians,
  useUnlinkGuardian,
  useUpdateGuardian,
} from './guardian-queries.js';

const PAGE_SIZE = 20;
const CHOICE_PAGE_SIZE = 20;

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.requestId
      ? `${error.message} (Reference: ${error.requestId})`
      : error.message;
  }
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

function GuardianAccess({
  organizationId,
  permission,
  children,
}: {
  organizationId: string;
  permission: string;
  children: (access: OrganizationAccessContext) => ReactNode;
}) {
  const access = useOrganizationAccess(organizationId);
  if (access.isPending)
    return <LoadingState message="Checking guardian access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Guardian access could not be verified.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  if (!access.data.permissions.includes(permission))
    return <PermissionDeniedState />;
  return children(access.data);
}

function GuardianHeading({
  organizationId,
  title,
  description,
  action,
}: {
  organizationId: string;
  title: string;
  description: string;
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
          to={`/admin/organizations/${encodeURIComponent(organizationId)}/guardians`}
        >
          Guardian directory
        </Link>
        {action}
      </div>
    </section>
  );
}

export function GuardiansListPage() {
  const { organizationId = '' } = useParams();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const access = useOrganizationAccess(organizationId);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const guardians = useGuardians(
    organizationId,
    { search, page, pageSize: PAGE_SIZE },
    Boolean(access.data?.permissions.includes('guardian.read')),
  );
  const canCreate =
    access.data?.permissions.includes('guardian.create') ?? false;

  return (
    <GuardianAccess organizationId={organizationId} permission="guardian.read">
      {() => (
        <main className="page-stack student-management-page">
          <GuardianHeading
            action={
              canCreate ? (
                <Link
                  className="button button-primary"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/guardians/new`}
                >
                  Add guardian
                </Link>
              ) : undefined
            }
            description="Search and manage guardian contact records."
            organizationId={organizationId}
            title="Guardians"
          />
          <section className="student-list-panel panel">
            <label className="student-search-field">
              <span>Search guardians</span>
              <input
                autoComplete="off"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or email"
                type="search"
                value={searchInput}
              />
            </label>
            {guardians.isPending ? (
              <LoadingState message="Loading guardians…" />
            ) : guardians.isError ? (
              <ErrorState
                title="Guardians unavailable"
                description={apiMessage(guardians.error)}
                onRetry={() => void guardians.refetch()}
              />
            ) : (
              <>
                <DataTable
                  caption="Guardians"
                  columns={[
                    {
                      header: 'Guardian',
                      render: (guardian) => (
                        <Link
                          className="student-name-link"
                          to={`/admin/organizations/${encodeURIComponent(organizationId)}/guardians/${encodeURIComponent(guardian.id)}`}
                        >
                          {guardian.firstName} {guardian.lastName}
                        </Link>
                      ),
                    },
                    {
                      header: 'Relationship',
                      render: (guardian) => guardian.relationship || '—',
                    },
                    {
                      header: 'Email',
                      render: (guardian) => guardian.email || '—',
                    },
                    {
                      header: 'Phone',
                      render: (guardian) => guardian.phone || '—',
                    },
                  ]}
                  emptyDescription={
                    search
                      ? 'Try changing or clearing your search.'
                      : 'Create the first guardian record for this organization.'
                  }
                  emptyTitle={
                    search
                      ? 'No guardians match this search'
                      : 'No guardians yet'
                  }
                  rowKey={(guardian) => guardian.id}
                  rows={guardians.data.items}
                />
                <Pagination
                  currentPage={guardians.data.page}
                  onPageChange={setPage}
                  pageSize={guardians.data.pageSize}
                  totalItems={guardians.data.total}
                />
              </>
            )}
          </section>
        </main>
      )}
    </GuardianAccess>
  );
}

export function GuardianCreatePage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const canReadStudents =
    access.data?.permissions.includes('student.read') ?? false;
  const canLinkStudent =
    canReadStudents &&
    (access.data?.permissions.includes('student.update') ?? false);
  const campusAdmin = access.data?.role === 'campus_admin';
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setStudentSearch(studentSearchInput.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [studentSearchInput]);
  const students = useQuery({
    queryKey: ['guardian-student-choices', organizationId, studentSearch],
    queryFn: () =>
      listStudents(organizationId, {
        search: studentSearch,
        page: 1,
        pageSize: CHOICE_PAGE_SIZE,
      }),
    enabled: canLinkStudent,
    retry: false,
  });
  const [studentId, setStudentId] = useState('');
  const mutation = useCreateGuardian(organizationId);
  const { showToast } = useToast();

  const submit = (input: GuardianInput, selectedStudentId?: string) => {
    mutation.mutate(
      { ...input, studentId: selectedStudentId },
      {
        onSuccess: ({ guardian }) => {
          showToast('Guardian created successfully.');
          navigate(
            `/admin/organizations/${encodeURIComponent(organizationId)}/guardians/${encodeURIComponent(guardian.id)}`,
          );
        },
      },
    );
  };

  return (
    <GuardianAccess
      organizationId={organizationId}
      permission="guardian.create"
    >
      {() => (
        <main className="page-stack student-management-page">
          <GuardianHeading
            description="Add a guardian contact record to this organization."
            organizationId={organizationId}
            title="Add guardian"
          />
          <section className="student-form-panel panel">
            <GuardianForm
              canLinkStudent={canLinkStudent}
              isSaving={mutation.isPending}
              onStudentChange={setStudentId}
              onStudentSearchChange={setStudentSearchInput}
              onSubmit={submit}
              requireStudent={campusAdmin}
              saveError={
                mutation.isError ? apiMessage(mutation.error) : undefined
              }
              selectedStudentId={studentId}
              studentSearch={studentSearchInput}
              studentError={
                students.isError ? apiMessage(students.error) : undefined
              }
              students={students.data?.items ?? []}
            />
          </section>
        </main>
      )}
    </GuardianAccess>
  );
}

export function GuardianDetailPage() {
  const { organizationId = '', guardianId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const guardian = useGuardian(
    organizationId,
    guardianId,
    Boolean(access.data?.permissions.includes('guardian.read')),
  );

  if (access.isPending)
    return <LoadingState message="Checking guardian access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="Guardian access could not be verified."
        onRetry={() => void access.refetch()}
      />
    );
  if (!access.data.permissions.includes('guardian.read'))
    return <PermissionDeniedState />;
  if (guardian.isPending) return <LoadingState message="Loading guardian…" />;
  if (guardian.isError)
    return (
      <ErrorState
        title="Guardian unavailable"
        description={apiMessage(guardian.error)}
        onRetry={() => void guardian.refetch()}
      />
    );

  const record = guardian.data.guardian;
  const canUpdate = access.data.permissions.includes('guardian.update');
  return (
    <main className="page-stack student-management-page">
      <GuardianHeading
        action={
          canUpdate ? (
            <Link
              className="button button-primary"
              to={`/admin/organizations/${encodeURIComponent(organizationId)}/guardians/${encodeURIComponent(guardianId)}/edit`}
            >
              Edit guardian
            </Link>
          ) : undefined
        }

        description="Guardian contact details and linked students."
        organizationId={organizationId}
        title={`${record.firstName} ${record.lastName}`}
      />
      <section className="student-detail-panel panel">
        <h2>Guardian details</h2>
        <dl className="student-details">
          <div>
            <dt>Relationship</dt>
            <dd>{record.relationship || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{record.email || '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{record.phone || '—'}</dd>
          </div>
          <div>
            <dt>Communication preference</dt>
            <dd>{record.communicationPreference || '—'}</dd>
          </div>
        </dl>
      </section>
      <section className="student-detail-panel panel">
        <h2>Linked students</h2>
        {guardian.data.students.length ? (
          <ul className="guardian-linked-list">
            {guardian.data.students.map((relation) => (
              <li key={relation.id}>
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(relation.student.id)}`}
                >
                  {relation.student.firstName} {relation.student.lastName}
                </Link>
                <span>
                  {relation.relationship}
                  {relation.isPrimary ? ' · Primary contact' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="page-description">
            This guardian is not linked to a student.
          </p>
        )}
      </section>
    </main>
  );
}

export function GuardianEditPage() {
  const { organizationId = '', guardianId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const guardian = useGuardian(
    organizationId,
    guardianId,
    Boolean(
      access.data?.permissions.includes('guardian.update') &&
      access.data.permissions.includes('guardian.read'),
    ),
  );
  const mutation = useUpdateGuardian(organizationId, guardianId);
  const { showToast } = useToast();
  const submit = (input: GuardianInput) => {
    mutation.mutate(input, {
      onSuccess: () => {
        showToast('Guardian changes saved.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/guardians/${encodeURIComponent(guardianId)}`,
        );
      },
    });
  };

  return (
    <GuardianAccess
      organizationId={organizationId}
      permission="guardian.update"
    >
      {(currentAccess) =>
        !currentAccess.permissions.includes('guardian.read') ? (
          <PermissionDeniedState />
        ) : guardian.isPending ? (
          <LoadingState message="Loading guardian…" />
        ) : guardian.isError ? (
          <ErrorState
            title="Guardian unavailable"
            description={apiMessage(guardian.error)}
            onRetry={() => void guardian.refetch()}
          />
        ) : (
          <main className="page-stack student-management-page">
            <GuardianHeading
              description="Update guardian contact information."
              organizationId={organizationId}
              title="Edit guardian"
            />
            <section className="student-form-panel panel">
              <GuardianForm
                canLinkStudent={false}
                guardian={guardian.data.guardian}
                isSaving={mutation.isPending}
                onStudentChange={() => undefined}
                onStudentSearchChange={() => undefined}
                onSubmit={submit}
                requireStudent={false}
                saveError={
                  mutation.isError ? apiMessage(mutation.error) : undefined
                }
                selectedStudentId=""
                studentSearch=""
                students={[]}
              />
            </section>
          </main>
        )
      }
    </GuardianAccess>
  );
}

export function StudentGuardiansSection({
  organizationId,
  studentId,
  canRead,
  canUpdate,
}: {
  organizationId: string;
  studentId: string;
  canRead: boolean;
  canUpdate: boolean;
}) {
  const [guardianSearchInput, setGuardianSearchInput] = useState('');
  const [guardianSearch, setGuardianSearch] = useState('');
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setGuardianSearch(guardianSearchInput.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [guardianSearchInput]);
  const relations = useStudentGuardians(organizationId, studentId, canRead);
  const canManage = canRead && canUpdate;
  const guardianChoices = useQuery({
    queryKey: ['guardian-link-choices', organizationId, guardianSearch],
    queryFn: () =>
      listGuardians(organizationId, {
        search: guardianSearch,
        page: 1,
        pageSize: CHOICE_PAGE_SIZE,
      }),
    enabled: canManage,
    retry: false,
  });
  const linkMutation = useLinkGuardian(organizationId, studentId);
  const unlinkMutation = useUnlinkGuardian(organizationId, studentId);
  const { showToast } = useToast();
  const [guardianId, setGuardianId] = useState('');
  const [relationship, setRelationship] =
    useState<GuardianRelationship>('guardian');
  const [isPrimary, setIsPrimary] = useState(false);

  const link = () => {
    if (!guardianId) return;
    linkMutation.mutate(
      { guardianId, relationship, isPrimary },
      {
        onSuccess: () => {
          setGuardianId('');
          setIsPrimary(false);
          showToast('Guardian linked to student.');
        },
      },
    );
  };

  return (
    <section className="student-detail-panel panel">
      <h2>Guardians</h2>
      {!canRead ? (
        <PermissionDeniedState />
      ) : relations.isPending ? (
        <LoadingState message="Loading student guardians…" />
      ) : relations.isError ? (
        <ErrorState
          title="Guardians unavailable"
          description={apiMessage(relations.error)}
          onRetry={() => void relations.refetch()}
        />
      ) : relations.data.relations.length ? (
        <ul className="guardian-linked-list">
          {relations.data.relations.map((relation) => (
            <li key={relation.id}>
              <div>
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/guardians/${encodeURIComponent(relation.guardian.id)}`}
                >
                  {relation.guardian.firstName} {relation.guardian.lastName}
                </Link>
                <span>
                  {relation.relationship}
                  {relation.isPrimary ? ' · Primary contact' : ''}
                </span>
              </div>
              {canUpdate && (
                <button
                  className="button button-quiet"
                  disabled={unlinkMutation.isPending}
                  onClick={() =>
                    unlinkMutation.mutate(relation.guardian.id, {
                      onSuccess: () => showToast('Guardian unlinked.'),
                    })
                  }
                  type="button"
                >
                  Unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="page-description">
          No guardians are linked to this student yet.
        </p>
      )}
      {canManage && (
        <div className="guardian-link-controls">
          <label className="form-field">
            <span>Find guardian</span>
            <input
              autoComplete="off"
              onChange={(event) => setGuardianSearchInput(event.target.value)}
              placeholder="Search by guardian name or email"
              value={guardianSearchInput}
            />
          </label>
          {guardianChoices.isPending ? (
            <LoadingState message="Loading guardian choices…" />
          ) : guardianChoices.isError ? (
            <ErrorState
              title="Guardian choices unavailable"
              description={apiMessage(guardianChoices.error)}
              onRetry={() => void guardianChoices.refetch()}
            />
          ) : (
            <>
              <label className="form-field">
                <span>Link existing guardian</span>
                <select
                  onChange={(event) => setGuardianId(event.target.value)}
                  value={guardianId}
                >
                  <option value="">Select a guardian</option>
                  {guardianChoices.data.items
                    .filter(
                      (guardian) =>
                        !(relations.data?.relations ?? []).some(
                          (relation) => relation.guardian.id === guardian.id,
                        ),
                    )
                    .map((guardian) => (
                      <option key={guardian.id} value={guardian.id}>
                        {guardian.firstName} {guardian.lastName}
                      </option>
                    ))}
                </select>
              </label>
              {guardianChoices.data.items.every((guardian) =>
                (relations.data?.relations ?? []).some(
                  (relation) => relation.guardian.id === guardian.id,
                ),
              ) && (
                <p className="page-description" role="status">
                  {guardianChoices.data.items.length
                    ? 'All matching guardians are already linked.'
                    : 'No matching guardians found.'}
                </p>
              )}
              <label className="form-field">
                <span>Relationship to student</span>
                <select
                  onChange={(event) =>
                    setRelationship(event.target.value as GuardianRelationship)
                  }
                  value={relationship}
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="guardian-primary-option">
                <input
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                  type="checkbox"
                />
                Primary contact
              </label>
              <button
                className="button button-secondary"
                disabled={!guardianId || linkMutation.isPending}
                onClick={link}
                type="button"
              >
                {linkMutation.isPending ? 'Linking…' : 'Link guardian'}
              </button>
            </>
          )}
          {linkMutation.isError && (
            <p className="form-error" role="alert">
              {apiMessage(linkMutation.error)}
            </p>
          )}
          {unlinkMutation.isError && (
            <p className="form-error" role="alert">
              {apiMessage(unlinkMutation.error)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
