import { useEffect, useState } from 'react';
import {
  BookOpenText,
  ChevronDown,
  LayoutDashboard,
  Menu,
  X,
  Users,
  UserCheck,
  UserPlus,
  GraduationCap,
  CalendarDays,
} from 'lucide-react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { roleLayouts } from '../../layouts/layoutTypes.js';
import type { RoleLayoutConfig } from '../../layouts/layoutTypes.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { Button } from '../ui/Button.js';

export function AppShell({ role }: { role: RoleLayoutConfig }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId } = useParams();
  const auth = useAuth();
  const signOut = async () => {
    setSignOutError(false);
    try {
      await auth.logout();
      navigate('/login');
    } catch {
      setSignOutError(true);
    }
  };
  const changeRole = (key: string) => navigate(`/${key}`);

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

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        aria-label="Close navigation"
        className="sidebar-overlay"
        hidden={!mobileNavOpen}
        onClick={() => setMobileNavOpen(false)}
        tabIndex={mobileNavOpen ? 0 : -1}
        type="button"
      />
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
        <Link
          aria-label="InstituteOS home"
          className="brand-lockup"
          to={`/${role.key}`}
        >
          <span aria-hidden="true" className="brand-mark">
            I
          </span>
          <span className="brand-name">
            <strong>InstituteOS</strong>
            <small>Education operations</small>
          </span>
        </Link>

        <div className="sidebar-label">Workspace</div>
        <nav
          aria-label="Main navigation"
          className="primary-navigation"
          id="main-navigation"
        >
          <NavLink
            className={({ isActive }) =>
              `navigation-link${isActive && location.pathname === `/${role.key}` ? ' navigation-link-active' : ''}`
            }
            end
            onClick={() => setMobileNavOpen(false)}
            to={`/${role.key}`}
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            <span>Overview</span>
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `navigation-link${isActive ? ' navigation-link-active' : ''}`
            }
            onClick={() => setMobileNavOpen(false)}
            to={`/${role.key}/foundations`}
          >
            <BookOpenText size={18} aria-hidden="true" />
            <span>UI foundations</span>
          </NavLink>
          {role.key === 'admin' && (
            <NavLink
              className={({ isActive }) =>
                `navigation-link${isActive ? ' navigation-link-active' : ''}`
              }
              onClick={() => setMobileNavOpen(false)}
              to="/admin/organizations"
            >
              <LayoutDashboard size={18} aria-hidden="true" />
              <span>Organizations</span>
            </NavLink>
          )}
          {organizationId && (
            <>
              <div className="sidebar-label" style={{ marginTop: '1rem' }}>
                Academic Workspace
              </div>

              <NavLink
                className={({ isActive }) =>
                  `navigation-link${isActive ? ' navigation-link-active' : ''}`
                }
                onClick={() => setMobileNavOpen(false)}
                to={`/admin/organizations/${organizationId }}/students`}
              >
                <Users size={18} aria-hidden="true" />
                <span>Students</span>
              </NavLink>

              <NavLink
                className={({ isActive }) =>
                  `navigation-link${isActive ? ' navigation-link-active' : ''}`
                }
                onClick={() => setMobileNavOpen(false)}
                to={`/admin/organizations/${organizationId}/guardians`}
              >
                <UserCheck size={18} aria-hidden="true" />
                <span>Guardians</span>
              </NavLink>

              <NavLink
                className={({ isActive }) =>
                  `navigation-link${isActive ? ' navigation-link-active' : ''}`
                }
                onClick={() => setMobileNavOpen(false)}
                to={`/admin/organizations/${organizationId}/admissions`}
              >
                <UserPlus size={18} aria-hidden="true" />
                <span>Admissions</span>
              </NavLink>

              <NavLink
                className={({ isActive }) =>
                  `navigation-link${isActive ? ' navigation-link-active' : ''}`
                }
                onClick={() => setMobileNavOpen(false)}
                to={`/admin/organizations/${organizationId}/staff`}
              >
                <GraduationCap size={18} aria-hidden="true" />
                <span>Staff & Teachers</span>
              </NavLink>

              <NavLink
                className={({ isActive }) =>
                  `navigation-link${isActive ? ' navigation-link-active' : ''}`
                }
                onClick={() => setMobileNavOpen(false)}
                to={`/admin/organizations/${organizationId}/academics`}
              >
                <CalendarDays size={18} aria-hidden="true" />
                <span>Academics</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="mobile-account-actions">
          <span className="current-user-name">{auth.user?.displayName}</span>
          <Button
            className="sign-out-button"
            onClick={signOut}
            type="button"
            variant="quiet"
          >
            Sign out
          </Button>
          <label className="role-preview-label" htmlFor="mobile-role-preview">
            Layout preview
          </label>
          <div className="role-preview-select-wrap">
            <select
              id="mobile-role-preview"
              aria-label="Mobile role layout preview"
              className="role-preview-select"
              onChange={(event) => changeRole(event.target.value)}
              value={role.key}
            >
              {roleLayouts.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="select-chevron"
              size={15}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="sidebar-bottom">
          <span className="environment-indicator" aria-hidden="true" />
          <span>Foundation preview</span>
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
              onClick={() => setMobileNavOpen((open) => !open)}
              type="button"
            >
              {mobileNavOpen ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Menu size={20} aria-hidden="true" />
              )}
            </button>
            <Breadcrumbs role={role} />
          </div>
          <div className="topbar-actions">
            <span className="current-user-name">{auth.user?.displayName}</span>
            <Button
              className="sign-out-button"
              onClick={signOut}
              type="button"
              variant="quiet"
            >
              Sign out
            </Button>
            <label className="role-preview-label" htmlFor="role-preview">
              Layout preview
            </label>
            <div className="role-preview-select-wrap">
              <select
                id="role-preview"
                aria-label="Role layout preview"
                className="role-preview-select"
                onChange={(event) => changeRole(event.target.value)}
                value={role.key}
              >
                {roleLayouts.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="select-chevron"
                size={15}
                aria-hidden="true"
              />
            </div>
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
          <span>Application foundation</span>
        </footer>
      </div>
    </div>
  );
}
