import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  RefreshCw,
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
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    subdomain: '',
    adminEmail: '',
    plan: 'Growth' as 'Starter' | 'Growth' | 'Enterprise',
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
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
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizations.map((organization) => (
                    <tr key={organization.id}>
                      <td>
                        <strong>{organization.name}</strong>
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
                    </tr>
                  ))}
                  {filteredOrganizations.length === 0 && (
                    <tr>
                      <td colSpan={7}>
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
