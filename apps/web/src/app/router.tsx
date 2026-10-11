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
import { OrganizationContextPage } from '../pages/OrganizationContextPage.js';
import {
  AcceptOrganizationInvitationPage,
  MyOrganizationsPage,
  OrganizationAdminPage,
  OrganizationOnboardingPage,
} from '../pages/organizations/OrganizationPages.js';
import {
  StudentCreatePage,
  StudentDetailPage,
  StudentEditPage,
  StudentsListPage,
} from '../students/StudentPages.js';
import {
  GuardianCreatePage,
  GuardianDetailPage,
  GuardianEditPage,
  GuardiansListPage,
} from '../guardians/GuardianPages.js';
import { AdmissionsListPage } from '../admissions/AdmissionsListPage.js';
import { ApplicationReviewPage } from '../admissions/ApplicationReviewPage.js';
import { AcademicsDashboard } from '../academics/AcademicsDashboard.js';
import { AttendanceDashboard } from '../attendance/AttendanceDashboard.js';
import { ExaminationDashboard } from '../examinations/ExaminationDashboard.js';
import { FinanceDashboard } from '../finance/FinanceDashboard.js';
import {
  StaffCreatePage,
  StaffDetailPage,
  StaffEditPage,
  StaffListPage,
} from '../staff/StaffPages.js';
import { ProtectedRoute } from '../auth/ProtectedRoute.js';
import {
  ForgotPasswordPage,
  LoginPage,
  RegistrationPage,
  ResetPasswordPage,
  VerificationPendingPage,
  VerifyEmailPage,
} from '../pages/auth/AuthPages.js';

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
      { index: true, element: <MyOrganizationsPage redirectSingle /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: 'organizations', element: <MyOrganizationsPage /> },
      {
        path: 'organizations/onboarding',
        element: <OrganizationOnboardingPage />,
      },
      {
        path: 'organizations/:organizationId',
        element: <OrganizationAdminPage />,
      },
      {
        path: 'organizations/:organizationId/admissions',
        element: <AdmissionsListPage />,
      },
      {
        path: 'organizations/:organizationId/academics',
        element: <AcademicsDashboard />,
      },
      {
        path: 'organizations/:organizationId/attendance',
        element: <AttendanceDashboard />,
      },
      {
        path: 'organizations/:organizationId/examinations',
        element: <ExaminationDashboard />,
      },
      {
        path: 'organizations/:organizationId/finance',
        element: <FinanceDashboard />,
      },
      {
        path: 'organizations/:organizationId/admissions/applications/:applicationId',
        element: <ApplicationReviewPage />,
      },
      {
        path: 'organizations/:organizationId/guardians',
        element: <GuardiansListPage />,
      },
      {
        path: 'organizations/:organizationId/guardians/new',
        element: <GuardianCreatePage />,
      },
      {
        path: 'organizations/:organizationId/guardians/:guardianId/edit',
        element: <GuardianEditPage />,
      },
      {
        path: 'organizations/:organizationId/guardians/:guardianId',
        element: <GuardianDetailPage />,
      },
      {
        path: 'organizations/:organizationId/students',
        element: <StudentsListPage />,
      },
      {
        path: 'organizations/:organizationId/students/new',
        element: <StudentCreatePage />,
      },
      {
        path: 'organizations/:organizationId/students/:studentId/edit',
        element: <StudentEditPage />,
      },
      {
        path: 'organizations/:organizationId/students/:studentId',
        element: <StudentDetailPage />,
      },
      {
        path: 'organizations/:organizationId/staff',
        element: <StaffListPage />,
      },
      {
        path: 'organizations/:organizationId/staff/new',
        element: <StaffCreatePage />,
      },
      {
        path: 'organizations/:organizationId/staff/:staffId/edit',
        element: <StaffEditPage />,
      },
      {
        path: 'organizations/:organizationId/staff/:staffId',
        element: <StaffDetailPage />,
      },
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
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegistrationPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/verification-pending', element: <VerificationPendingPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      ...roleRoutes,
      {
        path: '/invitations/accept',
        element: <AcceptOrganizationInvitationPage />,
        errorElement: <RouteErrorPage />,
      },
      {
        path: '/organizations/:organizationId/context',
        element: <OrganizationContextPage />,
        errorElement: <RouteErrorPage />,
      },
    ],
  },
  { path: '*', element: <Navigate to="/platform" replace /> },
];

export function createAppRouter(options?: { initialEntries: string[] }) {
  return options
    ? createMemoryRouter(routes, { initialEntries: options.initialEntries })
    : createBrowserRouter(routes);
}
