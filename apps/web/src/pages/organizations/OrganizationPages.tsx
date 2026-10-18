import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  GraduationCap,
  ReceiptText,
  UserCheck,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import { WorkspaceMetricCard } from '../../components/ui/WorkspacePrimitives.js';
import { listApplications } from '../../admissions/admissions-api.js';
import type { ApplicationRecord } from '../../admissions/admissions-api.js';
import { listStudentAttendance } from '../../attendance/attendance-api.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Dialog.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../../components/ui/States.js';
import {
  acceptOrganizationInvitation,
  archiveOrganization,
  createCampus,
  createOrganization,
  deleteOrganization,
  getAccessibleOrganizations,
  getCampuses,
  getInvitations,
  getMembers,
  getOrganizationDashboard,
  inviteMember,
  ORGANIZATION_ROLES,
  restoreOrganization,
  updateCampus,
  updateMember,
  updateOrganization,
} from '../../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../../tenancy/tenancy-api.js';
import { listGuardians } from '../../guardians/guardians-api.js';
import { listDailyCollections } from '../../finance/finance-api.js';
import type { GuardianListResponse } from '../../guardians/guardians-api.js';
import { useOrganizationSummary } from '../../reporting/reporting-api.js';
import type { OrganizationSummary } from '../../reporting/reporting-api.js';
import type {
  AccessibleOrganization,
  Campus,
  OrganizationDashboard,
  OrganizationInvitation,
  OrganizationMember,
} from '../../organizations/organizations-api.js';

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The request could not be completed. Try again.';
}

function CampusScopeSelect({
  campuses,
  label,
  selectedCampusIds,
  onChange,
}: {
  campuses: Campus[];
  label: string;
  selectedCampusIds: string[];
  onChange: (campusIds: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const optionsId = useId();
  const selectedCount = selectedCampusIds.length;
  return (
    <div
      className={`campus-scope-dropdown${isOpen ? ' is-open' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}
    >
      <button
        aria-controls={optionsId}
        aria-expanded={isOpen}
        aria-label={label}
        className="campus-scope-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span>
          {selectedCount === 0
            ? 'Select campuses'
            : `${selectedCount} campus${selectedCount === 1 ? '' : 'es'} selected`}
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {isOpen && (
        <div
          aria-label={label}
          className="campus-scope-options"
          id={optionsId}
          role="group"
        >
          {campuses.length ? (
            campuses.map((campus) => (
              <label key={campus.id} className="campus-scope-option">
                <input
                  checked={selectedCampusIds.includes(campus.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selectedCampusIds, campus.id]
                        : selectedCampusIds.filter((id) => id !== campus.id),
                    )
                  }
                  type="checkbox"
                  value={campus.id}
                />
                <span>{campus.name}</span>
              </label>
            ))
          ) : (
            <span className="campus-scope-empty">No campuses available</span>
          )}
        </div>
      )}
    </div>
  );
}

export function MyOrganizationsPage({
  redirectSingle = false,
}: {
  redirectSingle?: boolean;
}) {
  const navigate = useNavigate();
  const organizations = useQuery({
    queryKey: ['accessible-organizations'],
    queryFn: getAccessibleOrganizations,
    retry: false,
  });

  useEffect(() => {
    const active = (organizations.data?.organizations ?? []).filter(
      (organization) => organization.status === 'active',
    );
    if (redirectSingle && active.length === 1)
      navigate(`/admin/organizations/${active[0]!.id}`, { replace: true });
  }, [navigate, organizations.data, redirectSingle]);

  if (organizations.isPending)
    return <LoadingState message="Loading your organizations…" />;
  if (organizations.isError)
    return (
      <ErrorState
        title="Organizations unavailable"
        description="Your organizations could not be loaded."
        onRetry={() => void organizations.refetch()}
      />
    );

  const accessible = organizations.data.organizations;
  const activeOrganizations = accessible.filter(
    (organization) => organization.status === 'active',
  );
  const archivedOrganizations = accessible.filter(
    (organization) => organization.status === 'archived',
  );
  if (redirectSingle && activeOrganizations.length === 1)
    return <LoadingState message="Opening your organization…" />;

  return (
    <main className="page-stack organization-admin-page">
      <section className="page-heading organization-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Organizations</h1>
          <p className="page-description">
            Open an organization you belong to or create a new workspace.
          </p>
        </div>
        <Link
          className="button button-primary"
          to="/admin/organizations/onboarding"
        >
          Create organization
        </Link>
      </section>
      {activeOrganizations.length === 0 &&
      archivedOrganizations.length === 0 ? (
        <EmptyState
          title="No organizations yet"
          description="Create an organization to set up your InstituteOS workspace."
          action={
            <Link
              className="button button-primary"
              to="/admin/organizations/onboarding"
            >
              Create organization
            </Link>
          }
        />
      ) : activeOrganizations.length > 0 ? (
        <section
          aria-label="Active organizations"
          className="accessible-organizations"
        >
          {activeOrganizations.map((organization) => (
            <OrganizationDiscoveryCard
              key={organization.id}
              organization={organization}
            />
          ))}
        </section>
      ) : null}
      {archivedOrganizations.length > 0 && (
        <section
          aria-label="Archived organizations"
          className="archived-organizations"
        >
          <div className="section-heading">
            <div>
              <h2>Archived organizations</h2>
              <p>
                Archived organizations are not active workspaces. Owners can
                restore or permanently delete them.
              </p>
            </div>
          </div>
          {archivedOrganizations.map((organization) => (
            <ArchivedOrganizationCard
              key={organization.id}
              organization={organization}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function ArchivedOrganizationCard({
  organization,
}: {
  organization: AccessibleOrganization;
}) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const restore = useMutation({
    mutationFn: () => restoreOrganization(organization.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['accessible-organizations'],
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteOrganization(organization.id, confirmation),
    onSuccess: async () => {
      setDeleteOpen(false);
      setConfirmation('');
      await queryClient.invalidateQueries({
        queryKey: ['accessible-organizations'],
      });
    },
  });
  return (
    <article className="accessible-organization archived-organization">
      <div>
        <p className="eyebrow">
          Archived organization · {roleLabel(organization.role)}
        </p>
        <h3>{organization.name}</h3>
        <p>Normal organization operations are unavailable while archived.</p>
        {organization.role === 'organization_owner' ? (
          <div className="organization-heading-actions">
            <Button
              disabled={restore.isPending || remove.isPending}
              onClick={() => restore.mutate()}
            >
              {restore.isPending ? 'Restoring…' : 'Restore'}
            </Button>
            <Button
              disabled={restore.isPending || remove.isPending}
              onClick={() => setDeleteOpen(true)}
              variant="danger"
            >
              Delete permanently
            </Button>
          </div>
        ) : (
          <p>Contact an organization owner to restore this workspace.</p>
        )}
        {(restore.isError || remove.isError) && (
          <p className="form-error" role="alert">
            {apiMessage(restore.error ?? remove.error)}
          </p>
        )}
      </div>
      <Dialog
        description={`This permanently removes ${organization.name} and its Phase 05 campuses, memberships, and invitations. User accounts and other organizations are not deleted. This cannot be undone through the current UI.`}
        onOpenChange={(open) => {
          if (!remove.isPending) setDeleteOpen(open);
          if (!open) setConfirmation('');
        }}
        open={deleteOpen}
        title="Delete organization permanently"
      >
        <div className="delete-confirmation">
          <p>
            Type <strong>{organization.name}</strong> exactly to confirm.
          </p>
          <label>
            Organization name
            <input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {remove.isError && (
            <p className="form-error" role="alert">
              {apiMessage(remove.error)}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              disabled={remove.isPending}
              onClick={() => {
                setDeleteOpen(false);
                setConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={remove.isPending || confirmation !== organization.name}
              onClick={() => remove.mutate()}
              variant="danger"
            >
              {remove.isPending ? 'Deleting…' : 'Delete organization'}
            </Button>
          </div>
        </div>
      </Dialog>
    </article>
  );
}

function OrganizationDiscoveryCard({
  organization,
}: {
  organization: AccessibleOrganization;
}) {
  return (
    <article className="accessible-organization">
      <div>
        <h2>{organization.name}</h2>
        <p>{roleLabel(organization.role)}</p>
      </div>
      <Link
        aria-label={`Open ${organization.name}`}
        className="button button-secondary"
        to={`/admin/organizations/${encodeURIComponent(organization.id)}`}
      >
        Open
      </Link>
    </article>
  );
}

function roleLabel(role: string): string {
  return role.replaceAll('_', ' ');
}

export function OrganizationOnboardingPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: createOrganization,
    onSuccess: ({ organization }) =>
      navigate(`/admin/organizations/${organization.id}`),
    onError: (reason) => setError(apiMessage(reason)),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const campusName = String(form.get('campusName') ?? '').trim();
    if (name.length < 2)
      return setError('Organization name must be at least 2 characters.');
    if (campusName && campusName.length < 2)
      return setError('Campus name must be at least 2 characters.');
    setError('');
    create.mutate({
      name,
      contactEmail: String(form.get('contactEmail') ?? '').trim() || undefined,
      phone: String(form.get('phone') ?? '').trim() || undefined,
      timezone: String(form.get('timezone') ?? '').trim() || undefined,
      ...(campusName ? { initialCampus: { name: campusName } } : {}),
    });
  }
  return (
    <main className="page-stack organization-admin-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Organization setup</p>
          <h1>Create your organization</h1>
          <p className="page-description">
            You will become its first organization owner.
          </p>
        </div>
      </section>
      <form className="organization-form" onSubmit={submit}>
        <label>
          Organization name
          <input name="name" required minLength={2} maxLength={160} />
        </label>
        <label>
          Contact email
          <input name="contactEmail" type="email" maxLength={254} />
        </label>
        <label>
          Phone
          <input name="phone" maxLength={40} />
        </label>
        <label>
          Timezone
          <input name="timezone" placeholder="UTC" maxLength={80} />
        </label>
        <label>
          Initial campus name <span className="field-hint">Optional</span>
          <input name="campusName" maxLength={160} />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create organization'}
        </Button>
      </form>
    </main>
  );
}

type AdminTab =
  'overview' | 'settings' | 'campuses' | 'members' | 'invitations';

function parseAdminTab(value: string | null): AdminTab {
  return value === 'settings' ||
    value === 'campuses' ||
    value === 'members' ||
    value === 'invitations'
    ? value
    : 'overview';
}

export function OrganizationAdminPage() {
  const { organizationId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<AdminTab>(() =>
    parseAdminTab(searchParams.get('tab')),
  );
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setTab(parseAdminTab(searchParams.get('tab')));
  }, [searchParams]);
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const accessibleOrganizations = useQuery({
    queryKey: ['accessible-organizations'],
    queryFn: getAccessibleOrganizations,
    enabled: Boolean(access.data),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ['organization-dashboard', organizationId],
    queryFn: () => getOrganizationDashboard(organizationId),
    enabled: Boolean(organizationId && access.data),
    retry: false,
  });
  const summary = useOrganizationSummary(
    organizationId,
    undefined,
    Boolean(organizationId && access.data && tab === 'overview'),
  );
  const guardians = useQuery({
    queryKey: ['organization-guardian-count', organizationId],
    queryFn: () => listGuardians(organizationId, { page: 1, pageSize: 1 }),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('guardian.read') &&
      tab === 'overview',
    ),
    retry: false,
  });
  const collectionRange = useMemo(() => {
    const now = new Date();
    const key = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: key(monthStart), dateTo: key(now) };
  }, []);
  const monthlyCollections = useQuery({
    queryKey: [
      'organization-dashboard-monthly-collections',
      organizationId,
      collectionRange.dateFrom,
      collectionRange.dateTo,
    ],
    queryFn: () => listDailyCollections(organizationId, collectionRange),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('finance.read') &&
      tab === 'overview',
    ),
    retry: false,
  });
  const attendanceRange = useMemo(() => {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo);
    dateFrom.setDate(dateTo.getDate() - 6);
    const toKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { dateFrom: toKey(dateFrom), dateTo: toKey(dateTo) };
  }, []);
  const recentAdmissions = useQuery({
    queryKey: ['organization-dashboard-recent-admissions', organizationId],
    queryFn: () =>
      listApplications(organizationId, {
        search: '',
        page: 1,
        pageSize: 3,
      }),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('admission.read') &&
      tab === 'overview',
    ),
    retry: false,
  });
  const weeklyAttendance = useQuery({
    queryKey: [
      'organization-dashboard-weekly-attendance',
      organizationId,
      attendanceRange.dateFrom,
      attendanceRange.dateTo,
    ],
    queryFn: () => listStudentAttendance(organizationId, attendanceRange),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('attendance.read') &&
      tab === 'overview',
    ),
    retry: false,
  });
  const campuses = useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('campus.read') &&
      ['campuses', 'members'].includes(tab),
    ),
    retry: false,
  });
  const members = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: () => getMembers(organizationId),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('member.read') &&
      tab === 'members',
    ),
    retry: false,
  });
  const invitations = useQuery({
    queryKey: ['organization-invitations', organizationId],
    queryFn: () => getInvitations(organizationId),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('member.manage') &&
      tab === 'invitations',
    ),
    retry: false,
  });
  const mutationDone = async (message: string) => {
    setNotice(message);
    await queryClient.invalidateQueries({
      queryKey: ['organization-dashboard', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-campuses', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-members', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-invitations', organizationId],
    });
  };
  const canUpdate =
    access.data?.permissions.includes('organization.update') ?? false;
  const canReadCampuses =
    access.data?.permissions.includes('campus.read') ?? false;
  const canCreateCampuses =
    access.data?.permissions.includes('campus.create') ?? false;
  const canUpdateCampuses =
    access.data?.permissions.includes('campus.update') ?? false;
  const canChangeCampusStatus =
    access.data?.permissions.includes('campus.status.update') ?? false;
  const canManageMembers =
    access.data?.permissions.includes('member.manage') ?? false;
  const canReadMembers =
    access.data?.permissions.includes('member.read') ?? false;
  const canInvite = access.data?.permissions.includes('member.invite') ?? false;
  const canAssignOwner = access.data?.role === 'organization_owner';
  const organizationPath = `/admin/organizations/${encodeURIComponent(organizationId)}`;

  useEffect(() => {
    const accessUnavailable =
      access.error instanceof ApiError && access.error.status === 404;
    const dashboardUnavailable =
      dashboard.error instanceof ApiError && dashboard.error.status === 404;
    if (accessUnavailable || dashboardUnavailable)
      navigate('/admin/organizations', { replace: true });
  }, [access.error, dashboard.error, navigate]);

  if (access.isPending)
    return <LoadingState message="Loading organization access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="You may not have access to this organization."
        onRetry={() => void access.refetch()}
      />
    );

  return (
    <main className="page-stack organization-admin-page">
      <section className="page-heading organization-heading reference-dashboard-heading">
        <div>
          <p className="eyebrow">
            Organization workspace · {access.data.role.replaceAll('_', ' ')}
          </p>
          <h1>Institute Overview</h1>
          <p className="page-description organization-user-meta">
            {dashboard.data?.organization.name ?? 'Your college'} · Welcome
            back, {auth.user?.displayName ?? 'there'}.
          </p>
          {accessibleOrganizations.data?.organizations.some(
            (organization) => organization.id === organizationId,
          ) && (
            <label
              className="organization-switcher"
              htmlFor="organization-switcher"
            >
              <span>Current organization</span>
              <div className="organization-switcher-control">
                <select
                  id="organization-switcher"
                  aria-label="Current organization"
                  value={organizationId}
                  onChange={(event) =>
                    navigate(
                      `/admin/organizations/${encodeURIComponent(event.target.value)}`,
                    )
                  }
                >
                  {accessibleOrganizations.data.organizations
                    .filter((organization) => organization.status === 'active')
                    .map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                </select>
              </div>
            </label>
          )}
        </div>
        {tab === 'overview' && (
          <div
            aria-label="College quick actions"
            className="organization-heading-actions organization-dashboard-actions reference-quick-actions"
            role="group"
          >
            {(
              [
                {
                  label: 'Add Student',
                  to: `${organizationPath}/students/new`,
                  permission: 'student.create',
                  icon: UserPlus,
                },
                {
                  label: 'Collect Fee',
                  to: `${organizationPath}/finance`,
                  permission: 'finance.write',
                  icon: WalletCards,
                },
                {
                  label: 'Mark Attendance',
                  to: `${organizationPath}/attendance`,
                  permission: 'attendance.write',
                  icon: CalendarCheck,
                },
                {
                  label: 'Generate Report',
                  to: `${organizationPath}/reports`,
                  permission: 'reporting.read',
                  icon: BarChart3,
                },
              ] as const
            ).map((action) => {
              const Icon = action.icon;
              const permitted = access.data.permissions.includes(
                action.permission,
              );
              return permitted ? (
                <Link
                  className="organization-dashboard-action reference-quick-action"
                  key={action.label}
                  to={action.to}
                >
                  <Icon size={15} aria-hidden="true" /> {action.label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="organization-dashboard-action reference-quick-action is-unavailable"
                  key={action.label}
                  title={`Your current role does not have permission to: ${action.label.toLowerCase()}.`}
                >
                  <Icon size={15} aria-hidden="true" /> {action.label}
                </span>
              );
            })}
          </div>
        )}
      </section>
      {tab !== 'overview' && (
        <>
          <label className="organization-section-selector">
            <span>Organization section</span>
            <select
              aria-label="Organization section"
              value={tab}
              onChange={(event) => {
                setTab(event.target.value as AdminTab);
                setNotice('');
              }}
            >
              {(
                [
                  'overview',
                  'settings',
                  'campuses',
                  'members',
                  'invitations',
                ] as const
              ).map((item) => (
                <option key={item} value={item}>
                  {item[0]!.toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <nav
            className="organization-tabs"
            aria-label="Organization administration"
          >
            {(
              [
                'overview',
                'settings',
                'campuses',
                'members',
                'invitations',
              ] as const
            ).map((item) => (
              <button
                key={item}
                type="button"
                aria-current={tab === item ? 'page' : undefined}
                onClick={() => {
                  setTab(item);
                  setNotice('');
                }}
              >
                {item}
              </button>
            ))}
          </nav>
        </>
      )}
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      {tab === 'overview' && (
        <OverviewPanel
          dashboard={dashboard}
          summary={summary}
          guardians={guardians}
          recentAdmissions={recentAdmissions}
          weeklyAttendance={weeklyAttendance}
          attendanceRange={attendanceRange}
          monthlyCollections={monthlyCollections}
          collectionRange={collectionRange}
        />
      )}
      {tab === 'settings' && (
        <SettingsPanel
          organizationId={organizationId}
          canUpdate={canUpdate}
          canManageLifecycle={canAssignOwner}
          onDone={mutationDone}
        />
      )}
      {tab === 'campuses' && !canReadCampuses && <PermissionDeniedState />}
      {tab === 'campuses' && canReadCampuses && (
        <CampusesPanel
          organizationId={organizationId}
          query={campuses}
          canCreate={canCreateCampuses}
          canUpdate={canUpdateCampuses}
          canChangeStatus={canChangeCampusStatus}
          onDone={mutationDone}
        />
      )}
      {tab === 'members' && !canReadMembers && <PermissionDeniedState />}
      {tab === 'members' && canReadMembers && (
        <MembersPanel
          organizationId={organizationId}
          query={members}
          canManage={canManageMembers}
          canInvite={canInvite}
          canAssignOwner={canAssignOwner}
          campuses={campuses.data?.campuses ?? []}
          onDone={mutationDone}
        />
      )}
      {tab === 'invitations' && !canManageMembers && <PermissionDeniedState />}
      {tab === 'invitations' && canManageMembers && (
        <InvitationsPanel query={invitations} canInvite={canInvite} />
      )}
    </main>
  );
}

function formatPKR(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `Rs ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(amount)}`;
}

function getWeekDays(endDate: string) {
  const anchor = new Date(`${endDate}T12:00:00`);
  const days: Array<{ key: string; label: string; fullLabel: string }> = [];
  for (let daysBack = 6; daysBack >= 0; daysBack -= 1) {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - daysBack);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    days.push({
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      fullLabel: date.toLocaleDateString('en-PK', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }),
    });
  }
  return days;
}

function formatDateShort(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

function formatApplicationStatus(value: ApplicationRecord['status']) {
  const labels: Record<ApplicationRecord['status'], string> = {
    draft: 'Draft',
    submitted: 'Pending',
    in_review: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    admitted: 'Enrolled',
  };
  return labels[value];
}

function OverviewPanel({
  dashboard,
  summary,
  guardians,
  recentAdmissions,
  weeklyAttendance,
  attendanceRange,
  monthlyCollections,
  collectionRange,
}: {
  dashboard: UseQueryResult<OrganizationDashboard>;
  summary: UseQueryResult<{ summary: OrganizationSummary }>;
  guardians: UseQueryResult<GuardianListResponse>;
  recentAdmissions: UseQueryResult<
    Awaited<ReturnType<typeof listApplications>>
  >;
  weeklyAttendance: UseQueryResult<
    Awaited<ReturnType<typeof listStudentAttendance>>
  >;
  attendanceRange: { dateFrom: string; dateTo: string };
  monthlyCollections: UseQueryResult<
    Awaited<ReturnType<typeof listDailyCollections>>
  >;
  collectionRange: { dateFrom: string; dateTo: string };
}) {
  const data = dashboard.data;
  if (dashboard.isPending)
    return <LoadingState message="Loading college overview…" />;
  if (dashboard.isError || !data)
    return (
      <ErrorState
        title="College overview unavailable"
        description="Your college information could not be loaded."
        onRetry={() => void dashboard.refetch()}
      />
    );

  const totals = summary.data?.summary;
  const monthlyCollectionTotal = (monthlyCollections.data?.items ?? []).reduce(
    (sum, item) => sum + item.amountCollected,
    0,
  );
  const weekDays = getWeekDays(attendanceRange.dateTo);
  const attendanceItems = weeklyAttendance.data?.items ?? [];
  const dailyAttendance = weekDays.map((day) => {
    const records = attendanceItems.filter(
      (record) => record.date.slice(0, 10) === day.key,
    );
    const attended = records.filter(
      (record) => record.status === 'present',
    ).length;
    return {
      ...day,
      rate: records.length ? Math.round((attended / records.length) * 100) : 0,
      count: records.length,
    };
  });
  const recordedDays = dailyAttendance.filter((day) => day.count > 0);
  const weeklyRate = recordedDays.length
    ? Math.round(
        recordedDays.reduce((sum, day) => sum + day.rate, 0) /
          recordedDays.length,
      )
    : null;

  return (
    <section
      className="organization-overview admin-dashboard reference-dashboard-preview"
      aria-label="College overview"
    >
      <div className="admin-metrics-grid reference-metrics-grid">
        {[
          {
            label: 'Active students',
            value: totals ? totals.activeStudentCount.toLocaleString('en-PK') : '—',
            detail: 'Currently enrolled learners',
            icon: Users,
          },
          {
            label: 'Staff & teachers',
            value: totals ? totals.activeStaffCount.toLocaleString('en-PK') : '—',
            detail: 'Active college staff',
            icon: GraduationCap,
          },
          {
            label: 'Guardians',
            value: guardians.data ? guardians.data.total.toLocaleString('en-PK') : '—',
            detail: 'Guardian records in your college',
            icon: UserCheck,
          },
          {
            label: 'Monthly collection',
            value: monthlyCollections.isPending || monthlyCollections.isError
              ? '—'
              : formatPKR(monthlyCollectionTotal),
            detail: monthlyCollections.isError
              ? 'Monthly receipts unavailable'
              : `${collectionRange.dateFrom} to ${collectionRange.dateTo}`,
            icon: ReceiptText,
          },
          {
            label: 'Outstanding dues',
            value: formatPKR(totals?.finance.totalPending),
            detail: totals
              ? 'Overdue: ' + formatPKR(totals.finance.totalOverdue)
              : 'Dues load from college finance records',
            icon: WalletCards,
            className: 'admin-metric-card',
          },
          {
            label: 'Today’s attendance',
            value: typeof totals?.attendance.todayAttendanceRate === 'number'
              ? String(totals.attendance.todayAttendanceRate) + '%'
              : '—',
            detail: totals
              ? String(totals.attendance.recordsCount.toLocaleString('en-PK')) + ' attendance records'
              : 'Attendance summary',
            icon: CalendarCheck,
          },
        ].map((metric) => (
          <WorkspaceMetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <div className="admin-overview-bottom reference-dashboard-bottom">
        <section
          aria-labelledby="admin-recent-admissions-title"
          className="admin-activity-panel reference-dashboard-panel"
        >
          <div className="admin-panel-heading reference-panel-heading">
            <div>
              <h2 id="admin-recent-admissions-title">Recent admissions</h2>
              <p>Latest applications received by the college</p>
            </div>
            {data.organization.id && (
              <Link
                className="admin-panel-link reference-view-all"
                to={`/admin/organizations/${encodeURIComponent(data.organization.id)}/admissions`}
              >
                View all <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          {recentAdmissions.isPending ? (
            <LoadingState message="Loading recent applications…" />
          ) : recentAdmissions.isError ? (
            <p className="admin-inline-message" role="status">
              Recent applications are temporarily unavailable.
            </p>
          ) : (recentAdmissions.data?.items.length ?? 0) === 0 ? (
            <div className="admin-inline-empty">
              <span className="admin-inline-empty-mark" aria-hidden="true">
                <GraduationCap size={17} />
              </span>
              <div>
                <strong>No recent applications</strong>
                <p>
                  New applicants will appear here when the college receives
                  them.
                </p>
              </div>
            </div>
          ) : (
            <div className="admin-recent-list reference-activity-list">
              {recentAdmissions.data!.items.slice(0, 3).map((application) => (
                <Link
                  className="admin-recent-row reference-activity-row"
                  key={application.id}
                  to={`/admin/organizations/${encodeURIComponent(data.organization.id)}/admissions/applications/${encodeURIComponent(application.id)}`}
                >
                  <span className="admin-recent-avatar" aria-hidden="true">
                    {(
                      application.firstName.trim().charAt(0) || 'A'
                    ).toUpperCase()}
                    {(
                      application.lastName.trim().charAt(0) || ''
                    ).toUpperCase()}
                  </span>
                  <span className="admin-recent-copy reference-activity-copy">
                    <strong>
                      {application.firstName} {application.lastName}
                    </strong>
                    <small>
                      {application.program || 'Application'} ·{' '}
                      {formatDateShort(application.createdAt)}
                    </small>
                  </span>
                  <span
                    className={`admin-status-pill admin-status-${application.status} reference-status reference-status-${application.status === 'admitted' ? 'enrolled' : application.status === 'approved' ? 'approved' : application.status === 'rejected' ? 'info' : 'pending'}`}
                  >
                    {formatApplicationStatus(application.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section
          aria-labelledby="admin-weekly-attendance-title"
          className="admin-activity-panel admin-attendance-panel reference-dashboard-panel"
        >
          <div className="admin-panel-heading reference-panel-heading">
            <div>
              <h2 id="admin-weekly-attendance-title">Attendance · This week</h2>
              <p>Daily student attendance records</p>
            </div>
          </div>
          {weeklyAttendance.isPending ? (
            <LoadingState message="Loading attendance…" />
          ) : weeklyAttendance.isError ? (
            <p className="admin-inline-message" role="status">
              Weekly attendance is temporarily unavailable.
            </p>
          ) : (
            <>
              <div
                aria-label="Daily student attendance rate for the last seven days"
                className="admin-weekly-bars reference-chart-bars"
                role="img"
              >
                {dailyAttendance.map((day) => (
                  <div
                    className="admin-weekly-day reference-chart-day"
                    key={day.key}
                  >
                    <div
                      className="admin-weekly-track reference-chart-track"
                      title={`${day.fullLabel}: ${day.count ? `${day.rate}% attendance` : 'No records'}`}
                    >
                      <span
                        className="admin-weekly-fill reference-chart-fill"
                        style={{ height: `${day.rate}%` }}
                      />
                    </div>
                    <span className="admin-weekly-label">{day.label}</span>
                  </div>
                ))}
              </div>
              <div className="admin-weekly-summary reference-chart-summary">
                <span
                  className="admin-weekly-summary-dot reference-chart-status-dot"
                  aria-hidden="true"
                />
                {weeklyRate === null
                  ? `No attendance records from ${attendanceRange.dateFrom} to ${attendanceRange.dateTo}`
                  : `${weeklyRate}% average · ${recordedDays.length} day${recordedDays.length === 1 ? '' : 's'} with records`}
              </div>
            </>
          )}
        </section>
      </div>
      {(summary.isError || guardians.isError) && (
        <p className="admin-data-note" role="status">
          Some overview totals are temporarily unavailable. No sample figures
          are being substituted; open the relevant module to review its records.
        </p>
      )}
    </section>
  );
}

function SettingsPanel({
  organizationId,
  canUpdate,
  canManageLifecycle,
  onDone,
}: {
  organizationId: string;
  canUpdate: boolean;
  canManageLifecycle: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const query = useQuery({
    queryKey: ['organization-profile', organizationId],
    queryFn: () => getOrganizationDashboard(organizationId),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateOrganization>[1]) =>
      updateOrganization(organizationId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['organization-profile', organizationId],
      });
      await onDone('Organization settings saved.');
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveOrganization(organizationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['accessible-organizations'],
      });
      navigate('/admin/organizations', { replace: true });
    },
  });
  if (query.isPending) return <LoadingState message="Loading settings…" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title="Settings unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  if (!canUpdate) return <PermissionDeniedState />;
  const organization = query.data.organization;
  return (
    <div className="organization-settings-stack">
      <form
        className="organization-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          save.mutate({
            name: String(form.get('name')),
            contactEmail: String(form.get('contactEmail')) || undefined,
            phone: String(form.get('phone')) || undefined,
            timezone: String(form.get('timezone')) || undefined,
            address: {
              line1: String(form.get('line1') || ''),
              city: String(form.get('city') || ''),
              country: String(form.get('country') || ''),
            },
          });
        }}
      >
        <label>
          Organization name
          <input
            name="name"
            defaultValue={organization.name}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          Contact email
          <input
            name="contactEmail"
            type="email"
            defaultValue={organization.contactEmail ?? ''}
            maxLength={254}
          />
        </label>
        <label>
          Phone
          <input
            name="phone"
            defaultValue={organization.phone ?? ''}
            maxLength={40}
          />
        </label>
        <label>
          Timezone
          <input
            name="timezone"
            defaultValue={organization.timezone ?? 'UTC'}
            maxLength={80}
          />
        </label>
        <label>
          Address
          <input
            name="line1"
            defaultValue={organization.address?.line1 ?? ''}
            maxLength={160}
          />
        </label>
        <label>
          City
          <input
            name="city"
            defaultValue={organization.address?.city ?? ''}
            maxLength={100}
          />
        </label>
        <label>
          Country
          <input
            name="country"
            defaultValue={organization.address?.country ?? ''}
            maxLength={100}
          />
        </label>
        {save.isError && (
          <p role="alert" className="form-error">
            {apiMessage(save.error)}
          </p>
        )}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
      {canManageLifecycle && organization.status === 'active' && (
        <section
          className="organization-danger-zone"
          aria-labelledby="danger-zone-title"
        >
          <div>
            <p className="eyebrow">Danger Zone</p>
            <h2 id="danger-zone-title">Archive organization</h2>
            <p>
              Archiving stops normal organization operations and removes this
              organization from active workspaces. It does not delete data;
              owners can restore it from My Organizations.
            </p>
          </div>
          {archive.isError && (
            <p className="form-error" role="alert">
              {apiMessage(archive.error)}
            </p>
          )}
          <Button
            disabled={archive.isPending}
            onClick={() => setArchiveOpen(true)}
            variant="danger"
          >
            Archive organization
          </Button>
          <Dialog
            description={`Archiving ${organization.name} makes its normal workspace unavailable. Campuses, memberships, invitations, and audit history will be preserved. An owner can restore it later from My Organizations.`}
            onOpenChange={(open) => {
              if (!archive.isPending) setArchiveOpen(open);
            }}
            open={archiveOpen}
            title="Archive organization?"
          >
            <div className="dialog-actions">
              <Button
                disabled={archive.isPending}
                onClick={() => setArchiveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
                variant="danger"
              >
                {archive.isPending ? 'Archiving…' : 'Archive organization'}
              </Button>
            </div>
          </Dialog>
        </section>
      )}
    </div>
  );
}

function CampusesPanel({
  organizationId,
  query,
  canCreate,
  canUpdate,
  canChangeStatus,
  onDone,
}: {
  organizationId: string;
  query: UseQueryResult<{ campuses: Campus[] }>;
  canCreate: boolean;
  canUpdate: boolean;
  canChangeStatus: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
    }) => createCampus(organizationId, input),
    onSuccess: async () => {
      setName('');
      await onDone('Campus created.');
    },
  });
  const save = useMutation({
    mutationFn: ({
      campus,
      status,
    }: {
      campus: Campus;
      status: Campus['status'];
    }) => updateCampus(organizationId, campus.id, { status }),
    onSuccess: () => onDone('Campus status updated.'),
  });
  const rename = useMutation({
    mutationFn: ({ campus, nextName }: { campus: Campus; nextName: string }) =>
      updateCampus(organizationId, campus.id, { name: nextName }),
    onSuccess: () => onDone('Campus details saved.'),
  });
  const updateContact = useMutation({
    mutationFn: ({
      campus,
      changes,
    }: {
      campus: Campus;
      changes: Partial<Campus>;
    }) => updateCampus(organizationId, campus.id, changes),
    onSuccess: () => onDone('Campus contact details saved.'),
  });
  if (query.isPending) return <LoadingState message="Loading campuses…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Campuses unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  const list = query.data?.campuses;
  return (
    <section className="organization-section">
      <div className="section-heading">
        <div>
          <h2>Campuses</h2>
          <p>Manage the locations attached to this organization.</p>
        </div>
      </div>
      {canCreate && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) {
              const form = new FormData(event.currentTarget);
              create.mutate({
                name,
                phone: String(form.get('phone') || '') || undefined,
                email: String(form.get('email') || '') || undefined,
                address: {
                  line1: String(form.get('line1') || ''),
                  city: String(form.get('city') || ''),
                  country: String(form.get('country') || ''),
                },
              });
            }
          }}
        >
          <label htmlFor="campus-name">
            New campus
            <input
              id="campus-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={160}
            />
          </label>
          <label>
            Contact phone
            <input name="phone" maxLength={40} />
          </label>
          <label>
            Contact email
            <input name="email" type="email" maxLength={254} />
          </label>
          <label>
            Address
            <input name="line1" maxLength={160} />
          </label>
          <label>
            City
            <input name="city" maxLength={100} />
          </label>
          <label>
            Country
            <input name="country" maxLength={100} />
          </label>
          <Button type="submit" disabled={create.isPending}>
            Add campus
          </Button>
        </form>
      )}
      {!list?.length ? (
        <EmptyState
          title="No campuses yet"
          description="Add a campus when you are ready to organize locations."
        />
      ) : (
        <div className="organization-list">
          {list.map((campus) => (
            <article key={campus.id} className="organization-row">
              <div>
                <strong>{campus.name}</strong>
                <span>{campus.status}</span>
              </div>
              <div className="member-controls">
                {canUpdate && (
                  <>
                    <input
                      aria-label={`Name for ${campus.name}`}
                      value={edits[campus.id] ?? campus.name}
                      onChange={(event) =>
                        setEdits({ ...edits, [campus.id]: event.target.value })
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() =>
                        rename.mutate({
                          campus,
                          nextName: edits[campus.id] ?? campus.name,
                        })
                      }
                    >
                      Save
                    </Button>
                    <details>
                      <summary>Contact details</summary>
                      <form
                        className="organization-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          updateContact.mutate({
                            campus,
                            changes: {
                              phone:
                                String(form.get('phone') || '') || undefined,
                              email:
                                String(form.get('email') || '') || undefined,
                              address: {
                                line1: String(form.get('line1') || ''),
                                city: String(form.get('city') || ''),
                                country: String(form.get('country') || ''),
                              },
                            },
                          });
                        }}
                      >
                        <label>
                          Phone
                          <input
                            name="phone"
                            defaultValue={campus.phone ?? ''}
                            maxLength={40}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            name="email"
                            type="email"
                            defaultValue={campus.email ?? ''}
                            maxLength={254}
                          />
                        </label>
                        <label>
                          Address
                          <input
                            name="line1"
                            defaultValue={campus.address?.line1 ?? ''}
                            maxLength={160}
                          />
                        </label>
                        <label>
                          City
                          <input
                            name="city"
                            defaultValue={campus.address?.city ?? ''}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Country
                          <input
                            name="country"
                            defaultValue={campus.address?.country ?? ''}
                            maxLength={100}
                          />
                        </label>
                        <Button type="submit">Save contact details</Button>
                      </form>
                    </details>
                  </>
                )}
                {canChangeStatus && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      save.mutate({
                        campus,
                        status:
                          campus.status === 'active' ? 'inactive' : 'active',
                      })
                    }
                  >
                    {campus.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {(create.isError ||
        save.isError ||
        rename.isError ||
        updateContact.isError) && (
        <p role="alert" className="form-error">
          {apiMessage(
            create.error ?? save.error ?? rename.error ?? updateContact.error,
          )}
        </p>
      )}
    </section>
  );
}

function MembersPanel({
  organizationId,
  query,
  canManage,
  canInvite,
  canAssignOwner,
  campuses,
  onDone,
}: {
  organizationId: string;
  query: UseQueryResult<{ members: OrganizationMember[] }>;
  canManage: boolean;
  canInvite: boolean;
  canAssignOwner: boolean;
  campuses: Campus[];
  onDone: (message: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('teacher');
  const [inviteCampusIds, setInviteCampusIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        role: string;
        status: OrganizationMember['status'];
        campusIds: string[];
      }
    >
  >({});
  const invite = useMutation({
    mutationFn: () =>
      inviteMember(organizationId, { email, role, campusIds: inviteCampusIds }),
    onSuccess: async () => {
      setEmail('');
      await onDone('Invitation sent when delivery is available.');
    },
  });
  const save = useMutation({
    mutationFn: ({
      id,
      draft,
    }: {
      id: string;
      draft: {
        role: string;
        status: OrganizationMember['status'];
        campusIds: string[];
      };
    }) => updateMember(organizationId, id, draft),
    onSuccess: () => onDone('Member access updated.'),
  });
  if (query.isPending) return <LoadingState message="Loading members…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Members unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  const list = query.data?.members;
  return (
    <section className="organization-section">
      <div className="section-heading">
        <div>
          <h2>Members</h2>
          <p>
            Membership roles and campus assignments are enforced by the API.
          </p>
        </div>
      </div>
      {canInvite && (
        <form
          className="inline-form member-invite-form"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {ORGANIZATION_ROLES.filter(
                (item) => canAssignOwner || item !== 'organization_owner',
              ).map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          {role === 'campus_admin' && (
            <CampusScopeSelect
              campuses={campuses}
              label="Campus scope for invitation"
              onChange={setInviteCampusIds}
              selectedCampusIds={inviteCampusIds}
            />
          )}
          <Button type="submit" disabled={invite.isPending}>
            Invite member
          </Button>
        </form>
      )}
      {!list?.length ? (
        <EmptyState
          title="No members found"
          description="Active organization members will appear here."
        />
      ) : (
        <div className="organization-list">
          {list.map((member) => {
            const draft = drafts[member.id] ?? {
              role: member.role,
              status: member.status,
              campusIds: member.campusIds,
            };
            return (
              <article key={member.id} className="organization-row member-row">
                <div className="member-identity">
                  <strong>
                    {member.user?.displayName ?? 'Unavailable account'}
                  </strong>
                  <span
                    className="member-email"
                    title={member.user?.email ?? 'Account details unavailable'}
                  >
                    {member.user?.email ?? 'Account details unavailable'}
                  </span>
                  <span className="member-tags">
                    <span className="member-tag member-role-tag">
                      {member.role.replaceAll('_', ' ')}
                    </span>
                    <span
                      className={`member-tag ${member.status === 'active' ? 'member-active-tag' : 'member-inactive-tag'}`}
                    >
                      {member.status}
                    </span>
                  </span>
                </div>
                {canManage && (
                  <div className="member-controls">
                    <select
                      aria-label={`Role for ${member.user?.email ?? member.id}`}
                      value={draft.role}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: { ...draft, role: event.target.value },
                        })
                      }
                    >
                      {ORGANIZATION_ROLES.filter(
                        (item) =>
                          canAssignOwner || item !== 'organization_owner',
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Status for ${member.user?.email ?? member.id}`}
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: {
                            ...draft,
                            status: event.target
                              .value as OrganizationMember['status'],
                          },
                        })
                      }
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="revoked">revoked</option>
                    </select>
                    <CampusScopeSelect
                      campuses={campuses}
                      label={`Campus scope for ${member.user?.email ?? member.id}`}
                      onChange={(campusIds) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: { ...draft, campusIds },
                        })
                      }
                      selectedCampusIds={draft.campusIds}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => save.mutate({ id: member.id, draft })}
                    >
                      Save access
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {(invite.isError || save.isError) && (
        <p role="alert" className="form-error">
          {apiMessage(invite.error ?? save.error)}
        </p>
      )}
    </section>
  );
}

function InvitationsPanel({
  query,
  canInvite,
}: {
  query: UseQueryResult<{ invitations: OrganizationInvitation[] }>;
  canInvite: boolean;
}) {
  if (query.isPending) return <LoadingState message="Loading invitations…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Invitations unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  const list = query.data?.invitations;
  return (
    <section className="organization-section">
      <h2>Pending invitations</h2>
      {canInvite && (
        <p className="muted-copy">Send invitations from the Members section.</p>
      )}
      {!list?.length ? (
        <EmptyState title="No pending invitations" />
      ) : (
        <div className="organization-list">
          {list.map((item) => (
            <article className="organization-row" key={item.id}>
              <div>
                <strong>{item.email}</strong>
                <span>
                  {item.role.replaceAll('_', ' ')} · expires{' '}
                  {new Date(item.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function AcceptOrganizationInvitationPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [error, setError] = useState('');
  const started = useRef(false);
  const token = useMemo(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '',
    [],
  );
  const accept = useMutation({
    mutationFn: acceptOrganizationInvitation,
    onSuccess: (result) => {
      setStatus('done');
      window.history.replaceState(null, '', window.location.pathname);
      navigate(`/admin/organizations/${result.membership.organizationId}`, {
        replace: true,
      });
    },
    onError: (reason) => {
      setStatus('error');
      setError(apiMessage(reason));
    },
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (token) accept.mutate(token);
    else {
      setStatus('error');
      setError('This invitation link is invalid or expired.');
    }
  }, [token]);
  if (status === 'pending')
    return <LoadingState message="Accepting your organization invitation…" />;
  if (status === 'error')
    return (
      <main className="page-stack">
        <ErrorState title="Invitation unavailable" description={error} />
      </main>
    );
  return <LoadingState message="Opening your organization…" />;
}
