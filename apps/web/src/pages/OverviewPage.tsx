import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpenText,
  CalendarCheck,
  Check,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  ReceiptText,
} from 'lucide-react';
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { getApiHealth } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { getAccessibleOrganizations } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { RoleLayoutConfig } from '../layouts/layoutTypes.js';
import { RoleDashboardPreview } from './RoleDashboardPreview.js';
import {
  AccountantLiveDashboard,
  TeacherLiveDashboard,
} from './LiveRoleDashboards.js';

const roleMemberships: Partial<Record<RoleLayoutConfig['key'], string[]>> = {
  admin: [
    'organization_owner',
    'organization_admin',
    'campus_admin',
    'principal_director',
    'academic_coordinator',
  ],
  teacher: ['teacher'],
  accountant: ['accountant_finance_officer'],
  parent: ['parent_guardian'],
  student: ['student'],
};

function roleWorkspacePath(
  role: RoleLayoutConfig['key'],
  organizationId: string,
) {
  if (role === 'admin')
    return `/admin/organizations/${encodeURIComponent(organizationId)}`;
  return `/${role}/organizations/${encodeURIComponent(organizationId)}`;
}

export function OverviewPage() {
  const { role } = useOutletContext<{ role: RoleLayoutConfig }>();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId } = useParams();
  const isDemoPreview =
    import.meta.env.DEV &&
    (organizationId === 'preview' ||
      location.pathname.includes('/organizations/preview'));

  const healthQuery = useQuery({
    queryKey: ['system', 'health'],
    queryFn: getApiHealth,
    enabled: role.key === 'platform',
    retry: false,
  });

  const organizationsQuery = useQuery({
    queryKey: ['accessible-organizations'],
    queryFn: getAccessibleOrganizations,
    enabled: role.key !== 'platform' && !organizationId && !isDemoPreview,
    retry: false,
  });

  const accessQuery = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId!),
    enabled: Boolean(
      organizationId && role.key !== 'platform' && !isDemoPreview,
    ),
    retry: false,
  });

  const allowedRoles = roleMemberships[role.key] ?? [];
  const availableOrganizations = useMemo(
    () =>
      (organizationsQuery.data?.organizations ?? []).filter(
        (organization) =>
          organization.status === 'active' &&
          allowedRoles.includes(organization.role),
      ),
    [organizationsQuery.data, allowedRoles],
  );

  useEffect(() => {
    if (
      !isDemoPreview &&
      !organizationId &&
      role.key !== 'platform' &&
      !organizationsQuery.isPending &&
      !organizationsQuery.isError &&
      availableOrganizations.length === 1
    ) {
      navigate(roleWorkspacePath(role.key, availableOrganizations[0]!.id), {
        replace: true,
      });
    }
  }, [
    availableOrganizations,
    isDemoPreview,
    navigate,
    organizationId,
    organizationsQuery.isError,
    organizationsQuery.isPending,
    role.key,
  ]);

  if (isDemoPreview && role.key !== 'platform') {
    return (
      <RoleDashboardPreview role={role.key} userName={auth.user?.displayName} />
    );
  }

  if (organizationId && role.key !== 'platform') {
    if (accessQuery.isPending)
      return <LoadingState message="Opening your college workspace…" />;
    if (accessQuery.isError || !accessQuery.data)
      return (
        <ErrorState
          title="College workspace unavailable"
          description="We could not confirm your access to this college."
          onRetry={() => void accessQuery.refetch()}
        />
      );
    if (!allowedRoles.includes(accessQuery.data.role))
      return <PermissionDeniedState />;

    if (role.key === 'teacher') {
      return (
        <TeacherLiveDashboard
          organizationId={organizationId}
          userName={auth.user?.displayName}
        />
      );
    }
    if (role.key === 'accountant') {
      return (
        <AccountantLiveDashboard
          organizationId={organizationId}
          userName={auth.user?.displayName}
        />
      );
    }

    const organization = (organizationsQuery.data?.organizations ?? []).find(
      (item) => item.id === organizationId,
    );
    return (
      <main className="page-stack role-dashboard">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{role.label} workspace</p>
            <h1>{role.workspaceTitle}</h1>
            <p className="page-description">
              {organization?.name ?? 'Your college'} · Welcome back,{' '}
              {auth.user?.displayName ?? 'there'}.
            </p>
          </div>
        </section>

        <section className="role-welcome panel">
          <div className="role-welcome-mark" aria-hidden="true">
            <GraduationCap size={24} strokeWidth={1.7} />
          </div>
          <div className="role-welcome-copy">
            <span className="role-kicker">Your workspace</span>
            <h2>{roleDashboardTitle(role.key)}</h2>
            <p>{roleDashboardDescription(role.key)}</p>
          </div>
        </section>

        <section
          aria-label="Your workspace actions"
          className="role-action-grid"
        >
          {getRoleActions(role.key, organizationId).map((action) => {
            const Icon = action.icon;
            return (
              <Link
                className="role-action-card"
                key={action.title}
                to={action.to}
              >
                <span className="role-action-icon">
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="role-action-copy">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowUpRight
                  size={16}
                  aria-hidden="true"
                  className="role-action-arrow"
                />
              </Link>
            );
          })}
        </section>

        <section className="panel role-next-step">
          <div>
            <h2>Keep your work simple</h2>
            <p>
              Open a task above to work with your permitted college records.
              Figures and student information will come from the connected
              college data, not from preview samples.
            </p>
          </div>
          <span className="role-next-step-badge">
            <Check size={14} aria-hidden="true" /> Role-scoped workspace
          </span>
        </section>
      </main>
    );
  }

  return (
    <div
      className={`page-stack role-dashboard${role.key === 'platform' ? ' platform-overview' : ''}`}
    >
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {role.key === 'platform' ? 'InstituteOS platform' : role.label}
          </p>
          <h1>
            {role.key === 'platform'
              ? 'Platform overview'
              : role.workspaceTitle}
          </h1>
          <p className="page-description">
            {role.key === 'platform'
              ? 'Monitor platform service health and available administration tools.'
              : role.description}
          </p>
        </div>
      </section>

      {role.key !== 'platform' && (
        <section className="role-welcome panel">
          <div className="role-welcome-mark" aria-hidden="true">
            <GraduationCap size={24} strokeWidth={1.7} />
          </div>
          <div className="role-welcome-copy">
            <span className="role-kicker">Welcome back</span>
            <h2>
              {auth.user?.displayName
                ? `Good to see you, ${auth.user.displayName.split(' ')[0]}.`
                : 'Welcome to InstituteOS.'}
            </h2>
            <p>
              Choose a college workspace you have already been granted access
              to. Your role and permissions come from that college.
            </p>
          </div>
        </section>
      )}

      {role.key === 'platform' ? (
        <section
          aria-labelledby="system-heading"
          className="panel system-panel"
        >
          <div className="panel-heading">
            <div>
              <h2 id="system-heading">System connection</h2>
              <p>Current status from the InstituteOS API.</p>
            </div>
            {healthQuery.isSuccess && (
              <span className="status-badge status-positive">
                <Check size={14} aria-hidden="true" /> Connected
              </span>
            )}
            {healthQuery.isError && (
              <span className="status-badge status-negative">
                <CircleAlert size={14} aria-hidden="true" /> Unavailable
              </span>
            )}
          </div>
          {healthQuery.isPending && (
            <LoadingState message="Checking API connection…" />
          )}
          {healthQuery.isError && (
            <ErrorState
              title="The API did not respond"
              description="Check that the backend is running, then retry the connection."
              onRetry={() => void healthQuery.refetch()}
            />
          )}
          {healthQuery.data && (
            <div className="connection-detail">
              <span className="connection-dot" aria-hidden="true" />
              <span>{healthQuery.data.service}</span>
              <span className="connection-separator" aria-hidden="true">
                ·
              </span>
              <span>Versioned API</span>
            </div>
          )}
        </section>
      ) : (
        <>
          {organizationsQuery.isPending && (
            <LoadingState message="Loading your college workspaces…" />
          )}
          {organizationsQuery.isError && (
            <ErrorState
              title="Your colleges could not be loaded"
              description="Try again. If the problem continues, contact your college administrator."
              onRetry={() => void organizationsQuery.refetch()}
            />
          )}
          {!organizationsQuery.isPending &&
            !organizationsQuery.isError &&
            availableOrganizations.length === 0 && (
              <EmptyState
                title="No college workspace assigned yet"
                description="When a college owner invites you and grants access, the college will appear here. You do not need to create a new account."
              />
            )}
          {!organizationsQuery.isPending &&
            !organizationsQuery.isError &&
            availableOrganizations.length > 1 && (
              <section
                aria-label="Available college workspaces"
                className="workspace-choice-grid"
              >
                {availableOrganizations.map((organization) => (
                  <article
                    className="workspace-choice-card"
                    key={organization.id}
                  >
                    <div className="workspace-choice-icon" aria-hidden="true">
                      <GraduationCap size={20} />
                    </div>
                    <div className="workspace-choice-copy">
                      <strong>{organization.name}</strong>
                      <span>{organization.role.replaceAll('_', ' ')}</span>
                    </div>
                    <Link
                      className="button button-primary"
                      to={roleWorkspacePath(role.key, organization.id)}
                    >
                      Open workspace{' '}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </section>
            )}
        </>
      )}
    </div>
  );
}

function roleDashboardTitle(role: RoleLayoutConfig['key']) {
  switch (role) {
    case 'teacher':
      return 'Your classes and daily tasks';
    case 'accountant':
      return 'Fees, collections and outstanding dues';
    case 'parent':
      return 'Your child’s college information';
    case 'student':
      return 'Your academic overview';
    default:
      return 'Your college at a glance';
  }
}

function roleDashboardDescription(role: RoleLayoutConfig['key']) {
  switch (role) {
    case 'teacher':
      return 'Open your assigned class to record attendance, enter marks or view relevant messages.';
    case 'accountant':
      return 'Record payments, review outstanding balances and prepare clear reports.';
    case 'parent':
      return 'View only your linked child’s fees, attendance, published results and college messages.';
    case 'student':
      return 'Review your own attendance and published results.';
    default:
      return 'Choose the next task for your current college workspace.';
  }
}

function getRoleActions(role: RoleLayoutConfig['key'], organizationId: string) {
  const base = roleWorkspacePath(role, organizationId);
  switch (role) {
    case 'teacher':
      return [
        {
          title: 'Mark attendance',
          description: 'Open an assigned class and save today’s attendance.',
          to: `${base}/attendance`,
          icon: CalendarCheck,
        },
        {
          title: 'Marks & results',
          description: 'Enter marks or review the exam records you can access.',
          to: `${base}/examinations`,
          icon: ClipboardList,
        },
        {
          title: 'Messages',
          description: 'Review relevant college and parent messages.',
          to: `${base}/communications`,
          icon: BookOpenText,
        },
      ];
    case 'accountant':
      return [
        {
          title: 'Fees & payments',
          description: 'Review dues, record a payment and open its receipt.',
          to: `${base}/finance`,
          icon: ReceiptText,
        },
        {
          title: 'Finance reports',
          description: 'Review collections and outstanding balances.',
          to: `${base}/reports`,
          icon: BarChart3,
        },
      ];
    case 'parent':
      return [
        {
          title: 'Fees & receipts',
          description: 'Check your linked child’s payment status.',
          to: `${base}/fees`,
          icon: ReceiptText,
        },
        {
          title: 'Attendance',
          description: 'Review available attendance information.',
          to: `${base}/attendance`,
          icon: CalendarCheck,
        },
        {
          title: 'Results & messages',
          description: 'View published results and college updates.',
          to: `${base}/results`,
          icon: ClipboardList,
        },
      ];
    case 'student':
      return [
        {
          title: 'Attendance',
          description: 'Review your available attendance records.',
          to: `${base}/attendance`,
          icon: CalendarCheck,
        },
        {
          title: 'Published results',
          description: 'View results released by your college.',
          to: `${base}/results`,
          icon: ClipboardList,
        },
      ];
    default:
      return [
        {
          title: 'College operations',
          description: 'Review the modules available to your role.',
          to: base,
          icon: Activity,
        },
      ];
  }
}
