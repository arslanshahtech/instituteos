import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from './app/providers.js';
import { createAppRouter } from './app/router.js';
import { queryClient } from './app/query-client.js';
import { ApiError, getApiHealth } from './api/client.js';
import { loginRequest, logoutRequest } from './auth/auth-api.js';

const authMocks = vi.hoisted(() => ({
  user: {
    id: 'user-test-id',
    email: 'user@example.test',
    displayName: 'Institute User',
    status: 'active' as const,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  getCurrentUser: vi.fn(),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  registerRequest: vi.fn(),
  resendVerificationRequest: vi.fn(),
  forgotPasswordRequest: vi.fn(),
  resetPasswordRequest: vi.fn(),
  verifyEmailRequest: vi.fn(),
}));

const tenancyMocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
}));

const dashboardDataMocks = vi.hoisted(() => ({
  listApplications: vi.fn(),
  listStudentAttendance: vi.fn(),
  listFamilyContacts: vi.fn(),
  listDailyCollections: vi.fn(),
}));

const platformMocks = vi.hoisted(() => ({
  getPlatformOrganizations: vi.fn(),
  getPlatformDemoRequests: vi.fn(),
  createPlatformOrganization: vi.fn(),
}));

const organizationMocks = vi.hoisted(() => ({
  getAccessibleOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  archiveOrganization: vi.fn(),
  restoreOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  getOrganizationDashboard: vi.fn(),
  getOrganizationProfile: vi.fn(),
  updateOrganization: vi.fn(),
  getCampuses: vi.fn(),
  createCampus: vi.fn(),
  updateCampus: vi.fn(),
  getMembers: vi.fn(),
  updateMember: vi.fn(),
  getInvitations: vi.fn(),
  inviteMember: vi.fn(),
  acceptOrganizationInvitation: vi.fn(),
  ORGANIZATION_ROLES: [
    'organization_owner',
    'organization_admin',
    'campus_admin',
    'principal_director',
    'academic_coordinator',
    'teacher',
    'accountant_finance_officer',
    'admissions_reception',
    'student',
    'parent_guardian',
  ],
  ORGANIZATION_PERMISSIONS: [
    'organization.read',
    'organization.update',
    'campus.read',
    'campus.create',
    'campus.update',
    'campus.status.update',
    'member.read',
    'member.invite',
    'member.manage',
    'student.read',
    'student.create',
    'student.update',
    'guardian.read',
    'guardian.create',
    'guardian.update',
    'staff.read',
    'staff.create',
    'staff.update',
    'admission.read',
    'admission.create',
    'admission.review',
    'academics.read',
    'academics.write',
    'attendance.read',
    'attendance.write',
    'examination.read',
    'examination.write',
    'finance.read',
    'finance.write',
    'communication.read',
    'communication.write',
    'reporting.read',
    'audit.read',
  ],
}));

vi.mock('./api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client.js')>();
  return {
    ...actual,
    getApiHealth: vi.fn().mockResolvedValue({
      status: 'ok',
      service: 'instituteos-api',
      timestamp: '2026-01-01T00:00:00.000Z',
    }),
  };
});

vi.mock('./auth/auth-api.js', () => authMocks);
vi.mock('./tenancy/tenancy-api.js', () => tenancyMocks);
vi.mock('./organizations/organizations-api.js', () => organizationMocks);
vi.mock('./pages/platform-api.js', () => platformMocks);
vi.mock('./admissions/admissions-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./admissions/admissions-api.js')>();
  return { ...actual, listApplications: dashboardDataMocks.listApplications };
});
vi.mock('./attendance/attendance-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./attendance/attendance-api.js')>();
  return {
    ...actual,
    listStudentAttendance: dashboardDataMocks.listStudentAttendance,
  };
});
vi.mock('./families/family-contacts-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./families/family-contacts-api.js')>();
  return {
    ...actual,
    listFamilyContacts: dashboardDataMocks.listFamilyContacts,
  };
});
vi.mock('./finance/finance-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./finance/finance-api.js')>();
  return {
    ...actual,
    listDailyCollections: dashboardDataMocks.listDailyCollections,
  };
});

function renderPath(path: string, authenticated: boolean | null = true) {
  if (authenticated === null)
    queryClient.removeQueries({ queryKey: ['auth', 'current-user'] });
  else
    queryClient.setQueryData(
      ['auth', 'current-user'],
      authenticated ? authMocks.user : null,
    );
  const router = createAppRouter({ initialEntries: [path] });
  return render(<AppProviders router={router} />);
}

describe('frontend application foundation', () => {
  beforeEach(() => {
    queryClient.clear();
    tenancyMocks.getOrganizationAccessContext.mockReset();
    organizationMocks.getOrganizationDashboard.mockReset();
    vi.mocked(getApiHealth).mockResolvedValue({
      status: 'ok',
      service: 'instituteos-api',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    authMocks.getCurrentUser.mockResolvedValue({ user: authMocks.user });
    authMocks.loginRequest.mockResolvedValue({ user: authMocks.user });
    platformMocks.getPlatformOrganizations.mockRejectedValue(
      new ApiError('Platform access required.', 403, 'PLATFORM_ROLE_REQUIRED'),
    );
    platformMocks.getPlatformDemoRequests.mockResolvedValue({ requests: [] });
    platformMocks.createPlatformOrganization.mockResolvedValue({
      organization: {
        id: 'org-created-1',
        name: 'City College',
        subdomain: 'citycollege',
        adminEmail: 'admin@citycollege.edu',
        studentCount: 0,
        plan: 'Growth',
        mrr: 0,
        trialEndsAt: '2026-10-31T00:00:00.000Z',
        status: 'active',
        createdAt: '2026-10-17T00:00:00.000Z',
      },
      ownerInvitationSent: true,
    });
    dashboardDataMocks.listApplications.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 3,
    });
    dashboardDataMocks.listStudentAttendance.mockResolvedValue({ items: [] });
    dashboardDataMocks.listFamilyContacts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 1,
    });
    dashboardDataMocks.listDailyCollections.mockResolvedValue({ items: [] });
    authMocks.logoutRequest.mockResolvedValue(undefined);
    authMocks.registerRequest.mockResolvedValue({
      verificationRequired: false,
      message:
        'If registration can be completed, you can continue by signing in.',
    });
    tenancyMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId: '650000000000000000000001',
      role: 'organization_admin',
      permissions: [
        'organization.read',
        'organization.update',
        'communication.read',
        'campus.read',
        'campus.create',
        'campus.update',
        'campus.status.update',
        'member.read',
        'member.invite',
        'member.manage',
      ],
      campusIds: [],
    });
    organizationMocks.getAccessibleOrganizations.mockResolvedValue({
      organizations: [
        {
          id: '650000000000000000000001',
          name: 'North Institute',
          role: 'organization_owner',
          status: 'active' as const,
        },
      ],
    });
    organizationMocks.createOrganization.mockResolvedValue({
      organization: {
        id: '650000000000000000000001',
        name: 'North Institute',
        status: 'active',
      },
      campus: {
        id: '660000000000000000000001',
        name: 'Main Campus',
        status: 'active',
      },
    });
    organizationMocks.archiveOrganization.mockResolvedValue({
      organization: {
        id: '650000000000000000000001',
        name: 'North Institute',
        status: 'archived',
      },
    });
    organizationMocks.restoreOrganization.mockResolvedValue({
      organization: {
        id: '650000000000000000000001',
        name: 'North Institute',
        status: 'active',
      },
    });
    organizationMocks.deleteOrganization.mockResolvedValue(undefined);
    organizationMocks.getOrganizationDashboard.mockResolvedValue({
      organization: {
        id: '650000000000000000000001',
        name: 'North Institute',
        status: 'active',
        timezone: 'UTC',
      },
      counts: { campuses: 1, members: 1 },
      setupComplete: true,
    });
    organizationMocks.getOrganizationProfile.mockResolvedValue({
      organization: {
        id: '650000000000000000000001',
        name: 'North Institute',
        shortCode: 'NORTH',
        logoDataUrl: '',
        status: 'active',
      },
    });
    organizationMocks.getCampuses.mockResolvedValue({ campuses: [] });
    organizationMocks.getMembers.mockResolvedValue({
      members: [
        {
          id: 'membership-1',
          role: 'organization_owner',
          status: 'active',
          campusIds: [],
          user: {
            id: 'user-test-id',
            email: 'owner@example.test',
            displayName: 'Institute User',
            status: 'active',
          },
        },
      ],
    });
    organizationMocks.getInvitations.mockResolvedValue({ invitations: [] });
    organizationMocks.inviteMember.mockResolvedValue({ message: 'sent' });
    organizationMocks.updateOrganization.mockResolvedValue({
      organization: { id: '650000000000000000000001', name: 'North Institute' },
    });
    organizationMocks.createCampus.mockResolvedValue({
      campus: {
        id: '660000000000000000000001',
        name: 'Main Campus',
        status: 'active',
      },
    });
    organizationMocks.updateCampus.mockResolvedValue({
      campus: {
        id: '660000000000000000000001',
        name: 'Main Campus',
        status: 'active',
      },
    });
    organizationMocks.updateMember.mockResolvedValue({
      member: {
        id: 'membership-1',
        role: 'teacher',
        status: 'active',
        campusIds: [],
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('asks the signed-in user to choose when multiple active workspaces are available', async () => {
    organizationMocks.getAccessibleOrganizations.mockResolvedValue({
      organizations: [
        {
          id: '650000000000000000000001',
          name: 'North Institute',
          role: 'organization_owner',
          status: 'active' as const,
        },
        {
          id: '650000000000000000000002',
          name: 'South College',
          role: 'teacher',
          status: 'active' as const,
        },
      ],
    });

    renderPath('/dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Choose your workspace' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Open workspace/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: /North Institute/ }),
    ).toHaveAttribute('href', '/admin/organizations/650000000000000000000001');
    expect(screen.getByRole('link', { name: /South College/ })).toHaveAttribute(
      'href',
      '/teacher/organizations/650000000000000000000002',
    );
  });

  it('renders the public landing page with the expected scroll sections', async () => {
    renderPath('/');

    expect(
      await screen.findByRole('heading', { name: /Run your institute/i }),
    ).toBeInTheDocument();
    expect(document.getElementById('features')).toBeInTheDocument();
    expect(document.getElementById('how-it-works')).toBeInTheDocument();
    expect(document.getElementById('pricing')).toBeInTheDocument();
    expect(document.getElementById('contact')).toBeInTheDocument();
  });

  it('renders the platform organizations workspace', async () => {
    platformMocks.getPlatformOrganizations.mockResolvedValue({
      organizations: [],
    });
    renderPath('/platform');

    expect(
      await screen.findByRole('heading', { name: 'Super Admin' }),
    ).toBeInTheDocument();
    expect(platformMocks.getPlatformOrganizations).toHaveBeenCalledOnce();
  });

  it('denies the Super Admin screen when the backend rejects the platform grant', async () => {
    platformMocks.getPlatformOrganizations.mockRejectedValueOnce(
      new ApiError('Platform access required.', 403, 'PLATFORM_ROLE_REQUIRED'),
    );
    renderPath('/super-admin');

    expect(
      await screen.findByRole('heading', { name: 'Platform access required' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Main navigation' }),
    ).not.toBeInTheDocument();
  });

  it('blocks direct /platform access when the signed-in account has no platform grant', async () => {
    platformMocks.getPlatformOrganizations.mockRejectedValueOnce(
      new ApiError('Platform access required.', 403, 'PLATFORM_ROLE_REQUIRED'),
    );
    renderPath('/platform');

    expect(
      await screen.findByRole('heading', { name: 'Platform access required' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Main navigation' }),
    ).not.toBeInTheDocument();
  });

  it('creates an organization from the platform workspace and refreshes the list', async () => {
    const user = userEvent.setup();
    platformMocks.getPlatformOrganizations.mockResolvedValue({
      organizations: [],
    });
    renderPath('/super-admin');

    await user.click(
      await screen.findByRole('button', { name: 'Add organization' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Organization name' }),
      'City College',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Subdomain/ }),
      'citycollege',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Organization owner email' }),
      'admin@citycollege.edu',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Plan' }),
      'Growth',
    );
    await user.click(
      screen.getByRole('button', { name: 'Create & invite owner' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Organization created. The owner invitation has been sent securely.',
    );
    expect(platformMocks.createPlatformOrganization).toHaveBeenCalledWith(
      {
        name: 'City College',
        institutionType: 'college',
        subdomain: 'citycollege',
        adminEmail: 'admin@citycollege.edu',
        plan: 'Growth',
      },
      expect.any(Object),
    );
  });

  it('does not expose development role-preview controls in the workspace shell', async () => {
    renderPath('/admin');

    expect(
      screen.queryByRole('button', { name: 'Teacher preview' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Mobile role layout preview' }),
    ).not.toBeInTheDocument();
  });

  it('does not expose the retired reference UI preview from the workspace navigation', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId: '650000000000000000000001',
      role: 'organization_admin',
      permissions: ['organization.read'],
      campusIds: [],
    });
    organizationMocks.getOrganizationDashboard.mockResolvedValue({
      organization: {
        id: '650000000000000000000001',
        name: 'North Institute',
        status: 'active',
        timezone: 'UTC',
      },
      counts: { campuses: 1, members: 1 },
      setupComplete: true,
    });
    renderPath('/admin/organizations/650000000000000000000001');

    await screen.findByRole(
      'heading',
      { name: 'Institute Overview' },
      { timeout: 5000 },
    );
    expect(
      screen.queryByRole('link', { name: 'Open reference UI preview' }),
    ).not.toBeInTheDocument();
  });

  it('opens the reference module preview scoped to the same organization ID', async () => {
    renderPath(
      '/admin/organizations/650000000000000000000001/preview/students',
    );

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Students' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText(/SAMPLE DATA/)).toBeInTheDocument();
  });

  it('opens mobile navigation and closes it after navigation', async () => {
    const user = userEvent.setup();
    renderPath('/student');
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.queryByRole('combobox', { name: 'Mobile role layout preview' }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: 'UI foundations' }),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Dashboard' }));
    await waitFor(() =>
      expect(menuButton).toHaveAttribute('aria-expanded', 'false'),
    );
  });

  it('provides an accessible dialog and dismissible toast foundation', async () => {
    const user = userEvent.setup();
    renderPath('/admin/foundations');

    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Open dialog' },
        { timeout: 5000 },
      ),
    );
    expect(
      screen.getByRole('dialog', { name: 'Dialog foundation' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Show notification' }));
    expect(
      await screen.findByText('Your preview notification is ready.'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(
      screen.queryByText('Your preview notification is ready.'),
    ).not.toBeInTheDocument();
  });

  it('validates forms and exposes errors beside their fields', async () => {
    const user = userEvent.setup();
    renderPath('/admin/foundations');

    await user.click(
      await screen.findByRole('button', { name: 'Validate form' }),
    );
    expect(
      await screen.findByText('Enter at least two characters.'),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'Display name' }),
      'InstituteOS',
    );
    await user.click(screen.getByRole('button', { name: 'Validate form' }));
    expect(
      await screen.findByText('Form foundation submitted successfully.'),
    ).toBeInTheDocument();
  });

  it('renders accessible loading, empty, error, denied, and table empty states', async () => {
    renderPath('/parent/foundations');

    expect(await screen.findByText('Loading view…')).toBeInTheDocument();
    expect(screen.getAllByText('No results yet')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load this view',
    );
    expect(screen.getByText('Access not available')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Example data table' }),
    ).toBeInTheDocument();
  });

  it('redirects anonymous visitors away from protected workspace routes', async () => {
    authMocks.getCurrentUser.mockRejectedValueOnce(
      new ApiError('Sign in required.', 401, 'AUTHENTICATION_REQUIRED'),
    );
    renderPath('/teacher', false);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to InstituteOS' }),
    ).toBeInTheDocument();
  });

  it('bootstraps the current user from the session endpoint after a page refresh', async () => {
    renderPath('/student', null);

    expect(
      await screen.findByRole('heading', { name: 'Student workspace' }),
    ).toBeInTheDocument();
    expect(authMocks.getCurrentUser).toHaveBeenCalledOnce();
  });

  it('signs in, clears prior account data, and restores the requested protected route', async () => {
    const user = userEvent.setup();
    queryClient.setQueryData(
      ['organization-context', '650000000000000000000001'],
      { organizationId: '650000000000000000000001', role: 'parent_guardian' },
    );
    renderPath('/login', false);
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'user@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'long password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
    expect(loginRequest).toHaveBeenCalledWith({
      email: 'user@example.test',
      password: 'long password',
    });
    expect(
      queryClient.getQueryData([
        'organization-context',
        '650000000000000000000001',
      ]),
    ).toMatchObject({ role: 'organization_admin' });
  });

  it('routes a platform administrator to Super Admin even when entering through the admin workspace login', async () => {
    platformMocks.getPlatformOrganizations.mockResolvedValue({
      organizations: [],
    });
    renderPath('/admin/dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Super Admin' }),
    ).toBeInTheDocument();
    expect(platformMocks.getPlatformOrganizations).toHaveBeenCalled();
    expect(organizationMocks.getAccessibleOrganizations).not.toHaveBeenCalled();
  });

  it('keeps Messages and Announcements inside their own Communication sidebar group', async () => {
    renderPath('/admin/organizations/650000000000000000000001');
    const navigation = await screen.findByRole('navigation', {
      name: 'Main navigation',
    });
    const heading = within(navigation).getByText('Communication');
    const group = heading.closest('.navigation-group');

    expect(group).not.toBeNull();
    expect(
      within(group as HTMLElement).getByRole('link', { name: 'Messages' }),
    ).toBeInTheDocument();
    expect(
      within(group as HTMLElement).getByRole('link', {
        name: 'Announcements',
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/admin/login', 'Sign in to your organization admin workspace'],
    ['/teacher/login', 'Sign in to your teacher workspace'],
    ['/parent/login', 'Sign in to your parent workspace'],
  ])('renders the dedicated role login at %s', async (path, heading) => {
    renderPath(path, false);
    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });

  it('renders the API rate-limit message on the sign-in form', async () => {
    const user = userEvent.setup();
    authMocks.loginRequest.mockRejectedValueOnce(
      new ApiError(
        'Too many attempts. Please wait and try again.',
        429,
        'AUTH_RATE_LIMITED',
      ),
    );
    renderPath('/login', false);
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'user@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'long password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Please wait and try again.',
    );
  });

  it('guides generic registration completion toward sign-in and recovery', async () => {
    const user = userEvent.setup();
    renderPath('/register', false);
    await user.type(
      await screen.findByRole('textbox', { name: 'Full name' }),
      'New User',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'user@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'a long test password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in to InstituteOS' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If registration was completed, you can sign in. If you already have an account, sign in or use Forgot password.',
    );
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('preserves an invitation through registration and email activation', async () => {
    const user = userEvent.setup();
    const invitationPath =
      '/invitations/accept#token=disposable-invitation-token';
    authMocks.registerRequest.mockResolvedValueOnce({
      verificationRequired: true,
      message: 'Check your email.',
    });

    renderPath(invitationPath, false);
    expect(
      await screen.findByRole('heading', { name: 'Sign in to InstituteOS' }),
    ).toBeInTheDocument();
    expect(
      organizationMocks.acceptOrganizationInvitation,
    ).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole('link', { name: 'Create an account' }),
    );
    await user.type(
      await screen.findByRole('textbox', { name: 'Full name' }),
      'Invited Teacher',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'teacher@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'a long test password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue to invitation' }),
    ).toHaveAttribute('href', invitationPath);
  });

  it('loads server-verified organization context and gates the page by permission', async () => {
    renderPath('/organizations/650000000000000000000001/context');

    expect(
      await screen.findByRole('heading', {
        name: 'Current organization context',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Role: organization admin'),
    ).toBeInTheDocument();
    expect(tenancyMocks.getOrganizationAccessContext).toHaveBeenCalledWith(
      '650000000000000000000001',
    );

    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000002',
      role: 'student',
      permissions: [],
    });
    queryClient.clear();
    renderPath('/organizations/650000000000000000000002/context');
    expect(await screen.findByText('Access not available')).toBeInTheDocument();
  });

  it('redirects the retired organization onboarding route to the assigned organization list', async () => {
    renderPath('/admin/organizations/onboarding');

    expect(
      await screen.findByRole('heading', { name: 'Organizations' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create organization' }),
    ).not.toBeInTheDocument();
    expect(organizationMocks.createOrganization).not.toHaveBeenCalled();
  });
  it('shows the four primary dashboard cards and removes the quick-action row', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'organization_owner',
      permissions: ['organization.read'],
      campusIds: [],
    });

    renderPath('/admin/organizations/650000000000000000000001');

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your organization at a glance.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Organization workspace/i),
    ).not.toBeInTheDocument();

    for (const metric of [
      'Total Students',
      'Active Staff',
      'Attendance Rate',
      'Pending Dues',
    ]) {
      expect(screen.getByText(metric)).toBeInTheDocument();
    }

    for (const action of [
      'Add Student',
      'Collect Fee',
      'Mark Attendance',
      'Generate Report',
    ]) {
      expect(screen.queryByText(action)).not.toBeInTheDocument();
    }
  });

  it('lists only organizations assigned to the signed-in account', async () => {
    organizationMocks.getAccessibleOrganizations.mockResolvedValueOnce({
      organizations: [
        {
          id: '650000000000000000000001',
          name: 'North Institute',
          role: 'organization_owner',
          status: 'active',
        },
        {
          id: '650000000000000000000002',
          name: 'South Academy',
          role: 'teacher',
          status: 'active',
        },
      ],
    });
    renderPath('/admin/organizations');

    expect(
      await screen.findByRole('heading', { name: 'Organizations' }),
    ).toBeInTheDocument();
    expect(screen.getByText('South Academy')).toBeInTheDocument();
    expect(screen.getByText('organization owner')).toBeInTheDocument();
    expect(screen.getAllByText('teacher').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: 'Open North Institute' }),
    ).toHaveAttribute('href', '/admin/organizations/650000000000000000000001');
    expect(
      screen.queryByRole('link', { name: 'Create organization' }),
    ).not.toBeInTheDocument();
  });

  it('shows a helpful empty state when no organization has been assigned', async () => {
    organizationMocks.getAccessibleOrganizations.mockResolvedValueOnce({
      organizations: [],
    });
    renderPath('/admin');

    expect(
      await screen.findByRole('heading', { name: 'Organizations' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No organization assigned')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Create organization' }),
    ).not.toBeInTheDocument();
  });
  it('opens the sole accessible organization from the admin landing route', async () => {
    renderPath('/admin');

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
    expect(organizationMocks.getOrganizationDashboard).toHaveBeenCalledWith(
      '650000000000000000000001',
    );
  });

  it('keeps all Phase 2 modules available from Admin navigation', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'organization_owner',
      permissions: [
        'organization.read',
        'organization.update',
        'campus.read',
        'campus.create',
        'campus.update',
        'campus.status.update',
        'member.read',
        'member.invite',
        'member.manage',
        'student.read',
        'student.create',
        'student.update',
        'guardian.read',
        'guardian.create',
        'guardian.update',
        'staff.read',
        'staff.create',
        'staff.update',
        'admission.read',
        'admission.create',
        'admission.review',
        'academics.read',
        'academics.write',
        'attendance.read',
        'attendance.write',
        'examination.read',
        'examination.write',
        'finance.read',
        'finance.write',
        'communication.read',
        'communication.write',
        'reporting.read',
        'audit.read',
      ],
      campusIds: [],
    });

    renderPath('/admin/organizations/650000000000000000000001');

    const navigation = await screen.findByRole(
      'navigation',
      { name: 'Main navigation' },
      { timeout: 5000 },
    );
    const base = '/admin/organizations/650000000000000000000001';
    for (const [label, path] of [
      ['Curriculum', '/academics'],
      ['Students', '/students'],
      ['Families', '/families'],
      ['Staff', '/staff'],
      ['Attendance', '/attendance'],
      ['Exam', '/examinations'],
      ['Finance', '/finance'],
      ['Import & Export', '/reports'],
    ]) {
      expect(
        within(navigation).getByRole('link', { name: label }),
      ).toHaveAttribute('href', base + path);
    }

    const organizationLink = within(navigation).getByRole('link', {
      name: 'Organization',
    });
    await userEvent.click(organizationLink);
    expect(organizationLink).not.toHaveClass('navigation-link-active');
    const settingsLink = within(navigation).getByRole('link', {
      name: 'Settings',
    });
    expect(settingsLink).toHaveAttribute('href', base + '/settings');
    expect(settingsLink).toHaveClass('navigation-link');
    expect(settingsLink).not.toHaveClass('navigation-sublink');

    const staffLink = within(navigation).getByRole('link', { name: 'Staff' });
    expect(staffLink).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(staffLink);
    expect(staffLink).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(navigation).getByRole('link', { name: 'Add Staff' }),
    ).toHaveAttribute('href', base + '/staff/new');
    expect(
      within(navigation).getByRole('link', { name: 'All Staff' }),
    ).toHaveAttribute('href', base + '/staff');
    expect(
      within(navigation).getByRole('link', { name: 'Staff Setup' }),
    ).toHaveAttribute('href', base + '/staff/setup');

    const examLink = within(navigation).getByRole('link', { name: 'Exam' });
    expect(examLink).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(examLink);
    expect(examLink).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Overview', 'Exams', 'Schedule', 'Marks', 'Results']) {
      expect(
        within(navigation).getByRole('link', { name: label }),
      ).toBeInTheDocument();
    }

    const curriculumLink = within(navigation).getByRole('link', {
      name: 'Curriculum',
    });
    expect(curriculumLink).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(curriculumLink);
    expect(curriculumLink).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(curriculumLink);
    expect(curriculumLink).toHaveAttribute('aria-expanded', 'false');
    expect(curriculumLink).not.toHaveClass('navigation-link-active');
  });

  it('hides Admin modules and quick actions outside the assigned permissions', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'organization_admin',
      permissions: [
        'organization.read',
        'attendance.read',
        'attendance.write',
        'examination.read',
      ],
      campusIds: [],
    });

    renderPath('/admin/organizations/650000000000000000000001');
    const navigation = await screen.findByRole('navigation', {
      name: 'Main navigation',
    });

    expect(
      within(navigation).getByRole('link', { name: 'Attendance' }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole('link', { name: 'Exam' }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole('link', { name: 'Tests' }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole('link', { name: 'Events & Holidays' }),
    ).toBeInTheDocument();
    for (const label of [
      'Students',
      'Families',
      'Staff',
      'Finance',
      'Import & Export',
      'Messages',
      'Announcements',
    ]) {
      expect(
        within(navigation).queryByRole('link', { name: label }),
      ).not.toBeInTheDocument();
    }
    await userEvent.click(
      screen.getByRole('button', { name: 'Open quick actions' }),
    );
    const quickActions = screen.getByRole('menu', { name: 'Quick actions' });
    expect(
      within(quickActions).queryByRole('menuitem', { name: 'Add Student' }),
    ).not.toBeInTheDocument();
    expect(
      within(quickActions).queryByRole('menuitem', { name: 'Collect Fee' }),
    ).not.toBeInTheDocument();
    expect(
      within(quickActions).getByRole('menuitem', { name: 'Mark Attendance' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open announcements' }),
    ).not.toBeInTheDocument();
  });

  it('shows one active dot for the selected Attendance sub-page', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId: '650000000000000000000001',
      role: 'organization_owner',
      permissions: ['organization.read', 'attendance.read', 'staff.read'],
      campusIds: [],
    });
    const base = '/admin/organizations/650000000000000000000001';
    const tabs = [
      { query: '', active: 'classes' },
      { query: '?tab=students', active: 'students' },
      { query: '?tab=staff', active: 'staff' },
      { query: '?tab=settings', active: 'settings' },
    ];

    for (const tab of tabs) {
      const view = renderPath(base + '/attendance' + tab.query);
      const navigation = await screen.findByRole(
        'navigation',
        { name: 'Main navigation' },
        { timeout: 5000 },
      );
      const links = [
        { key: 'classes', href: base + '/attendance' },
        { key: 'students', href: base + '/attendance?tab=students' },
        { key: 'staff', href: base + '/attendance?tab=staff' },
        { key: 'settings', href: base + '/attendance?tab=settings' },
      ].map(({ key, href }) => ({
        key,
        link: within(navigation)
          .getAllByRole('link')
          .find(
            (candidate) =>
              candidate.getAttribute('href') === href &&
              candidate.classList.contains('navigation-sublink'),
          )!,
      }));

      await waitFor(() => {
        expect(
          links.find((entry) => entry.key === tab.active)?.link,
        ).toHaveClass('navigation-sublink-active');
      });
      for (const entry of links.filter((entry) => entry.key !== tab.active)) {
        expect(entry.link).not.toHaveClass('navigation-sublink-active');
      }

      view.unmount();
      queryClient.clear();
    }
  });

  it('redirects a manually requested admin URL to the server-authorized teacher workspace', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'teacher',
      permissions: ['organization.read', 'student.read', 'attendance.read'],
      campusIds: [],
    });

    renderPath('/admin/organizations/650000000000000000000001');

    const navigation = await screen.findByRole('navigation', {
      name: 'Main navigation',
    });
    expect(
      within(navigation).getByRole('link', {
        name: 'My classes & students',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Your colleges' }),
    ).not.toBeInTheDocument();
  });

  it('opens the signed-in teacher workspace and its role-specific dashboard', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'teacher',
      permissions: [
        'organization.read',
        'student.read',
        'attendance.read',
        'examination.read',
      ],
      campusIds: [],
    });

    renderPath('/teacher/organizations/650000000000000000000001');

    expect(await screen.findByText(/Welcome back,/)).toBeInTheDocument();
    expect(
      screen.getByText('Here’s your teaching overview for today.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Teaching overview' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'My staff attendance' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'My class performance' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'My timetable' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Pending assignments' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Upcoming exams' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Institute notices' }),
    ).toBeInTheDocument();
    const firstDashboardRow = document.querySelector(
      '.teacher-dashboard-upcoming',
    );
    const secondDashboardRow = document.querySelector(
      '.teacher-dashboard-notices-row',
    );
    expect(
      Array.from(firstDashboardRow?.querySelectorAll('h2') ?? []).map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['My staff attendance', 'Pending assignments']);
    expect(
      Array.from(secondDashboardRow?.querySelectorAll('h2') ?? []).map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['Upcoming exams', 'Institute notices']);
    expect(
      screen.queryByRole('navigation', { name: 'Teacher quick actions' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Student attendance' }),
    ).not.toBeInTheDocument();
    const teachingMetrics = screen.getByRole('region', {
      name: 'Teaching summary',
    });
    expect(within(teachingMetrics).getByText('My classes')).toBeInTheDocument();
    expect(
      within(teachingMetrics).queryByText('Campuses'),
    ).not.toBeInTheDocument();
    expect(
      within(teachingMetrics).queryByText('Academic years'),
    ).not.toBeInTheDocument();
    const mainNavigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    const examModuleLink = within(mainNavigation).getByRole('link', {
      name: 'Exam',
    });
    expect(examModuleLink).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(examModuleLink);
    expect(examModuleLink).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(mainNavigation).getByRole('link', { name: 'Marks' }),
    ).toBeInTheDocument();
    expect(
      within(mainNavigation).getByRole('link', { name: 'Results' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open assigned classes' }),
    ).not.toBeInTheDocument();

    const collapseButton = screen.getByRole('button', {
      name: 'Collapse sidebar',
    });
    fireEvent.click(collapseButton);
    expect(
      screen.queryByRole('button', { name: 'Expand sidebar' }),
    ).not.toBeInTheDocument();
    const collapsedBrand = screen.getByRole('link', {
      name: 'Expand sidebar',
    });
    fireEvent.click(collapsedBrand);
    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open quick actions' }));
    expect(
      screen.getByRole('menu', { name: 'Quick actions' }),
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('menu', { name: 'Quick actions' }),
    ).not.toBeInTheDocument();
  });

  it('redirects a manually requested teacher URL to the server-authorized parent workspace', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'parent_guardian',
      permissions: ['organization.read', 'attendance.read', 'finance.read'],
      campusIds: [],
    });

    renderPath('/teacher/organizations/650000000000000000000001');

    expect(
      await screen.findByRole(
        'link',
        { name: 'Fees & receipts' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'My classes & students' }),
    ).not.toBeInTheDocument();
  });

  it('shows institute identity once and exposes account, logo and announcement actions', async () => {
    const user = userEvent.setup();
    const organizationId = '650000000000000000000001';
    renderPath('/admin/organizations/' + organizationId);

    expect(
      await screen.findByRole('link', {
        name: 'Open North Institute organization profile',
      }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' + organizationId + '?tab=settings',
    );
    expect(screen.getByText('NORTH')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open announcements' }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' +
        organizationId +
        '/communications/announcements',
    );

    await user.click(screen.getByRole('button', { name: /Institute User/ }));
    expect(
      screen.getByRole('menuitem', { name: /My Profile/ }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' + organizationId + '/settings?tab=my-profile',
    );
    expect(
      screen.queryByRole('menuitem', { name: /Institute Profile & Logo/ }),
    ).not.toBeInTheDocument();
    const organizationNavigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    await user.click(
      within(organizationNavigation).getByRole('link', {
        name: 'Organization',
      }),
    );
    expect(
      within(organizationNavigation).getByRole('link', {
        name: 'Organization Profile',
      }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' + organizationId + '?tab=settings',
    );
  });

  it('does not show a current-organization switcher in the organization dashboard', async () => {
    renderPath('/admin/organizations/650000000000000000000001');

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Current organization' }),
    ).not.toBeInTheDocument();
  });
  it('shows the organization name in the overview instead of a route ID', async () => {
    const organizationId = '650000000000000000000001';
    renderPath(`/admin/organizations/${organizationId}`);

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(organizationId)).not.toBeInTheDocument();
  });

  it('returns an inaccessible organization route to the signed-in user’s assigned workspace', async () => {
    tenancyMocks.getOrganizationAccessContext.mockRejectedValueOnce(
      new ApiError('Organization not found.', 404, 'ORGANIZATION_NOT_FOUND'),
    );
    renderPath('/admin/organizations/650000000000000000000099');

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
  });

  it('loads organization members and sends an invitation through the API', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001?tab=members');
    await user.click(await screen.findByRole('link', { name: 'Members' }));

    expect(
      (await screen.findAllByText('Institute User')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('owner@example.test')).toBeInTheDocument();
    expect(screen.getByText('organization owner')).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'teacher@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(organizationMocks.inviteMember).toHaveBeenCalledWith(
      '650000000000000000000001',
      {
        email: 'teacher@example.test',
        role: 'teacher',
        campusIds: [],
      },
    );
  });

  it('lets the organization owner assign restricted permissions when inviting an admin', async () => {
    const user = userEvent.setup();
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'organization_owner',
      permissions: [
        'organization.read',
        'member.read',
        'member.invite',
        'member.manage',
      ],
      campusIds: [],
    });
    renderPath('/admin/organizations/650000000000000000000001?tab=members');
    await user.click(await screen.findByRole('link', { name: 'Members' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role' }),
      'organization_admin',
    );

    const permissionEditor = await screen.findByText(/Admin permissions/);
    expect(permissionEditor).toBeInTheDocument();
    const financePermission = screen.getByRole('checkbox', {
      name: 'finance.write',
    });
    expect(financePermission).toBeChecked();
    await user.click(financePermission);
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'limited-admin@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(organizationMocks.inviteMember).toHaveBeenCalledWith(
      '650000000000000000000001',
      expect.objectContaining({
        email: 'limited-admin@example.test',
        role: 'organization_admin',
        campusIds: [],
        permissions: expect.not.arrayContaining(['finance.write']),
      }),
    );
  });

  it('loads and saves organization settings', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001?tab=members');
    await user.click(
      await screen.findByRole('link', { name: 'Organization Profile' }),
    );
    const name = await screen.findByRole('textbox', {
      name: 'Organization name',
    });
    await user.clear(name);
    await user.type(name, 'Updated Institute');
    await user.type(
      screen.getByRole('textbox', { name: 'Organization admin name' }),
      'Arslan Chishti',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Organization short code' }),
      'bfa',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Tagline' }),
      'Learning for every future',
    );
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(organizationMocks.updateOrganization).toHaveBeenCalledWith(
      '650000000000000000000001',
      expect.objectContaining({
        name: 'Updated Institute',
        adminName: 'Arslan Chishti',
        shortCode: 'BFA',
        tagline: 'Learning for every future',
        logoDataUrl: '',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Organization settings saved.',
    );
  });

  it('keeps organization administration in its own navigation group', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001?tab=members');

    expect(
      await screen.findByRole('heading', { name: 'Members' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Organization section' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Organization Profile' }),
    ).toBeInTheDocument();
    const settingsLink = screen.getByRole('link', { name: 'Settings' });
    expect(settingsLink).toHaveAttribute(
      'href',
      '/admin/organizations/650000000000000000000001/settings',
    );
    expect(settingsLink).not.toHaveClass('navigation-sublink');
    await user.click(screen.getByRole('link', { name: 'Invitations' }));
    expect(
      await screen.findByRole('heading', { name: 'Invitations' }),
    ).toBeInTheDocument();
  });

  it('lets only the organization owner archive from settings and returns to discovery', async () => {
    const user = userEvent.setup();
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'organization_owner',
      permissions: ['organization.read', 'organization.update'],
      campusIds: [],
    });
    renderPath('/admin/organizations/650000000000000000000001?tab=members');
    await user.click(
      await screen.findByRole('link', { name: 'Organization Profile' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Archive organization' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Archive organization?',
    });
    expect(
      within(dialog).getByText(/Campuses, memberships/),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: 'Archive organization' }),
    );

    expect(organizationMocks.archiveOrganization).toHaveBeenCalledWith(
      '650000000000000000000001',
    );
    expect(
      await screen.findByRole('heading', { name: 'Organizations' }),
    ).toBeInTheDocument();
  });

  it('does not expose archive controls to organization administrators', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001?tab=members');
    await user.click(
      await screen.findByRole('link', { name: 'Organization Profile' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Save settings' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Archive organization' }),
    ).not.toBeInTheDocument();
  });

  it('allows an archived owner to restore an organization', async () => {
    const user = userEvent.setup();
    organizationMocks.getAccessibleOrganizations
      .mockResolvedValueOnce({
        organizations: [
          {
            id: '650000000000000000000001',
            name: 'North Institute',
            role: 'organization_owner',
            status: 'archived',
          },
        ],
      })
      .mockResolvedValueOnce({
        organizations: [
          {
            id: '650000000000000000000001',
            name: 'North Institute',
            role: 'organization_owner',
            status: 'active',
          },
        ],
      });
    renderPath('/admin/organizations');

    await user.click(await screen.findByRole('button', { name: 'Restore' }));

    expect(organizationMocks.restoreOrganization).toHaveBeenCalledWith(
      '650000000000000000000001',
    );
    expect(
      await screen.findByRole('link', { name: 'Open North Institute' }),
    ).toBeInTheDocument();
  });

  it('requires an exact name before permanent deletion and removes the organization on success', async () => {
    const user = userEvent.setup();
    organizationMocks.getAccessibleOrganizations
      .mockResolvedValueOnce({
        organizations: [
          {
            id: '650000000000000000000001',
            name: 'North Institute',
            role: 'organization_owner',
            status: 'archived',
          },
        ],
      })
      .mockResolvedValueOnce({ organizations: [] });
    renderPath('/admin/organizations');

    await user.click(
      await screen.findByRole('button', { name: 'Delete permanently' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Delete organization permanently',
    });
    const confirmation = within(dialog).getByRole('textbox', {
      name: 'Organization name',
    });
    const deleteButton = within(dialog).getByRole('button', {
      name: 'Delete organization',
    });
    expect(deleteButton).toBeDisabled();
    await user.type(confirmation, 'north institute');
    expect(deleteButton).toBeDisabled();

    await user.clear(confirmation);
    await user.type(confirmation, 'North Institute');
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    expect(organizationMocks.deleteOrganization).toHaveBeenCalledWith(
      '650000000000000000000001',
      'North Institute',
    );
    expect(
      await screen.findByText('No organization assigned'),
    ).toBeInTheDocument();
  });

  it('does not expose restore or delete controls to non-owner archived members', async () => {
    organizationMocks.getAccessibleOrganizations.mockResolvedValueOnce({
      organizations: [
        {
          id: '650000000000000000000001',
          name: 'North Institute',
          role: 'organization_admin',
          status: 'archived',
        },
      ],
    });
    renderPath('/admin/organizations');

    expect(
      await screen.findByText(
        'Contact an organization owner to restore this workspace.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restore' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete permanently' }),
    ).not.toBeInTheDocument();
  });

  it('creates, renames, and changes campus status from the campus panel', async () => {
    const user = userEvent.setup();
    const organizationId = '650000000000000000000001';
    organizationMocks.getCampuses.mockResolvedValue({
      campuses: [
        {
          id: '660000000000000000000001',
          organizationId,
          name: 'Main Campus',
          status: 'active',
        },
      ],
    });
    renderPath('/admin/organizations/' + organizationId + '?tab=campuses');
    await user.click(await screen.findByRole('link', { name: 'Campuses' }));

    await user.click(await screen.findByRole('button', { name: 'New campus' }));
    await user.type(
      await screen.findByRole('textbox', { name: 'Campus name' }),
      'North Annex',
    );
    await user.click(screen.getByRole('button', { name: 'Add campus' }));
    expect(organizationMocks.createCampus).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ name: 'North Annex' }),
    );

    await user.click(screen.getByRole('button', { name: 'View' }));
    const campusName = await screen.findByRole('textbox', {
      name: 'Campus name',
    });
    await user.clear(campusName);
    await user.type(campusName, 'Renamed Campus');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(organizationMocks.updateCampus).toHaveBeenCalledWith(
      organizationId,
      '660000000000000000000001',
      { name: 'Renamed Campus' },
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(organizationMocks.updateCampus).toHaveBeenCalledWith(
      organizationId,
      '660000000000000000000001',
      { status: 'inactive' },
    );
  });

  it('submits role and multiple-campus scope changes for a member', async () => {
    const user = userEvent.setup();
    const organizationId = '650000000000000000000001';
    organizationMocks.getCampuses.mockResolvedValue({
      campuses: [
        {
          id: '660000000000000000000001',
          organizationId,
          name: 'Main Campus',
          status: 'active',
        },
        {
          id: '660000000000000000000002',
          organizationId,
          name: 'North Campus',
          status: 'active',
        },
      ],
    });
    organizationMocks.getMembers.mockResolvedValue({
      members: [
        {
          id: 'membership-teacher',
          role: 'teacher',
          status: 'active',
          campusIds: [],
          user: {
            id: 'teacher-user',
            email: 'teacher@example.test',
            displayName: 'Teacher',
            status: 'active',
          },
        },
      ],
    });
    renderPath('/admin/organizations/' + organizationId + '?tab=members');
    await user.click(await screen.findByRole('link', { name: 'Members' }));
    expect((await screen.findAllByText('Teacher')).length).toBeGreaterThan(0);
    expect(screen.getByText('teacher@example.test')).toBeInTheDocument();
    expect(screen.getAllByText('teacher').length).toBeGreaterThan(0);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role for teacher@example.test' }),
      'campus_admin',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Campus scope for teacher@example.test',
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Main Campus' }));
    await user.click(screen.getByRole('checkbox', { name: 'North Campus' }));
    await user.click(screen.getByRole('button', { name: 'Save access' }));

    expect(organizationMocks.updateMember).toHaveBeenCalledWith(
      organizationId,
      'membership-teacher',
      expect.objectContaining({
        role: 'campus_admin',
        campusIds: ['660000000000000000000001', '660000000000000000000002'],
      }),
    );
  });

  it('accepts an invitation token from the URL fragment and removes it after use', async () => {
    const token = 'disposable-test-invitation-token';
    window.history.replaceState(null, '', '/invitations/accept#token=' + token);
    organizationMocks.acceptOrganizationInvitation.mockResolvedValue({
      membership: { organizationId: '650000000000000000000001' },
    });
    renderPath('/invitations/accept');

    expect(
      await screen.findByRole('heading', { name: 'Institute Overview' }),
    ).toBeInTheDocument();
    expect(
      organizationMocks.acceptOrganizationInvitation.mock.calls[0]?.[0],
    ).toBe(token);
    expect(window.location.hash).toBe('');
    window.history.replaceState(null, '', '/');
  });

  it('lets an invitee switch to the invited email after an authenticated email mismatch', async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      null,
      '',
      '/invitations/accept#token=one-time-test-token',
    );
    organizationMocks.acceptOrganizationInvitation.mockRejectedValueOnce(
      new ApiError(
        'This invitation was sent to a different email address.',
        403,
        'INVITATION_EMAIL_MISMATCH',
      ),
    );
    renderPath('/invitations/accept');

    await user.click(
      await screen.findByRole('button', {
        name: 'Sign out and use the invited email',
      }),
    );
    expect(authMocks.logoutRequest).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('heading', { name: 'Sign in to InstituteOS' }),
    ).toBeInTheDocument();
    window.history.replaceState(null, '', '/');
  });

  it('shows denied states without requesting collections the current role cannot read', async () => {
    tenancyMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId: '650000000000000000000001',
      role: 'organization_admin',
      permissions: ['organization.read'],
      campusIds: [],
    });

    for (const tab of ['campuses', 'members', 'invitations']) {
      const view = renderPath(
        `/admin/organizations/650000000000000000000001?tab=${tab}`,
      );
      expect(
        await screen.findByRole('heading', { name: 'Access not available' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/You do not have permission to view this area/),
      ).toBeInTheDocument();
      view.unmount();
      queryClient.clear();
    }

    expect(organizationMocks.getCampuses).not.toHaveBeenCalled();
    expect(organizationMocks.getMembers).not.toHaveBeenCalled();
    expect(organizationMocks.getInvitations).not.toHaveBeenCalled();
  });

  it('logs out and clears previously cached organization data', async () => {
    const user = userEvent.setup();
    renderPath('/student');
    queryClient.setQueryData(
      ['organization-context', '650000000000000000000001'],
      {
        organizationId: '650000000000000000000001',
        role: 'organization_admin',
      },
    );
    queryClient.setQueryData(
      ['organization-members', '650000000000000000000001'],
      { members: [{ id: 'private-member' }] },
    );
    await user.click(
      await screen.findByRole('button', { name: /Open account menu/ }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Sign in to InstituteOS' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(logoutRequest).toHaveBeenCalledOnce();
    expect(
      queryClient.getQueryData([
        'organization-context',
        '650000000000000000000001',
      ]),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData([
        'organization-members',
        '650000000000000000000001',
      ]),
    ).toBeUndefined();
  });
});
