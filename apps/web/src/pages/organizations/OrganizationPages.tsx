import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  Plus,
  Eye,
  ReceiptText,
  UserCheck,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import {
  WorkspaceMetricCard,
  WorkspacePageHeading,
  WorkspaceQuickAction,
} from '../../components/ui/WorkspacePrimitives.js';
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
    const records = organizations.data?.organizations ?? [];
    const active = records.filter(
      (organization) => organization.status === 'active',
    );
    const hasArchived = records.some(
      (organization) => organization.status === 'archived',
    );
    if (redirectSingle && active.length === 1 && !hasArchived) {
      navigate('/admin/organizations/' + active[0]!.id, { replace: true });
    }
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
  if (
    redirectSingle &&
    activeOrganizations.length === 1 &&
    archivedOrganizations.length === 0
  )
    return <LoadingState message="Opening your organization…" />;

  return (
    <main className="page-stack organization-admin-page">
      <section className="page-heading organization-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Organizations</h1>
          <p className="page-description">
            Open an organization assigned to your account. Contact your platform
            administrator if you need access.
          </p>
        </div>
      </section>
      {activeOrganizations.length === 0 &&
      archivedOrganizations.length === 0 ? (
        <EmptyState
          title="No organization assigned"
          description="Your account has not been assigned to an organization yet. Contact your InstituteOS platform administrator."
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
  const [searchParams, setSearchParams] = useSearchParams();
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
      <WorkspacePageHeading
        className="organization-heading"
        eyebrow={`Organization workspace · ${access.data.role.replaceAll('_', ' ')}`}
        title="Institute Overview"
        description={`${dashboard.data?.organization.name ?? 'Your college'} · Welcome back, ${auth.user?.displayName ?? 'there'}.`}
      />
      {tab === 'overview' && (
        <nav
          aria-label="College quick actions"
          className="reference-quick-actions"
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
              <WorkspaceQuickAction key={action.label} {...action} />
            ) : (
              <span
                aria-disabled="true"
                className="organization-dashboard-action reference-quick-action is-unavailable"
                key={action.label}
                title={`Your current role does not have permission to: ${action.label.toLowerCase()}.`}
              >
                <Icon size={14} aria-hidden="true" />
                {action.label}
              </span>
            );
          })}
        </nav>
      )}
      <>
        <label className="organization-section-selector">
          <span>Organization section</span>
          <select
            aria-label="Organization section"
            value={tab}
            onChange={(event) => {
              const nextTab = event.target.value as AdminTab;
              setTab(nextTab);
              setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab });
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
                setSearchParams(item === 'overview' ? {} : { tab: item });
                setNotice('');
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </>
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
        <InvitationsPanel
          organizationId={organizationId}
          query={invitations}
          canInvite={canInvite}
        />
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
            value: totals
              ? totals.activeStudentCount.toLocaleString('en-PK')
              : '—',
            detail: 'Currently enrolled learners',
            icon: Users,
          },
          {
            label: 'Staff & teachers',
            value: totals
              ? totals.activeStaffCount.toLocaleString('en-PK')
              : '—',
            detail: 'Active college staff',
            icon: GraduationCap,
          },
          {
            label: 'Guardians',
            value: guardians.data
              ? guardians.data.total.toLocaleString('en-PK')
              : '—',
            detail: 'Guardian records in your college',
            icon: UserCheck,
          },
          {
            label: 'Monthly collection',
            value:
              monthlyCollections.isPending || monthlyCollections.isError
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
          },
          {
            label: 'Today’s attendance',
            value:
              typeof totals?.attendance.todayAttendanceRate === 'number'
                ? String(totals.attendance.todayAttendanceRate) + '%'
                : '—',
            detail: totals
              ? String(totals.attendance.recordsCount.toLocaleString('en-PK')) +
                ' attendance records'
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
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoError, setLogoError] = useState('');
  const query = useQuery({
    queryKey: ['organization-profile', organizationId],
    queryFn: () => getOrganizationDashboard(organizationId),
    retry: false,
  });
  useEffect(() => {
    if (query.data) setLogoDataUrl(query.data.organization.logoDataUrl ?? '');
  }, [query.data]);
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
          setLogoError('');
          save.mutate({
            name: String(form.get('name')),
            adminName: String(form.get('adminName') || '').trim() || undefined,
            shortCode:
              String(form.get('shortCode') || '')
                .trim()
                .toUpperCase() || undefined,
            tagline: String(form.get('tagline') || '').trim() || undefined,
            logoDataUrl,
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
          Organization admin name
          <input
            name="adminName"
            defaultValue={organization.adminName ?? ''}
            placeholder="Person responsible for this institute"
            maxLength={120}
          />
        </label>
        <label>
          Organization short code
          <input
            name="shortCode"
            defaultValue={organization.shortCode ?? ''}
            placeholder="e.g. BFA"
            maxLength={24}
            pattern="[A-Za-z0-9-]+"
            title="Use letters, numbers or hyphens."
          />
        </label>
        <label>
          Tagline
          <input
            name="tagline"
            defaultValue={organization.tagline ?? ''}
            placeholder="A short line about your institution"
            maxLength={180}
          />
        </label>
        <div className="organization-logo-field">
          <span className="organization-logo-label">Organization logo</span>
          <div className="organization-logo-control">
            <div
              className="organization-logo-preview"
              aria-label="Organization logo preview"
            >
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="Organization logo preview" />
              ) : (
                <GraduationCap size={24} aria-hidden="true" />
              )}
            </div>
            <div className="organization-logo-actions">
              <label className="button button-secondary organization-logo-upload">
                Choose image
                <input
                  aria-label="Upload organization logo"
                  accept="image/png,image/jpeg,image/webp"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (
                      !['image/png', 'image/jpeg', 'image/webp'].includes(
                        file.type,
                      )
                    ) {
                      setLogoError('Choose a PNG, JPG or WebP image.');
                      event.target.value = '';
                      return;
                    }
                    if (file.size > 350 * 1024) {
                      setLogoError('Logo must be 350 KB or smaller.');
                      event.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string')
                        setLogoDataUrl(reader.result);
                    };
                    reader.onerror = () =>
                      setLogoError(
                        'Could not read this image. Please try another file.',
                      );
                    reader.readAsDataURL(file);
                    setLogoError('');
                  }}
                />
              </label>
              <span className="organization-logo-help">
                PNG, JPG or WebP · up to 350 KB
              </span>
              {logoDataUrl && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setLogoDataUrl('')}
                >
                  Remove logo
                </Button>
              )}
            </div>
          </div>
          {logoError && (
            <p className="form-error" role="alert">
              {logoError}
            </p>
          )}
        </div>
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
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
    }) => createCampus(organizationId, input),
    onSuccess: async () => {
      setName('');
      setCreateOpen(false);
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
  const list = query.data?.campuses ?? [];
  const selectedCampus = list.find((campus) => campus.id === selectedCampusId);
  return (
    <section className="organization-section campus-management">
      <div className="campus-panel-heading">
        <div>
          <p className="eyebrow">Organization locations</p>
          <h2>Campuses</h2>
          <p>Manage each campus and its contact details in one place.</p>
        </div>
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => setCreateOpen((open) => !open)}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            {createOpen ? 'Cancel' : 'New campus'}
          </Button>
        )}
      </div>
      {createOpen && canCreate && (
        <form
          className="campus-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) {
              const form = new FormData(event.currentTarget);
              create.mutate({
                name: name.trim(),
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
          <div className="campus-form-grid">
            <label htmlFor="campus-name">
              Campus name
              <input
                id="campus-name"
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={160}
              />
            </label>
            <label>
              Contact email
              <input name="email" type="email" maxLength={254} />
            </label>
            <label>
              Contact phone
              <input name="phone" maxLength={40} />
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
          </div>
          {create.isError && (
            <p className="form-error" role="alert">
              {apiMessage(create.error)}
            </p>
          )}
          <div className="campus-form-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Add campus'}
            </Button>
          </div>
        </form>
      )}
      {!list.length ? (
        <EmptyState
          title="No campuses yet"
          description="Create a campus when your organization needs another location."
        />
      ) : (
        <div className="campus-list" aria-label="Organization campuses">
          {list.map((campus) => {
            const location = [
              campus.address?.line1,
              campus.address?.city,
              campus.address?.country,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <article key={campus.id} className="campus-list-row">
                <span className="campus-list-mark" aria-hidden="true">
                  <GraduationCap size={19} />
                </span>
                <div className="campus-list-main">
                  <div className="campus-list-title">
                    <h3>{campus.name}</h3>
                    <span
                      className={`campus-status-pill ${campus.status === 'active' ? 'is-active' : 'is-inactive'}`}
                    >
                      {campus.status}
                    </span>
                  </div>
                  <p className="campus-list-location">
                    <MapPin size={14} aria-hidden="true" />
                    {location || 'Location not added'}
                  </p>
                  <div className="campus-list-contact">
                    {campus.email && (
                      <span>
                        <Mail size={13} aria-hidden="true" />
                        {campus.email}
                      </span>
                    )}
                    {campus.phone && (
                      <span>
                        <Phone size={13} aria-hidden="true" />
                        {campus.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="campus-list-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedCampusId(campus.id)}
                    type="button"
                  >
                    <Eye size={15} aria-hidden="true" />
                    View
                  </Button>
                  {canChangeStatus && (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        save.mutate({
                          campus,
                          status:
                            campus.status === 'active' ? 'inactive' : 'active',
                        })
                      }
                      type="button"
                    >
                      {campus.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {(save.isError || rename.isError || updateContact.isError) && (
        <p role="alert" className="form-error">
          {apiMessage(save.error ?? rename.error ?? updateContact.error)}
        </p>
      )}
      <Dialog
        open={Boolean(selectedCampus)}
        onOpenChange={(open) => {
          if (!open) setSelectedCampusId(null);
        }}
        title={selectedCampus?.name ?? 'Campus details'}
        description="Review campus details and update its name or contact information."
      >
        {selectedCampus && (
          <div className="campus-detail-dialog">
            <div className="campus-detail-summary">
              <span
                className={`campus-status-pill ${selectedCampus.status === 'active' ? 'is-active' : 'is-inactive'}`}
              >
                {selectedCampus.status}
              </span>
              <p>
                <MapPin size={15} aria-hidden="true" />
                {[
                  selectedCampus.address?.line1,
                  selectedCampus.address?.city,
                  selectedCampus.address?.country,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Location not added'}
              </p>
              {selectedCampus.email && (
                <p>
                  <Mail size={15} aria-hidden="true" />
                  {selectedCampus.email}
                </p>
              )}
              {selectedCampus.phone && (
                <p>
                  <Phone size={15} aria-hidden="true" />
                  {selectedCampus.phone}
                </p>
              )}
            </div>
            {canUpdate && (
              <form
                className="campus-edit-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const nextName = String(form.get('name') || '').trim();
                  const changes = {
                    phone: String(form.get('phone') || '') || undefined,
                    email: String(form.get('email') || '') || undefined,
                    address: {
                      line1: String(form.get('line1') || ''),
                      city: String(form.get('city') || ''),
                      country: String(form.get('country') || ''),
                    },
                  };
                  if (nextName && nextName !== selectedCampus.name)
                    rename.mutate({ campus: selectedCampus, nextName });
                  updateContact.mutate({ campus: selectedCampus, changes });
                }}
              >
                <label>
                  Campus name
                  <input
                    name="name"
                    defaultValue={selectedCampus.name}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </label>
                <label>
                  Contact email
                  <input
                    name="email"
                    type="email"
                    defaultValue={selectedCampus.email ?? ''}
                    maxLength={254}
                  />
                </label>
                <label>
                  Contact phone
                  <input
                    name="phone"
                    defaultValue={selectedCampus.phone ?? ''}
                    maxLength={40}
                  />
                </label>
                <label>
                  Address
                  <input
                    name="line1"
                    defaultValue={selectedCampus.address?.line1 ?? ''}
                    maxLength={160}
                  />
                </label>
                <label>
                  City
                  <input
                    name="city"
                    defaultValue={selectedCampus.address?.city ?? ''}
                    maxLength={100}
                  />
                </label>
                <label>
                  Country
                  <input
                    name="country"
                    defaultValue={selectedCampus.address?.country ?? ''}
                    maxLength={100}
                  />
                </label>
                {(rename.isError || updateContact.isError) && (
                  <p role="alert" className="form-error">
                    {apiMessage(rename.error ?? updateContact.error)}
                  </p>
                )}
                <div className="campus-form-actions">
                  <Button
                    type="submit"
                    disabled={rename.isPending || updateContact.isPending}
                  >
                    {rename.isPending || updateContact.isPending
                      ? 'Saving…'
                      : 'Save changes'}
                  </Button>
                </div>
              </form>
            )}
            <div className="dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setSelectedCampusId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
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
                      variant="primary"
                      onClick={() => save.mutate({ id: member.id, draft })}
                      disabled={save.isPending}
                    >
                      Save access
                    </Button>
                    {member.role !== 'organization_owner' &&
                      member.status !== 'revoked' && (
                        <Button
                          variant="secondary"
                          iconOnly
                          type="button"
                          aria-label={`Remove ${member.user?.displayName ?? member.user?.email ?? 'member'} access`}
                          title="Remove member access"
                          disabled={save.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove organization access for ${member.user?.displayName ?? member.user?.email ?? 'this member'}?`,
                              )
                            ) {
                              save.mutate({
                                id: member.id,
                                draft: { ...draft, status: 'revoked' },
                              });
                            }
                          }}
                        >
                          <X size={16} aria-hidden="true" />
                        </Button>
                      )}
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
  organizationId,
  query,
  canInvite,
}: {
  organizationId: string;
  query: UseQueryResult<{ invitations: OrganizationInvitation[] }>;
  canInvite: boolean;
}) {
  const navigate = useNavigate();
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
    <section className="organization-section invitation-management">
      <h2>Pending invitations</h2>
      {canInvite && (
        <div className="invitation-empty-action invitation-empty-action--centered">
          <p className="muted-copy">
            Invite a colleague and set their role and campus access from
            Members.
          </p>
          <Button
            onClick={() =>
              navigate(
                `/admin/organizations/${encodeURIComponent(organizationId)}?tab=members`,
              )
            }
            type="button"
          >
            <UserPlus size={15} aria-hidden="true" />
            Invite member
          </Button>
        </div>
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
