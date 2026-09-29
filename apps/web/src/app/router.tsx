import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
} from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { RouteErrorPage } from '../components/ui/RouteErrorPage.js';
import {
  AdminLayout,
  ParentLayout,
  PlatformLayout,
  StudentLayout,
  TeacherLayout,
} from '../layouts/RoleLayouts.js';
import { FoundationsPage } from '../pages/FoundationsPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { OverviewPage } from '../pages/OverviewPage.js';

const roleRoutes: RouteObject[] = [
  {
    path: '/platform',
    element: <PlatformLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/teacher',
    element: <TeacherLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/student',
    element: <StudentLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/parent',
    element: <ParentLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/platform" replace /> },
  ...roleRoutes,
  { path: '*', element: <Navigate to="/platform" replace /> },
];

export function createAppRouter(options?: { initialEntries: string[] }) {
  return options
    ? createMemoryRouter(routes, { initialEntries: options.initialEntries })
    : createBrowserRouter(routes);
}
