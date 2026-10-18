import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  BarChart3,
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
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import type { RoleLayoutConfig } from '../../layouts/layoutTypes.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { Button } from '../ui/Button.js';

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  queryTab?: string;
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

function getNavigationItems(
  role: RoleLayoutConfig,
  organizationId?: string,
  referencePreview = false,
): NavigationItem[] {
  const base = workspaceBasePath(role, organizationId);
  const items: NavigationItem[] = [
    { label: 'Overview', to: base, icon: LayoutDashboard, end: true },
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
      { label: 'Guardians', to: base + '/guardians', icon: UserCheck },
      { label: 'Teachers / Staff', to: base + '/staff', icon: GraduationCap },
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      {
        label: 'Homework & Tests',
        to: base + '/homework-tests',
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
      { label: 'My classes & students', to: base + '/students', icon: Users },
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      {
        label: 'Homework & Tests',
        to: base + '/homework-tests',
        icon: BookOpenText,
      },
      { label: 'Messages', to: base + '/communications', icon: Megaphone },
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
  const [signOutError, setSignOutError] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId } = useParams();
  const auth = useAuth();
  const isDevelopment = import.meta.env.DEV;
  const isDemoPreview =
    isDevelopment &&
    (organizationId === 'preview' ||
      location.pathname.includes('/organizations/preview'));
  const navigationOrganizationId = isDemoPreview ? 'preview' : organizationId;
  const items = useMemo(
    () => getNavigationItems(role, navigationOrganizationId, isDemoPreview),
    [role, navigationOrganizationId, isDemoPreview],
  );
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
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
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

        <div className="sidebar-label">Workspace</div>
        <nav
          aria-label="Main navigation"
          className="primary-navigation sidebar-navigation-scroll"
          id="main-navigation"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                className={({ isActive }) => {
                  const activeTab = new URLSearchParams(location.search).get(
                    'tab',
                  );
                  const tabMatches = item.queryTab
                    ? activeTab === item.queryTab
                    : !activeTab;
                  return `navigation-link${isActive && tabMatches ? ' navigation-link-active' : ''}`;
                }}
                end={item.end}
                onClick={closeMobileNav}
                to={item.to}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
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
              {(auth.user?.displayName?.trim().charAt(0) || 'U').toUpperCase()}
            </span>
            <span className="current-user-name">
              {auth.user?.displayName ?? 'Signed-in user'}
            </span>
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
              <span>{auth.user?.displayName ?? 'Signed-in user'}</span>
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
              {(auth.user?.displayName?.trim().charAt(0) || 'U').toUpperCase()}
            </span>
            <span className="current-user-name topbar-user-name">
              {auth.user?.displayName ?? 'Signed-in user'}
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
