import { render, screen, waitFor } from '@testing-library/react';
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

  it('logs out from the authenticated application shell', async () => {
    const user = userEvent.setup();
    renderPath('/student');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in to InstituteOS' }),
    ).toBeInTheDocument();
    expect(logoutRequest).toHaveBeenCalledOnce();
  });
});
