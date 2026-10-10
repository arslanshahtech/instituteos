import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const organizationMocks = vi.hoisted(() => ({
  getAccessibleOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  archiveOrganization: vi.fn(),
  restoreOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  getOrganizationDashboard: vi.fn(),
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
    vi.mocked(getApiHealth).mockResolvedValue({
      status: 'ok',
      service: 'instituteos-api',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    authMocks.getCurrentUser.mockResolvedValue({ user: authMocks.user });
    authMocks.loginRequest.mockResolvedValue({ user: authMocks.user });
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

  it('redirects to the platform layout and loads API status through the query client', async () => {
    renderPath('/');

    expect(
      await screen.findByRole('heading', { name: 'Platform workspace' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('instituteos-api')).toBeInTheDocument();
    expect(getApiHealth).toHaveBeenCalledOnce();
  });

  it('switches between role layout previews without implying authorization', async () => {
    const user = userEvent.setup();
    renderPath('/admin');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role layout preview' }),
      'teacher',
    );

    expect(
      await screen.findByRole('heading', { name: 'Teaching workspace' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Teacher · Layout preview')).toBeInTheDocument();
  });

  it('opens mobile navigation and closes it after navigation', async () => {
    const user = userEvent.setup();
    renderPath('/student');
    const menuButton = screen.getByRole('button', { name: 'Open menu' });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('combobox', { name: 'Mobile role layout preview' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'UI foundations' }));

    expect(
      await screen.findByRole('heading', { name: 'UI foundations' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(menuButton).toHaveAttribute('aria-expanded', 'false'),
    );
  });

  it('provides an accessible dialog and dismissible toast foundation', async () => {
    const user = userEvent.setup();
    renderPath('/platform/foundations');

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
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

    await user.click(screen.getByRole('button', { name: 'Validate form' }));
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

  it('renders accessible loading, empty, error, denied, and table empty states', () => {
    renderPath('/parent/foundations');

    expect(screen.getByText('Loading view…')).toBeInTheDocument();
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

  it('signs in and restores the requested protected route', async () => {
    const user = userEvent.setup();
    renderPath('/login', false);
    await user.type(
      screen.getByRole('textbox', { name: 'Email address' }),
      'user@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'long password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Platform workspace' }),
    ).toBeInTheDocument();
    expect(loginRequest).toHaveBeenCalledWith({
      email: 'user@example.test',
      password: 'long password',
    });
  });

  it('shows the API rate-limit message on the sign-in form', async () => {
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
      screen.getByRole('textbox', { name: 'Full name' }),
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

  it('onboards an organization and shows dashboard values returned by the API', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/onboarding');

    await user.type(
      screen.getByRole('textbox', { name: 'Organization name' }),
      'North Institute',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Initial campus name Optional' }),
      'Main Campus',
    );
    await user.click(
      screen.getByRole('button', { name: 'Create organization' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'North Institute' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Active campuses')).toBeInTheDocument();
    expect(
      await screen.findAllByText('1', { selector: 'strong' }),
    ).toHaveLength(2);
    expect(organizationMocks.createOrganization.mock.calls[0]?.[0]).toEqual({
      name: 'North Institute',
      contactEmail: undefined,
      phone: undefined,
      timezone: undefined,
      initialCampus: { name: 'Main Campus' },
    });
  });

  it('lists accessible organizations with open and create actions', async () => {
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
      screen.getByRole('link', { name: 'Create organization' }),
    ).toHaveAttribute('href', '/admin/organizations/onboarding');
  });

  it('shows an empty discovery state and creates from the admin landing route', async () => {
    organizationMocks.getAccessibleOrganizations.mockResolvedValueOnce({
      organizations: [],
    });
    renderPath('/admin');

    expect(
      await screen.findByRole('heading', { name: 'Organizations' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No organizations yet')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Create organization' }),
    ).toHaveLength(2);
  });

  it('opens the sole accessible organization from the admin landing route', async () => {
    renderPath('/admin');

    expect(
      await screen.findByRole('heading', { name: 'North Institute' }),
    ).toBeInTheDocument();
    expect(organizationMocks.getOrganizationDashboard).toHaveBeenCalledWith(
      '650000000000000000000001',
    );
  });

  it('switches only to organizations returned by the authenticated listing', async () => {
    const user = userEvent.setup();
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
    renderPath('/admin/organizations/650000000000000000000001');

    const organizationSelect = await screen.findByRole('combobox', {
      name: 'Current organization',
    });
    expect(organizationSelect).toHaveValue('650000000000000000000001');
    await user.selectOptions(organizationSelect, '650000000000000000000002');

    await waitFor(() =>
      expect(tenancyMocks.getOrganizationAccessContext).toHaveBeenCalledWith(
        '650000000000000000000002',
      ),
    );
  });

  it('shows organization names instead of route IDs in workspace navigation', async () => {
    const organizationId = '650000000000000000000001';
    renderPath(`/admin/organizations/${organizationId}`);

    const identity = await screen.findByLabelText('Current workspace');
    expect(identity).toHaveTextContent('Organization workspace');
    await waitFor(() => expect(identity).toHaveTextContent('North Institute'));
    expect(screen.queryByText(organizationId)).not.toBeInTheDocument();
  });

  it('returns an inaccessible organization route to discovery', async () => {
    tenancyMocks.getOrganizationAccessContext.mockRejectedValueOnce(
      new ApiError('Organization not found.', 404, 'ORGANIZATION_NOT_FOUND'),
    );
    renderPath('/admin/organizations/650000000000000000000099');

    expect(
      await screen.findByRole('heading', { name: 'Organizations' }),
    ).toBeInTheDocument();
  });

  it('loads organization members and sends an invitation through the API', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001');
    await user.click(await screen.findByRole('button', { name: 'members' }));

    expect(
      (await screen.findAllByText('Institute User')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('owner@example.test')).toBeInTheDocument();
    expect(screen.getByText('organization owner')).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'teacher@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Invite member' }));

    expect(organizationMocks.inviteMember).toHaveBeenCalledWith(
      '650000000000000000000001',
      {
        email: 'teacher@example.test',
        role: 'teacher',
        campusIds: [],
      },
    );
  });

  it('loads and saves organization settings', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001');
    await user.click(await screen.findByRole('button', { name: 'settings' }));
    const name = await screen.findByRole('textbox', {
      name: 'Organization name',
    });
    await user.clear(name);
    await user.type(name, 'Updated Institute');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(organizationMocks.updateOrganization).toHaveBeenCalledWith(
      '650000000000000000000001',
      expect.objectContaining({ name: 'Updated Institute' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Organization settings saved.',
    );
  });

  it('allows choosing every organization section from the compact selector', async () => {
    const user = userEvent.setup();
    renderPath('/admin/organizations/650000000000000000000001');

    const sectionSelector = await screen.findByRole('combobox', {
      name: 'Organization section',
    });
    expect(sectionSelector).toHaveValue('overview');
    await user.selectOptions(sectionSelector, 'settings');

    expect(
      await screen.findByRole('textbox', { name: 'Organization name' }),
    ).toBeInTheDocument();
    expect(sectionSelector).toHaveValue('settings');
    expect(
      within(sectionSelector).getByRole('option', { name: 'Invitations' }),
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
    renderPath('/admin/organizations/650000000000000000000001');
    await user.click(await screen.findByRole('button', { name: 'settings' }));
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
    renderPath('/admin/organizations/650000000000000000000001');
    await user.click(await screen.findByRole('button', { name: 'settings' }));

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
    expect(await screen.findByText('No organizations yet')).toBeInTheDocument();
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
    renderPath('/admin/organizations/' + organizationId);
    await user.click(await screen.findByRole('button', { name: 'campuses' }));

    await user.type(
      await screen.findByRole('textbox', { name: 'New campus' }),
      'North Annex',
    );
    await user.click(screen.getByRole('button', { name: 'Add campus' }));
    expect(organizationMocks.createCampus).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ name: 'North Annex' }),
    );

    const campusName = screen.getByRole('textbox', {
      name: 'Name for Main Campus',
    });
    await user.clear(campusName);
    await user.type(campusName, 'Renamed Campus');
    await user.click(screen.getByRole('button', { name: /^Save$/i }));
    expect(organizationMocks.updateCampus).toHaveBeenCalledWith(
      organizationId,
      '660000000000000000000001',
      { name: 'Renamed Campus' },
    );

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
    renderPath('/admin/organizations/' + organizationId);
    await user.click(await screen.findByRole('button', { name: 'members' }));
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
      await screen.findByRole('heading', { name: 'North Institute' }),
    ).toBeInTheDocument();
    expect(
      organizationMocks.acceptOrganizationInvitation.mock.calls[0]?.[0],
    ).toBe(token);
    expect(window.location.hash).toBe('');
    window.history.replaceState(null, '', '/');
  });

  it('shows denied states without requesting collections the current role cannot read', async () => {
    const user = userEvent.setup();
    tenancyMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId: '650000000000000000000001',
      role: 'student',
      permissions: ['organization.read'],
      campusIds: [],
    });
    renderPath('/admin/organizations/650000000000000000000001');

    for (const tab of ['campuses', 'members', 'invitations']) {
      await user.click(await screen.findByRole('button', { name: tab }));
      expect(
        await screen.findByRole('heading', { name: 'Access not available' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/You do not have permission to view this area/),
      ).toBeInTheDocument();
    }

    expect(organizationMocks.getCampuses).not.toHaveBeenCalled();
    expect(organizationMocks.getMembers).not.toHaveBeenCalled();
    expect(organizationMocks.getInvitations).not.toHaveBeenCalled();
  });

  it('logs out from the authenticated application shell', async () => {
    const user = userEvent.setup();
    renderPath('/student');
    const signOutButtons = await screen.findAllByRole('button', {
      name: 'Sign out',
    });
    await user.click(signOutButtons[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to InstituteOS' }),
    ).toBeInTheDocument();
    expect(logoutRequest).toHaveBeenCalledOnce();
  });
});
