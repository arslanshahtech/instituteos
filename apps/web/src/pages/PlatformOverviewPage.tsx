import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Building2,
  Eye,
  Pencil,
  Trash2,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ApiError } from '../api/client.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/States.js';
import {
  createPlatformOrganization,
  getPlatformDemoRequests,
  getPlatformOrganizations,
  updatePlatformOrganizationStatus,
  updatePlatformOrganizationDetails,
  deletePlatformOrganization,
} from './platform-api.js';
import '../styles/platform-overview.css';

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function trialStatus(value: string | null) {
  if (!value) return 'No trial configured';
  return new Date(value).getTime() > Date.now()
    ? 'Trial ends ' + formatDate(value)
    : 'Trial ended ' + formatDate(value);
}

function AccessDenied() {
  return (
    <main className="platform-access-denied">
      <span>
        <ShieldCheck size={22} />
      </span>
      <p className="eyebrow">Restricted workspace</p>
      <h1>Platform access required</h1>
      <p>
        This workspace is available only to an account with an active platform
        administrator grant. Choosing a URL or email does not grant access.
      </p>
      <a href="/login">Return to sign in</a>
    </main>
  );
}

export function PlatformOverviewPage() {
  const [search, setSearch] = useState('');
  const [managedOrganizationId, setManagedOrganizationId] = useState<
    string | null
  >(null);
  const [viewOrganizationId, setViewOrganizationId] = useState<string | null>(
    null,
  );
  const [editOrganizationId, setEditOrganizationId] = useState<string | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    name: '',
    contactEmail: '',
    phone: '',
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteOrganizationId, setDeleteOrganizationId] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    institutionType: 'college' as 'school' | 'college',
    subdomain: '',
    adminEmail: '',
    plan: 'Growth' as 'Starter' | 'Growth' | 'Enterprise',
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  useEffect(() => {
    const targetId = viewOrganizationId
      ? 'platform-organization-view'
      : editOrganizationId
        ? 'platform-organization-edit'
        : deleteOrganizationId
          ? 'platform-organization-delete'
          : null;
    if (!targetId) return;
    requestAnimationFrame(() =>
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, [viewOrganizationId, editOrganizationId, deleteOrganizationId]);
  const queryClient = useQueryClient();
  const createOrganizationMutation = useMutation({
    mutationFn: createPlatformOrganization,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['platform', 'organizations'],
      });
      setCreateOpen(false);
      setCreateForm({
        name: '',
        institutionType: 'college',
        subdomain: '',
        adminEmail: '',
        plan: 'Growth',
      });
      setCreateSuccess(
        'Organization created. The owner invitation has been sent securely.',
      );
      setCreateError('');
    },
    onError: (error) => {
      setCreateError(
        error instanceof Error
          ? error.message
          : 'The organization could not be created.',
      );
    },
  });
  function submitCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    createOrganizationMutation.mutate({
      ...createForm,
      subdomain: createForm.subdomain.trim().toLowerCase(),
      adminEmail: createForm.adminEmail.trim().toLowerCase(),
      name: createForm.name.trim(),
    });
  }
  const organizationsQuery = useQuery({
    queryKey: ['platform', 'organizations'],
    queryFn: getPlatformOrganizations,
    retry: false,
  });
  const statusMutation = useMutation({
    mutationFn: ({
      organizationId,
      status,
    }: {
      organizationId: string;
      status: 'active' | 'suspended' | 'archived';
    }) => updatePlatformOrganizationStatus(organizationId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['platform', 'organizations'],
      });
    },
    onError: (error) =>
      setActionError(
        error instanceof Error
          ? error.message
          : 'Organization status could not be updated.',
      ),
  });
  const detailsMutation = useMutation({
    mutationFn: ({
      organizationId,
      input,
    }: {
      organizationId: string;
      input: { name: string; contactEmail: string; phone: string };
    }) => updatePlatformOrganizationDetails(organizationId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['platform', 'organizations'],
      });
      setEditOrganizationId(null);
      setActionError('');
    },
    onError: (error) =>
      setActionError(
        error instanceof Error
          ? error.message
          : 'Organization details could not be saved.',
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: ({
      organizationId,
      confirmationName,
    }: {
      organizationId: string;
      confirmationName: string;
    }) => deletePlatformOrganization(organizationId, confirmationName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['platform', 'organizations'],
      });
      setManagedOrganizationId(null);
      setDeleteConfirmation('');
      setActionError('');
    },
    onError: (error) =>
      setActionError(
        error instanceof Error
          ? error.message
          : 'Organization could not be deleted.',
      ),
  });
  const requestsQuery = useQuery({
    queryKey: ['platform', 'demo-requests'],
    queryFn: getPlatformDemoRequests,
    retry: false,
  });
  const organizations = organizationsQuery.data?.organizations ?? [];
  const filteredOrganizations = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return organizations;
    return organizations.filter((organization) =>
      [
        organization.name,
        organization.subdomain ?? '',
        organization.adminEmail ?? '',
        organization.plan ?? '',
        organization.status,
      ].some((field) => field.toLowerCase().includes(value)),
    );
  }, [organizations, search]);
  const isForbidden =
    organizationsQuery.error instanceof ApiError &&
    organizationsQuery.error.status === 403;

  if (isForbidden) return <AccessDenied />;

  const totalStudents = organizations.reduce(
    (sum, item) => sum + item.studentCount,
    0,
  );
  const monthlyRevenue = organizations.reduce((sum, item) => sum + item.mrr, 0);
  const activeOrganizations = organizations.filter(
    (item) => item.status === 'active',
  ).length;
  const newRequests = (requestsQuery.data?.requests ?? []).filter(
    (item) => item.status === 'new',
  ).length;

  return (
    <main className="page-stack platform-admin-page">
      <section className="page-heading platform-page-heading">
        <div>
          <p className="eyebrow">InstituteOS / Platform</p>
          <h1>Super Admin</h1>
          <p className="page-description">
            Organization overview and demo requests. Student-level and family
            records remain inside each organization workspace.
          </p>
        </div>
        <div className="platform-page-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setCreateOpen((open) => !open);
              setCreateError('');
              setCreateSuccess('');
            }}
          >
            Add organization
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              void organizationsQuery.refetch();
              void requestsQuery.refetch();
            }}
          >
            <RefreshCw size={15} /> Refresh data
          </button>
        </div>
      </section>

      {createSuccess && (
        <p className="platform-create-success" role="status">
          <ShieldCheck size={15} /> {createSuccess}
        </p>
      )}
      {createOpen && (
        <section
          className="panel platform-create-panel"
          aria-labelledby="platform-create-heading"
        >
          <div className="platform-panel-heading">
            <div>
              <h2 id="platform-create-heading">Add organization</h2>
              <p>
                Creates an organization with a 14-day trial and emails a secure
                owner invitation. No password is created or exposed by the
                platform.
              </p>
            </div>
          </div>
          <form
            className="platform-create-form"
            onSubmit={submitCreateOrganization}
          >
            <label>
              Organization name
              <input
                required
                minLength={2}
                maxLength={160}
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm({ ...createForm, name: event.target.value })
                }
                placeholder="City College"
              />
            </label>
            <label>
              Organization type
              <select
                required
                value={createForm.institutionType}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    institutionType: event.target.value as 'school' | 'college',
                  })
                }
              >
                <option value="school">School</option>
                <option value="college">College</option>
              </select>
            </label>
            <label>
              Subdomain
              <div className="platform-subdomain-input">
                <input
                  required
                  minLength={3}
                  maxLength={63}
                  pattern="[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?"
                  value={createForm.subdomain}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      subdomain: event.target.value.toLowerCase(),
                    })
                  }
                  placeholder="citycollege"
                />
                <span>.instituteos.com</span>
              </div>
            </label>
            <label>
              Organization owner email
              <input
                required
                type="email"
                maxLength={254}
                value={createForm.adminEmail}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    adminEmail: event.target.value,
                  })
                }
                placeholder="admin@citycollege.edu"
              />
            </label>
            <label>
              Plan
              <select
                value={createForm.plan}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    plan: event.target.value as
                      'Starter' | 'Growth' | 'Enterprise',
                  })
                }
              >
                <option value="Starter">Starter — $49/mo</option>
                <option value="Growth">Growth — $149/mo</option>
                <option value="Enterprise">Enterprise — $399/mo</option>
              </select>
            </label>
            {createError && (
              <p className="platform-form-error" role="alert">
                {createError}
              </p>
            )}
            <div className="platform-create-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={createOrganizationMutation.isPending}
              >
                {createOrganizationMutation.isPending
                  ? 'Creating…'
                  : 'Create & invite owner'}
              </button>
            </div>
          </form>
        </section>
      )}

      {organizationsQuery.isPending ? (
        <LoadingState message="Loading organizations…" />
      ) : organizationsQuery.isError ? (
        <ErrorState
          title="Platform organizations could not be loaded"
          description="The API denied the request or could not load the platform records. Verify the signed-in account has an active platform administrator grant."
          onRetry={() => void organizationsQuery.refetch()}
        />
      ) : (
        <>
          <section
            className="platform-metric-grid"
            aria-label="Platform summary"
          >
            <article className="platform-metric-card">
              <span className="platform-metric-icon">
                <Building2 size={18} />
              </span>
              <span>Organizations</span>
              <strong>{organizations.length}</strong>
              <small>{activeOrganizations} active</small>
            </article>
            <article className="platform-metric-card">
              <span className="platform-metric-icon">
                <GraduationCap size={18} />
              </span>
              <span>Student records</span>
              <strong>{totalStudents.toLocaleString()}</strong>
              <small>Count only · no student details</small>
            </article>
            <article className="platform-metric-card">
              <span className="platform-metric-icon">
                <CalendarDays size={18} />
              </span>
              <span>Plan MRR (est.)</span>
              <strong>{formatCurrency(monthlyRevenue)}</strong>
              <small>Estimated; billing is not connected</small>
            </article>
            <article className="platform-metric-card">
              <span className="platform-metric-icon">
                <Users size={18} />
              </span>
              <span>New demo requests</span>
              <strong>{newRequests}</strong>
              <small>
                {requestsQuery.isError
                  ? 'Request list unavailable'
                  : 'Awaiting review'}
              </small>
            </article>
          </section>

          <section
            className="panel platform-table-panel"
            aria-labelledby="platform-org-heading"
          >
            <div className="platform-panel-heading">
              <div>
                <h2 id="platform-org-heading">Organizations</h2>
                <p>
                  Platform-level metadata only; no student names, attendance, or
                  individual fee records.
                </p>
              </div>
              <label className="platform-table-search">
                <Search size={15} />
                <input
                  aria-label="Search organizations"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search organizations"
                />
              </label>
            </div>
            <div className="platform-table-wrap">
              <table className="platform-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Subdomain</th>
                    <th>Admin email</th>
                    <th>Students</th>
                    <th>Plan / MRR</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizations.map((organization) => (
                    <Fragment key={organization.id}>
                      <tr>
                        <td>
                          <strong>{organization.name}</strong>
                          <small className="platform-cell-sub">
                            {organization.institutionType === 'college'
                              ? 'College'
                              : organization.institutionType === 'school'
                                ? 'School'
                                : 'Type not set'}
                          </small>
                          <small className="platform-cell-id">
                            {organization.id}
                          </small>
                        </td>
                        <td>
                          {organization.subdomain ? (
                            <span className="platform-subdomain">
                              {organization.subdomain}.instituteos.com
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{organization.adminEmail ?? 'Not assigned'}</td>
                        <td className="platform-number-cell">
                          {organization.studentCount.toLocaleString()}
                        </td>
                        <td>
                          <strong>{organization.plan ?? 'Unassigned'}</strong>
                          <small className="platform-cell-sub">
                            {formatCurrency(organization.mrr)} / mo (estimate)
                          </small>
                          <small className="platform-cell-sub">
                            {trialStatus(organization.trialEndsAt)}
                          </small>
                        </td>
                        <td>
                          <span
                            className={
                              'platform-status status-' + organization.status
                            }
                          >
                            {organization.status}
                          </span>
                        </td>
                        <td>{formatDate(organization.createdAt)}</td>
                        <td>
                          <button
                            className="button button-secondary platform-manage-button"
                            type="button"
                            aria-expanded={
                              managedOrganizationId === organization.id
                            }
                            onClick={() =>
                              setManagedOrganizationId((current) =>
                                current === organization.id
                                  ? null
                                  : organization.id,
                              )
                            }
                          >
                            {managedOrganizationId === organization.id
                              ? 'Close'
                              : 'Manage'}
                          </button>
                        </td>
                      </tr>
                      {managedOrganizationId === organization.id && (
                        <tr
                          key={`${organization.id}-manage`}
                          className="platform-manage-row"
                        >
                          <td colSpan={8}>
                            <section
                              className="platform-manage-panel"
                              aria-label={`Manage ${organization.name}`}
                            >
                              <div>
                                <strong>{organization.name}</strong>
                                <p>
                                  Owner account:{' '}
                                  {organization.adminEmail ??
                                    'No active owner email assigned'}
                                </p>
                                <p>Organization ID: {organization.id}</p>
                                <p>
                                  Student records:{' '}
                                  {organization.studentCount.toLocaleString()} ·
                                  Plan: {organization.plan ?? 'Unassigned'}
                                </p>
                              </div>
                              <div className="platform-manage-actions">
                                {organization.status !== 'archived' && (
                                  <>
                                    <button
                                      className="button button-secondary"
                                      type="button"
                                      onClick={() => {
                                        setManagedOrganizationId(null);
                                        setEditOrganizationId(null);
                                        setDeleteOrganizationId(null);
                                        setViewOrganizationId(organization.id);
                                      }}
                                    >
                                      <Eye size={14} /> View
                                    </button>
                                    <button
                                      className="button button-secondary"
                                      type="button"
                                      onClick={() => {
                                        setManagedOrganizationId(null);
                                        setViewOrganizationId(null);
                                        setDeleteOrganizationId(null);
                                        setEditOrganizationId(organization.id);
                                        setEditForm({
                                          name: organization.name,
                                          contactEmail:
                                            organization.contactEmail ?? '',
                                          phone: organization.phone ?? '',
                                        });
                                        setActionError('');
                                      }}
                                    >
                                      <Pencil size={14} /> Edit
                                    </button>
                                  </>
                                )}
                                {organization.status !== 'active' && (
                                  <button
                                    className="button button-secondary"
                                    type="button"
                                    disabled={statusMutation.isPending}
                                    onClick={() =>
                                      statusMutation.mutate({
                                        organizationId: organization.id,
                                        status: 'active',
                                      })
                                    }
                                  >
                                    <RotateCcw size={14} />{' '}
                                    {organization.status === 'archived'
                                      ? 'Restore'
                                      : 'Reactivate'}
                                  </button>
                                )}
                                {organization.status === 'active' && (
                                  <button
                                    className="button button-secondary"
                                    type="button"
                                    disabled={statusMutation.isPending}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Suspend ${organization.name}? Members will lose normal access until reactivated.`,
                                        )
                                      )
                                        statusMutation.mutate({
                                          organizationId: organization.id,
                                          status: 'suspended',
                                        });
                                    }}
                                  >
                                    <PauseCircle size={14} /> Suspend
                                  </button>
                                )}
                                {organization.status !== 'archived' && (
                                  <button
                                    className="button button-secondary"
                                    type="button"
                                    disabled={statusMutation.isPending}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Archive ${organization.name}? It will no longer be an active organization.`,
                                        )
                                      )
                                        statusMutation.mutate({
                                          organizationId: organization.id,
                                          status: 'archived',
                                        });
                                    }}
                                  >
                                    <Archive size={14} /> Archive
                                  </button>
                                )}
                                {organization.status === 'archived' && (
                                  <button
                                    className="button button-secondary platform-danger-action"
                                    type="button"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => {
                                      setActionError('');
                                      setDeleteConfirmation('');
                                      setManagedOrganizationId(null);
                                      setViewOrganizationId(null);
                                      setEditOrganizationId(null);
                                      setDeleteOrganizationId(organization.id);
                                    }}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                )}
                                {actionError && (
                                  <p
                                    className="platform-form-error"
                                    role="alert"
                                  >
                                    {actionError}
                                  </p>
                                )}
                              </div>
                            </section>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {filteredOrganizations.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <div className="platform-table-empty">
                          {organizations.length
                            ? 'No organizations match this search.'
                            : 'No organizations have been created yet.'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {viewOrganizationId &&
            (() => {
              const item = organizations.find(
                (org) => org.id === viewOrganizationId,
              );
              return item ? (
                <section
                  id="platform-organization-view"
                  className="panel platform-detail-panel"
                  aria-label="Organization details"
                >
                  <div className="platform-panel-heading">
                    <div>
                      <h2>{item.name}</h2>
                      <p>Organization overview · read only</p>
                    </div>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setViewOrganizationId(null)}
                    >
                      Close
                    </button>
                  </div>
                  <dl className="platform-detail-grid">
                    <div>
                      <dt>Organization ID</dt>
                      <dd>{item.id}</dd>
                    </div>
                    <div>
                      <dt>Subdomain</dt>
                      <dd>{item.subdomain ?? 'Not assigned'}</dd>
                    </div>
                    <div>
                      <dt>Owner email</dt>
                      <dd>{item.adminEmail ?? 'Not assigned'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{item.status}</dd>
                    </div>
                    <div>
                      <dt>Students</dt>
                      <dd>{item.studentCount.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Plan</dt>
                      <dd>{item.plan ?? 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt>Estimated MRR</dt>
                      <dd>{formatCurrency(item.mrr)}</dd>
                    </div>
                    <div>
                      <dt>Trial</dt>
                      <dd>{trialStatus(item.trialEndsAt)}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDate(item.createdAt)}</dd>
                    </div>
                  </dl>
                </section>
              ) : null;
            })()}
          {editOrganizationId &&
            (() => {
              const item = organizations.find(
                (org) => org.id === editOrganizationId,
              );
              return item ? (
                <section
                  id="platform-organization-edit"
                  className="panel platform-detail-panel"
                  aria-label="Edit organization"
                >
                  <div className="platform-panel-heading">
                    <div>
                      <h2>Edit organization</h2>
                      <p>
                        Update organization profile details. Changes are audit
                        logged.
                      </p>
                    </div>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setEditOrganizationId(null)}
                    >
                      Close
                    </button>
                  </div>
                  <form
                    className="platform-edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      detailsMutation.mutate({
                        organizationId: item.id,
                        input: {
                          name: editForm.name.trim(),
                          contactEmail: editForm.contactEmail.trim(),
                          phone: editForm.phone.trim(),
                        },
                      });
                    }}
                  >
                    <label>
                      Organization name
                      <input
                        required
                        minLength={2}
                        maxLength={160}
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm({ ...editForm, name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Organization contact email
                      <input
                        required
                        type="email"
                        maxLength={254}
                        value={editForm.contactEmail}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            contactEmail: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        maxLength={40}
                        value={editForm.phone}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            phone: event.target.value,
                          })
                        }
                      />
                    </label>
                    {actionError && (
                      <p className="platform-form-error" role="alert">
                        {actionError}
                      </p>
                    )}
                    <div className="platform-create-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => setEditOrganizationId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={detailsMutation.isPending}
                      >
                        {detailsMutation.isPending ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null;
            })()}
          {deleteOrganizationId &&
            (() => {
              const item = organizations.find(
                (org) => org.id === deleteOrganizationId,
              );
              return item ? (
                <section
                  id="platform-organization-delete"
                  className="panel platform-delete-panel"
                  aria-label="Permanently delete organization"
                >
                  <div className="platform-panel-heading">
                    <div>
                      <h2>Delete {item.name} permanently?</h2>
                      <p>
                        This permanently removes the organization, its campuses,
                        memberships, invitations and organization audit history.
                        This cannot be undone. Confirm the exact organization
                        name to continue.
                      </p>
                    </div>
                  </div>
                  <label>
                    Type <strong>{item.name}</strong> to confirm
                    <input
                      value={deleteConfirmation}
                      onChange={(event) =>
                        setDeleteConfirmation(event.target.value)
                      }
                      placeholder="Exact organization name"
                    />
                  </label>
                  <p className="platform-delete-warning">
                    Before continuing, make sure any records required for legal
                    or school retention have been exported. The organization and
                    the listed related records will be permanently removed.
                  </p>
                  {actionError && (
                    <p className="platform-form-error" role="alert">
                      {actionError}
                    </p>
                  )}
                  <div className="platform-create-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setDeleteOrganizationId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={
                        deleteConfirmation !== item.name ||
                        deleteMutation.isPending
                      }
                      onClick={() =>
                        deleteMutation.mutate({
                          organizationId: item.id,
                          confirmationName: deleteConfirmation,
                        })
                      }
                    >
                      {deleteMutation.isPending
                        ? 'Deleting…'
                        : 'Permanently delete'}
                    </button>
                  </div>
                </section>
              ) : null;
            })()}
          <section
            className="panel platform-table-panel"
            aria-labelledby="platform-requests-heading"
          >
            <div className="platform-panel-heading">
              <div>
                <h2 id="platform-requests-heading">Demo requests</h2>
                <p>
                  Requests submitted from the public landing page. Review before
                  creating an organization or inviting an owner.
                </p>
              </div>
              <span className="platform-count-chip">
                {requestsQuery.data?.requests.length ??
                  (requestsQuery.isError ? 'Unavailable' : 0)}{' '}
                total
              </span>
            </div>
            {requestsQuery.isPending ? (
              <LoadingState message="Loading demo requests…" />
            ) : requestsQuery.isError ? (
              <div className="platform-inline-error">
                <CircleAlert size={16} /> Demo requests are temporarily
                unavailable.{' '}
                <button
                  type="button"
                  onClick={() => void requestsQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (requestsQuery.data?.requests.length ?? 0) === 0 ? (
              <EmptyState
                title="No demo requests yet"
                description="New public demo requests will appear here after they are submitted."
              />
            ) : (
              <div className="platform-table-wrap">
                <table className="platform-table">
                  <thead>
                    <tr>
                      <th>Institute</th>
                      <th>Contact</th>
                      <th>Email / phone</th>
                      <th>Estimated students</th>
                      <th>Plan</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsQuery.data!.requests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <strong>{request.organizationName}</strong>
                        </td>
                        <td>{request.contactName}</td>
                        <td>
                          {request.email}
                          <small className="platform-cell-sub">
                            {request.phone ?? 'No phone supplied'}
                          </small>
                        </td>
                        <td>{request.studentCountEstimate.toLocaleString()}</td>
                        <td>{request.plan}</td>
                        <td className="platform-request-message">
                          {request.message || '—'}
                        </td>
                        <td>
                          <span
                            className={
                              'platform-status status-' + request.status
                            }
                          >
                            {request.status}
                          </span>
                        </td>
                        <td>{formatDate(request.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="platform-privacy-note">
            <ShieldCheck size={15} /> Privacy boundary: platform views contain
            organization metadata and aggregate student counts only. They do not
            return student names, parent contacts, individual attendance, or
            student-level fee details.
          </p>
        </>
      )}
    </main>
  );
}
