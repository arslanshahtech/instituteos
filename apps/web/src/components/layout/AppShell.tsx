import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpenText,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Megaphone,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  UserCheck,
  UserPlus,
  WalletCards,
  X,
} from 'lucide-react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import type { RoleLayoutConfig } from '../../layouts/layoutTypes.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { ApiError } from '../../api/client.js';
import { getOrganizationAccessContext } from '../../tenancy/tenancy-api.js';
import { getTeacherProfile } from '../../attendance/attendance-api.js';
import { getPortalMe } from '../../pages/portal-api.js';
import { getRoleLayout } from '../../layouts/layoutTypes.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../ui/States.js';
import { Button } from '../ui/Button.js';

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  queryTab?: string;
  children?: NavigationItem[];
}

const previewRoleOptions = [
  { key: 'admin', label: 'Admin' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'parent', label: 'Parent' },
  { key: 'accountant', label: 'Accountant' },
] as const;

function workspaceBasePath(role: RoleLayoutConfig, organizationId?: string) {
  if (!organizationId) return `/${role.key}`;
  return role.key === 'admin'
    ? `/admin/organizations/${encodeURIComponent(organizationId)}`
    : `/${role.key}/organizations/${encodeURIComponent(organizationId)}`;
}

function workspaceKeyForMembershipRole(
  membershipRole: string,
): RoleLayoutConfig['key'] | null {
  if (
    [
      'organization_owner',
      'organization_admin',
      'campus_admin',
      'principal_director',
      'academic_coordinator',
    ].includes(membershipRole)
  )
    return 'admin';
  if (membershipRole === 'teacher') return 'teacher';
  if (membershipRole === 'accountant_finance_officer') return 'accountant';
  if (membershipRole === 'parent_guardian') return 'parent';
  if (membershipRole === 'student') return 'student';
  return null;
}

function getNavigationItems(
  role: RoleLayoutConfig,
  organizationId?: string,
  referencePreview = false,
): NavigationItem[] {
  const base = workspaceBasePath(role, organizationId);
  const items: NavigationItem[] = [
    { label: 'Dashboard', to: base, icon: LayoutDashboard, end: true },
  ];

  if (!organizationId) {
    if (role.key === 'admin') {
      items.push({
        label: 'Your colleges',
        to: '/admin/organizations',
        icon: GraduationCap,
      });
    }
    return items;
  }

  if (referencePreview) {
    if (role.key === 'admin') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        { label: 'Guardians', to: base + '/guardians', icon: UserCheck },
        { label: 'Teachers / Staff', to: base + '/staff', icon: GraduationCap },
        { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Admissions', to: base + '/admissions', icon: UserPlus },
        { label: 'Finance', to: base + '/finance', icon: WalletCards },
        { label: 'Concessions', to: base + '/concessions', icon: ReceiptText },
        { label: 'Messages', to: base + '/communications', icon: Megaphone },
        { label: 'Reports & Export', to: base + '/reports', icon: BarChart3 },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'teacher') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Messages', to: base + '/communications', icon: Megaphone },
        { label: 'Reports & Export', to: base + '/reports', icon: BarChart3 },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'accountant') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        { label: 'Finance', to: base + '/finance', icon: WalletCards },
        { label: 'Concessions', to: base + '/concessions', icon: ReceiptText },
        { label: 'Reports & Export', to: base + '/reports', icon: BarChart3 },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'parent') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
        { label: 'Messages', to: base + '/messages', icon: Megaphone },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'student') {
      items.push(
        { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Results', to: base + '/results', icon: ClipboardList },
        { label: 'Messages', to: base + '/messages', icon: Megaphone },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    }
    return items;
  }

  // Only expose routes that are implemented for the signed-in live workspace.
  // Similar-looking demo routes are deliberately confined to referencePreview.
  if (role.key === 'admin') {
    items.push(
      { label: 'Students', to: base + '/students', icon: Users },
      {
        label: 'Curriculum',
        to: base + '/academics',
        icon: BookOpenText,
        children: [
          {
            label: 'Sessions',
            to: base + '/academics?tab=curriculum-sessions',
            icon: BookOpenText,
            queryTab: 'curriculum-sessions',
          },
          {
            label: 'Classes',
            to: base + '/academics?tab=curriculum-classes',
            icon: GraduationCap,
            queryTab: 'curriculum-classes',
          },
          {
            label: 'Sections',
            to: base + '/academics?tab=curriculum-sections',
            icon: Users,
            queryTab: 'curriculum-sections',
          },
          {
            label: 'Subjects',
            to: base + '/academics?tab=curriculum-subjects',
            icon: ClipboardList,
            queryTab: 'curriculum-subjects',
          },
        ],
      },
      {
        label: 'Timetable',
        to: base + '/academics?tab=timetable',
        icon: ClipboardCheck,
        queryTab: 'timetable',
      },
      { label: 'Guardians', to: base + '/guardians', icon: UserCheck },
      { label: 'Teachers / Staff', to: base + '/staff', icon: GraduationCap },
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      {
        label: 'Homework & Tests',
        to: base + '/homework-tests',
        icon: BookOpenText,
      },
      {
        label: 'Examinations',
        to: base + '/examinations',
        icon: ClipboardList,
      },
      { label: 'Admissions', to: base + '/admissions', icon: UserPlus },
      { label: 'Finance', to: base + '/finance', icon: WalletCards },
      { label: 'Concessions', to: base + '/concessions', icon: ReceiptText },
      { label: 'Messages', to: base + '/communications', icon: Megaphone },
      { label: 'Reports & Export', to: base + '/reports', icon: BarChart3 },
      { label: 'Settings', to: base + '/settings', icon: Settings2 },
      { label: 'My Profile', to: base + '/profile', icon: UserCheck },
    );
  } else if (role.key === 'teacher') {
    items.push(
      { label: 'My classes & students', to: base + '/students', icon: Users },
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      {
        label: 'Homework & Tests',
        to: base + '/homework-tests',
        icon: BookOpenText,
      },
      {
        label: 'Examinations & Marks',
        to: base + '/examinations',
        icon: ClipboardList,
      },
      { label: 'Messages', to: base + '/communications', icon: Megaphone },
      { label: 'Settings', to: base + '/settings', icon: Settings2 },
    );
  } else if (role.key === 'accountant') {
    items.push(
      { label: 'Finance', to: base + '/finance', icon: WalletCards },
      { label: 'Concessions', to: base + '/concessions', icon: ReceiptText },
      { label: 'Reports & Export', to: base + '/reports', icon: BarChart3 },
    );
  } else if (role.key === 'parent') {
    items.push(
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
      { label: 'Results', to: base + '/results', icon: ClipboardList },
      { label: 'Messages', to: base + '/messages', icon: Megaphone },
      { label: 'Settings', to: base + '/settings', icon: Settings2 },
    );
  } else if (role.key === 'student') {
    items.push(
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
      { label: 'Results', to: base + '/results', icon: ClipboardList },
      { label: 'Messages', to: base + '/messages', icon: Megaphone },
    );
  }

  return items;
}

export function AppShell({ role }: { role: RoleLayoutConfig }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      window.localStorage.getItem('instituteos-sidebar-collapsed') === 'true',
  );
  const [signOutError, setSignOutError] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [curriculumExpanded, setCurriculumExpanded] = useState(
    () =>
      new URLSearchParams(window.location.search)
        .get('tab')
        ?.startsWith('curriculum-') ?? false,
  );
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const activeTab = new URLSearchParams(location.search).get('tab');
    setCurriculumExpanded(activeTab?.startsWith('curriculum-') ?? false);
  }, [location.pathname, location.search]);
  const { organizationId } = useParams();
  const auth = useAuth();
  const isDevelopment = import.meta.env.DEV;
  const isDemoPreview =
    isDevelopment &&
    (organizationId === 'preview' ||
      location.pathname.includes('/organizations/preview'));
  const navigationOrganizationId = isDemoPreview ? 'preview' : organizationId;
  const organizationAccess = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId!),
    enabled: Boolean(
      organizationId && !isDemoPreview && role.key !== 'platform',
    ),
    retry: false,
    staleTime: 30_000,
  });
  const teacherProfile = useQuery({
    queryKey: ['teacher-profile', organizationId],
    queryFn: () => getTeacherProfile(organizationId!),
    enabled: Boolean(
      organizationId &&
      role.key === 'teacher' &&
      organizationAccess.data?.role === 'teacher',
    ),
    retry: false,
  });
  const parentPortal = useQuery({
    queryKey: ['portal-me', organizationId],
    queryFn: () => getPortalMe(organizationId!),
    enabled: Boolean(
      organizationId &&
      role.key === 'parent' &&
      organizationAccess.data?.role === 'parent_guardian',
    ),
    retry: false,
  });
  const workspaceDisplayName =
    (role.key === 'teacher'
      ? teacherProfile.data?.profile?.displayName
      : undefined) ||
    (role.key === 'parent'
      ? parentPortal.data?.guardian?.displayName
      : undefined) ||
    auth.user?.displayName ||
    'Signed-in user';
  const authorizedRoleKey = organizationAccess.data
    ? workspaceKeyForMembershipRole(organizationAccess.data.role)
    : null;
  const roleMismatch = Boolean(
    organizationId &&
    !isDemoPreview &&
    role.key !== 'platform' &&
    authorizedRoleKey &&
    authorizedRoleKey !== role.key,
  );
  const items = useMemo(
    () => getNavigationItems(role, navigationOrganizationId, isDemoPreview),
    [role, navigationOrganizationId, isDemoPreview],
  );
  const navigationGroups = useMemo(() => {
    const sectionFor = (label: string) => {
      if (label === 'Overview' || label === 'Dashboard') return 'Overview';
      if (
        [
          'Curriculum',
          'Timetable',
          'Homework & Tests',
          'Examinations',
          'Examinations & Marks',
        ].includes(label)
      )
        return 'Academics';
      if (
        [
          'Students',
          'My classes & students',
          'Guardians',
          'Teachers / Staff',
          'Admissions',
          'Your colleges',
        ].includes(label)
      )
        return 'People';
      if (label === 'Attendance') return 'Attendance & Leaves';
      if (['Finance', 'Fees & receipts', 'Concessions'].includes(label))
        return 'Finance';
      if (label === 'Reports & Export' || label === 'Results')
        return 'Accounting & Reports';
      if (label === 'Messages') return 'Communication';
      if (label === 'Settings' || label === 'My Profile') return 'System';
      return 'Workspace';
    };
    const groups = new Map<string, NavigationItem[]>();
    for (const item of items) {
      const section = sectionFor(item.label);
      const group = groups.get(section) ?? [];
      group.push(item);
      groups.set(section, group);
    }
    const sectionOrder = [
      'Overview',
      'Academics',
      'People',
      'Attendance & Leaves',
      'Finance',
      'Accounting & Reports',
      'Communication',
      'System',
      'Workspace',
    ];
    return [...groups.entries()]
      .sort(
        ([left], [right]) =>
          sectionOrder.indexOf(left) - sectionOrder.indexOf(right),
      )
      .map(([label, groupItems]) => ({ label, items: groupItems }));
  }, [items]);
  const homePath = workspaceBasePath(role, navigationOrganizationId);
  const searchResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) return items.slice(0, 5);
    const normalizedQuery =
      query === 'fees' || query === 'fee' ? 'finance' : query;
    return items
      .filter((item) => item.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [globalQuery, items]);
  const quickActions = useMemo(() => {
    const base = homePath;
    const preview = isDemoPreview;
    if (role.key === 'admin')
      return [
        {
          label: 'Add Student',
          to: base + (preview ? '/students' : '/students/new'),
        },
        { label: 'Collect Fee', to: base + '/finance' },
        { label: 'Mark Attendance', to: base + '/attendance' },
        { label: 'Generate Report', to: base + '/reports' },
      ];
    if (role.key === 'teacher')
      return [
        {
          label: 'My classes & students',
          to: base + (preview ? '/students' : '/students'),
        },
        { label: 'Mark Attendance', to: base + '/attendance' },
        {
          label: 'Homework & Tests',
          to: base + (preview ? '/homework' : '/homework-tests'),
        },
        { label: 'Examinations & Marks', to: base + '/examinations' },
        { label: 'Messages', to: base + '/communications' },
      ];
    if (role.key === 'accountant')
      return [
        { label: 'Collect Fee', to: base + '/finance' },
        {
          label: 'Concessions',
          to: base + '/concessions',
        },
        { label: 'Generate Report', to: base + '/reports' },
      ];
    if (role.key === 'parent')
      return [
        { label: 'View Attendance', to: base + '/attendance' },
        { label: 'Fees & receipts', to: base + '/fees' },
        { label: 'Messages', to: base + '/messages' },
      ];
    return isDemoPreview
      ? [
          { label: 'Attendance', to: base + '/attendance' },
          { label: 'Results', to: base + '/results' },
        ]
      : [];
  }, [homePath, isDemoPreview, role.key]);

  const changePreviewRole = (
    nextRole: (typeof previewRoleOptions)[number]['key'],
  ) => {
    navigate(`/${nextRole}/organizations/preview?preview=demo`);
    setMobileNavOpen(false);
    setQuickActionsOpen(false);
    setSearchOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(
        'instituteos-sidebar-collapsed',
        String(next),
      );
      return next;
    });
  };

  const closeMobileNav = () => {
    if (mobileNavOpen) setMobileNavOpen(false);
  };

  const signOut = async () => {
    setSignOutError(false);
    try {
      await auth.logout();
      navigate('/login');
    } catch {
      setSignOutError(true);
    }
  };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const isLiveOrganizationWorkspace = Boolean(
    organizationId && !isDemoPreview && role.key !== 'platform',
  );

  if (isLiveOrganizationWorkspace && organizationAccess.isPending)
    return (
      <main className="auth-bootstrap">
        <LoadingState message="Verifying your institute workspace access…" />
      </main>
    );

  if (isLiveOrganizationWorkspace && organizationAccess.isError) {
    if (
      organizationAccess.error instanceof ApiError &&
      organizationAccess.error.status === 404
    )
      return <Navigate to="/dashboard" replace />;

    if (
      organizationAccess.error instanceof ApiError &&
      [401, 403].includes(organizationAccess.error.status)
    )
      return (
        <main className="auth-bootstrap">
          <PermissionDeniedState
            title="Workspace access unavailable"
            description="Your account does not have active access to this institute workspace. Ask the institute owner to check your membership."
          />
          <p>
            <Link to="/dashboard">Return to your assigned workspace</Link>
          </p>
        </main>
      );

    return (
      <main className="auth-bootstrap">
        <ErrorState
          title="Unable to verify workspace access"
          description="The institute access service could not be reached. No workspace data has been opened. Please try again."
          onRetry={() => void organizationAccess.refetch()}
        />
      </main>
    );
  }

  if (
    isLiveOrganizationWorkspace &&
    organizationAccess.data &&
    !authorizedRoleKey
  )
    return (
      <main className="auth-bootstrap">
        <PermissionDeniedState
          title="Workspace role not supported"
          description="This account has an organization role that is not assigned to a supported workspace. Contact the institute owner."
        />
      </main>
    );

  if (isLiveOrganizationWorkspace && roleMismatch && authorizedRoleKey)
    return (
      <Navigate
        to={workspaceBasePath(getRoleLayout(authorizedRoleKey), organizationId)}
        replace
      />
    );

  return (
    <div
      className={`app-frame${isDemoPreview ? ' app-frame-demo-preview' : ''}${isLiveOrganizationWorkspace ? ' app-frame-live-organization' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        aria-label="Close navigation"
        className="sidebar-overlay"
        hidden={!mobileNavOpen}
        onClick={closeMobileNav}
        tabIndex={mobileNavOpen ? 0 : -1}
        type="button"
      />
      <aside
        className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
      >
        <Link
          aria-label="InstituteOS home"
          className="brand-lockup"
          to={homePath}
        >
          <span aria-hidden="true" className="brand-mark">
            I
          </span>
          <span className="brand-name">
            <strong>InstituteOS</strong>
            <small>College management</small>
          </span>
        </Link>

        <div className="sidebar-heading-row">
          <div className="sidebar-label">Workspace</div>
          <button
            className="sidebar-collapse-button"
            type="button"
            onClick={toggleSidebar}
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>
        <nav
          aria-label="Main navigation"
          className="primary-navigation sidebar-navigation-scroll"
          id="main-navigation"
        >
          {navigationGroups.map((group) => (
            <div className="navigation-group" key={group.label}>
              <div className="navigation-group-heading">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="navigation-item-group" key={item.label}>
                    <div className="navigation-parent-row">
                      <NavLink
                        key={item.label}
                        aria-expanded={
                          item.children ? curriculumExpanded : undefined
                        }
                        className={({ isActive }) => {
                          const activeTab = new URLSearchParams(
                            location.search,
                          ).get('tab');
                          const tabMatches = item.children
                            ? !activeTab
                            : item.queryTab
                              ? activeTab === item.queryTab
                              : !activeTab;
                          const pathMatches = item.children
                            ? location.pathname ===
                              new URL(item.to, window.location.origin).pathname
                            : item.queryTab
                              ? true
                              : isActive;
                          return `navigation-link${item.children ? ' navigation-parent-toggle' : ''}${pathMatches && tabMatches ? ' navigation-link-active' : ''}`;
                        }}
                        end={item.end}
                        onClick={
                          item.children
                            ? (event) => {
                                event.preventDefault();
                                setCurriculumExpanded((expanded) => !expanded);
                              }
                            : closeMobileNav
                        }
                        title={sidebarCollapsed ? item.label : undefined}
                        to={item.to}
                      >
                        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.children && (
                          <ChevronDown
                            className="navigation-expand-icon"
                            size={15}
                            aria-hidden="true"
                          />
                        )}
                      </NavLink>
                    </div>
                    {item.children &&
                      curriculumExpanded &&
                      item.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink
                            key={child.label}
                            className={({ isActive }) => {
                              const activeTab = new URLSearchParams(
                                location.search,
                              ).get('tab');
                              return `navigation-link navigation-sublink${isActive && activeTab === child.queryTab ? ' navigation-sublink-active' : ''}`;
                            }}
                            onClick={() => {
                              setCurriculumExpanded(true);
                              closeMobileNav();
                            }}
                            title={sidebarCollapsed ? child.label : undefined}
                            to={child.to}
                          >
                            <ChildIcon
                              size={16}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {isDevelopment && !isDemoPreview && role.key !== 'platform' && (
          <Link
            className="navigation-link reference-preview-link"
            onClick={closeMobileNav}
            to={`/${role.key}/organizations/preview?preview=demo`}
          >
            <LayoutDashboard size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>Open reference UI preview</span>
          </Link>
        )}

        <div className="mobile-account-actions">
          <div className="account-identity">
            <span className="user-avatar" aria-hidden="true">
              {(workspaceDisplayName.trim().charAt(0) || 'U').toUpperCase()}
            </span>
            <span className="current-user-name">{workspaceDisplayName}</span>
          </div>
          <Button
            className="sign-out-button"
            onClick={signOut}
            type="button"
            variant="quiet"
          >
            Sign out
          </Button>
        </div>

        <div className="sidebar-bottom">
          <span className="environment-indicator" aria-hidden="true" />
          <span>{role.label}</span>
          {role.key !== 'platform' && (
            <ShieldCheck size={14} aria-label="Role-based workspace" />
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              aria-controls="main-navigation"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              className="mobile-menu-button button button-quiet button-icon"
              onClick={(event) => {
                event.stopPropagation();
                setMobileNavOpen((open) => !open);
              }}
              type="button"
            >
              {mobileNavOpen ? (
                <X size={19} aria-hidden="true" />
              ) : (
                <Menu size={19} aria-hidden="true" />
              )}
            </button>
            <div className="mobile-workspace-identity">
              <strong>{role.label}</strong>
              <span>{workspaceDisplayName}</span>
            </div>
          </div>

          <div className="topbar-actions">
            {isDevelopment && isDemoPreview && (
              <div
                className="role-switcher"
                role="group"
                aria-label="Sample-data design preview role"
              >
                <span className="role-switcher-label">Sample preview</span>
                {previewRoleOptions.map((option) => (
                  <button
                    aria-pressed={role.key === option.key && isDemoPreview}
                    className={`role-switcher-option${role.key === option.key && isDemoPreview ? ' is-active' : ''}`}
                    key={option.key}
                    onClick={() => changePreviewRole(option.key)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <div className="global-search-wrap">
              <form
                aria-label="Find a workspace section"
                className="global-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (searchResults[0]) {
                    navigate(searchResults[0].to);
                    setSearchOpen(false);
                  }
                }}
                role="search"
              >
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label="Search workspace sections and modules"
                  autoComplete="off"
                  onBlur={() =>
                    window.setTimeout(() => setSearchOpen(false), 120)
                  }
                  onChange={(event) => {
                    setGlobalQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchOpen(false);
                  }}
                  placeholder="Search sections and modules..."
                  value={globalQuery}
                />
                <kbd>⌘ K</kbd>
              </form>
              {searchOpen && (
                <div
                  className="global-search-popover"
                  role="listbox"
                  aria-label="Available sections"
                >
                  {searchResults.length ? (
                    searchResults.map((item) => (
                      <Link
                        className="global-search-result"
                        key={item.label}
                        onClick={() => {
                          setSearchOpen(false);
                          setGlobalQuery('');
                        }}
                        role="option"
                        to={item.to}
                      >
                        <span>{item.label}</span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    ))
                  ) : (
                    <p className="global-search-empty">
                      No matching sections in this workspace.
                    </p>
                  )}
                  <p className="global-search-hint">
                    Choose a section to search its records.
                  </p>
                </div>
              )}
            </div>
            <div className="topbar-quick-actions">
              <button
                aria-label="Open quick actions"
                aria-expanded={quickActionsOpen}
                className="topbar-add-button"
                onClick={() => {
                  setQuickActionsOpen((open) => !open);
                  setSearchOpen(false);
                }}
                type="button"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
              {quickActionsOpen && (
                <div
                  className="quick-actions-popover"
                  aria-label="Quick actions"
                >
                  {quickActions.map((action) => (
                    <Link
                      className="quick-action-option"
                      key={action.label}
                      onClick={() => setQuickActionsOpen(false)}
                      to={action.to}
                    >
                      <Plus size={13} aria-hidden="true" />
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <span className="user-avatar topbar-user-avatar" aria-hidden="true">
              {(workspaceDisplayName.trim().charAt(0) || 'U').toUpperCase()}
            </span>
            <span className="current-user-name topbar-user-name">
              {workspaceDisplayName}
            </span>
            <Button
              className="sign-out-button"
              onClick={signOut}
              type="button"
              variant="quiet"
            >
              Sign out
            </Button>
          </div>
          {signOutError && (
            <span className="visually-hidden" role="alert">
              Sign out failed. Please try again.
            </span>
          )}
        </header>

        <main className="main-content" id="main-content" tabIndex={-1}>
          <Outlet context={{ role }} />
        </main>
        <footer className="app-footer">
          <span>InstituteOS</span>
          <span>College operations · Punjab, Pakistan</span>
        </footer>
      </div>
    </div>
  );
}
