import { lazy } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
} from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { RouteErrorPage } from '../components/ui/RouteErrorPage.js';
import {
  AccountantLayout,
  AdminLayout,
  ParentLayout,
  PlatformLayout,
  StudentLayout,
  TeacherLayout,
} from '../layouts/RoleLayouts.js';
import { ProtectedRoute } from '../auth/ProtectedRoute.js';

// Route pages are loaded only when a user opens that route. Keeping these
// imports lazy prevents the initial page from downloading every school module.
const ParentPortalPage = lazy(() =>
  import('../pages/ParentPortalPage.js').then((module) => ({
    default: module.ParentPortalPage,
  })),
);
const StudentPortalPage = lazy(() =>
  import('../pages/ParentPortalPage.js').then((module) => ({
    default: module.StudentPortalPage,
  })),
);
const FoundationsPage = lazy(() =>
  import('../pages/FoundationsPage.js').then((module) => ({
    default: module.FoundationsPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage.js').then((module) => ({
    default: module.NotFoundPage,
  })),
);
const OverviewPage = lazy(() =>
  import('../pages/OverviewPage.js').then((module) => ({
    default: module.OverviewPage,
  })),
);
const LandingPage = lazy(() =>
  import('../pages/LandingPage.js').then((module) => ({
    default: module.LandingPage,
  })),
);
const PlatformOverviewPage = lazy(() =>
  import('../pages/PlatformOverviewPage.js').then((module) => ({
    default: module.PlatformOverviewPage,
  })),
);
const WorkspaceRedirectPage = lazy(() =>
  import('../pages/WorkspaceRedirectPage.js').then((module) => ({
    default: module.WorkspaceRedirectPage,
  })),
);
const RoleDemoModulePage = lazy(() =>
  import('../pages/RoleDemoModulePage.js').then((module) => ({
    default: module.RoleDemoModulePage,
  })),
);
const OrganizationContextPage = lazy(() =>
  import('../pages/OrganizationContextPage.js').then((module) => ({
    default: module.OrganizationContextPage,
  })),
);
const AcceptOrganizationInvitationPage = lazy(() =>
  import('../pages/organizations/OrganizationPages.js').then((module) => ({
    default: module.AcceptOrganizationInvitationPage,
  })),
);
const MyOrganizationsPage = lazy(() =>
  import('../pages/organizations/OrganizationPages.js').then((module) => ({
    default: module.MyOrganizationsPage,
  })),
);
const OrganizationAdminPage = lazy(() =>
  import('../pages/organizations/OrganizationPages.js').then((module) => ({
    default: module.OrganizationAdminPage,
  })),
);
const StudentCreatePage = lazy(() =>
  import('../students/StudentPages.js').then((module) => ({
    default: module.StudentCreatePage,
  })),
);
const StudentDetailPage = lazy(() =>
  import('../students/StudentPages.js').then((module) => ({
    default: module.StudentDetailPage,
  })),
);
const StudentEditPage = lazy(() =>
  import('../students/StudentPages.js').then((module) => ({
    default: module.StudentEditPage,
  })),
);
const StudentsListPage = lazy(() =>
  import('../students/StudentPages.js').then((module) => ({
    default: module.StudentsListPage,
  })),
);
const GuardianCreatePage = lazy(() =>
  import('../guardians/GuardianPages.js').then((module) => ({
    default: module.GuardianCreatePage,
  })),
);
const GuardianDetailPage = lazy(() =>
  import('../guardians/GuardianPages.js').then((module) => ({
    default: module.GuardianDetailPage,
  })),
);
const GuardianEditPage = lazy(() =>
  import('../guardians/GuardianPages.js').then((module) => ({
    default: module.GuardianEditPage,
  })),
);
const GuardiansListPage = lazy(() =>
  import('../guardians/GuardianPages.js').then((module) => ({
    default: module.GuardiansListPage,
  })),
);
const AdmissionsListPage = lazy(() =>
  import('../admissions/AdmissionsListPage.js').then((module) => ({
    default: module.AdmissionsListPage,
  })),
);
const ApplicationReviewPage = lazy(() =>
  import('../admissions/ApplicationReviewPage.js').then((module) => ({
    default: module.ApplicationReviewPage,
  })),
);
const AcademicsDashboard = lazy(() =>
  import('../academics/AcademicsDashboard.js').then((module) => ({
    default: module.AcademicsDashboard,
  })),
);
const AttendanceDashboard = lazy(() =>
  import('../attendance/AttendanceDashboard.js').then((module) => ({
    default: module.AttendanceDashboard,
  })),
);
const TeacherStudentsPage = lazy(() =>
  import('../attendance/TeacherStudentsPage.js').then((module) => ({
    default: module.TeacherStudentsPage,
  })),
);
const ExaminationDashboard = lazy(() =>
  import('../examinations/ExaminationDashboard.js').then((module) => ({
    default: module.ExaminationDashboard,
  })),
);
const HomeworkTestsPage = lazy(() =>
  import('../homework/HomeworkTestsPage.js').then((module) => ({
    default: module.HomeworkTestsPage,
  })),
);
const FinanceDashboard = lazy(() =>
  import('../finance/FinanceDashboard.js').then((module) => ({
    default: module.FinanceDashboard,
  })),
);
const FeeConcessionsPage = lazy(() =>
  import('../finance/FeeConcessionsPage.js').then((module) => ({
    default: module.FeeConcessionsPage,
  })),
);
const CommunicationsDashboard = lazy(() =>
  import('../communications/CommunicationsDashboard.js').then((module) => ({
    default: module.CommunicationsDashboard,
  })),
);
const ReportsDashboard = lazy(() =>
  import('../reporting/ReportsDashboard.js').then((module) => ({
    default: module.ReportsDashboard,
  })),
);
const SettingsPage = lazy(() =>
  import('../settings/SettingsPage.js').then((module) => ({
    default: module.SettingsPage,
  })),
);
const StaffCreatePage = lazy(() =>
  import('../staff/StaffPages.js').then((module) => ({
    default: module.StaffCreatePage,
  })),
);
const StaffDetailPage = lazy(() =>
  import('../staff/StaffPages.js').then((module) => ({
    default: module.StaffDetailPage,
  })),
);
const StaffEditPage = lazy(() =>
  import('../staff/StaffPages.js').then((module) => ({
    default: module.StaffEditPage,
  })),
);
const StaffListPage = lazy(() =>
  import('../staff/StaffPages.js').then((module) => ({
    default: module.StaffListPage,
  })),
);
const TeacherTimetablePage = lazy(() =>
  import('../staff/TeacherTimetablePage.js').then((module) => ({
    default: module.TeacherTimetablePage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/auth/AuthPages.js').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const LoginPage = lazy(() =>
  import('../pages/auth/AuthPages.js').then((module) => ({
    default: module.LoginPage,
  })),
);
const RegistrationPage = lazy(() =>
  import('../pages/auth/AuthPages.js').then((module) => ({
    default: module.RegistrationPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/auth/AuthPages.js').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const VerificationPendingPage = lazy(() =>
  import('../pages/auth/AuthPages.js').then((module) => ({
    default: module.VerificationPendingPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import('../pages/auth/AuthPages.js').then((module) => ({
    default: module.VerifyEmailPage,
  })),
);

const roleRoutes: RouteObject[] = [
  {
    path: '/platform',
    element: <PlatformLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <PlatformOverviewPage /> },
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
        element: <Navigate to="/admin/organizations" replace />,
      },
      { path: 'organizations/preview', element: <OverviewPage /> },
      {
        path: 'organizations/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      {
        path: 'organizations/:organizationId/preview/:previewModule',
        element: <RoleDemoModulePage />,
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
        path: 'organizations/:organizationId/homework-tests',
        element: <HomeworkTestsPage />,
      },
      {
        path: 'organizations/:organizationId/finance',
        element: <FinanceDashboard />,
      },
      {
        path: 'organizations/:organizationId/concessions',
        element: <FeeConcessionsPage />,
      },
      {
        path: 'organizations/:organizationId/communications',
        element: <CommunicationsDashboard />,
      },
      {
        path: 'organizations/:organizationId/reports',
        element: <ReportsDashboard />,
      },
      {
        path: 'organizations/:organizationId/settings',
        element: <SettingsPage />,
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
        path: 'organizations/:organizationId/staff/:staffId/timetable',
        element: <TeacherTimetablePage />,
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
      { path: 'organizations/preview', element: <OverviewPage /> },
      {
        path: 'organizations/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      {
        path: 'organizations/:organizationId/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      { path: 'organizations/:organizationId', element: <OverviewPage /> },
      {
        path: 'organizations/:organizationId/students',
        element: <TeacherStudentsPage />,
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
        path: 'organizations/:organizationId/homework-tests',
        element: <HomeworkTestsPage />,
      },
      {
        path: 'organizations/:organizationId/communications',
        element: <CommunicationsDashboard />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/accountant',
    element: <AccountantLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: 'organizations/preview', element: <OverviewPage /> },
      {
        path: 'organizations/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      {
        path: 'organizations/:organizationId/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      { path: 'organizations/:organizationId', element: <OverviewPage /> },
      {
        path: 'organizations/:organizationId/finance',
        element: <FinanceDashboard />,
      },
      {
        path: 'organizations/:organizationId/concessions',
        element: <FeeConcessionsPage />,
      },
      {
        path: 'organizations/:organizationId/reports',
        element: <ReportsDashboard />,
      },
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
      { path: 'organizations/preview', element: <OverviewPage /> },
      {
        path: 'organizations/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      {
        path: 'organizations/:organizationId/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      { path: 'organizations/:organizationId', element: <StudentPortalPage /> },
      {
        path: 'organizations/:organizationId/:section',
        element: <StudentPortalPage />,
      },
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
      { path: 'organizations/preview', element: <OverviewPage /> },
      {
        path: 'organizations/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      {
        path: 'organizations/:organizationId/preview/:previewModule',
        element: <RoleDemoModulePage />,
      },
      { path: 'organizations/:organizationId', element: <ParentPortalPage /> },
      {
        path: 'organizations/:organizationId/:section',
        element: <ParentPortalPage />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
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
      { path: '/dashboard', element: <WorkspaceRedirectPage /> },
      {
        path: '/super-admin',
        element: <PlatformLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <PlatformOverviewPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
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
  { path: '*', element: <Navigate to="/dashboard" replace /> },
];

export function createAppRouter(options?: { initialEntries: string[] }) {
  return options
    ? createMemoryRouter(routes, { initialEntries: options.initialEntries })
    : createBrowserRouter(routes);
}
