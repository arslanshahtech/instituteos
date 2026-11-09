import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.js';
import { createAppRouter } from '../app/router.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import type { StudentRecord } from '../students/students-api.js';
import type { FamilyContactRecord } from './family-contacts-api.js';

const guardianMocks = vi.hoisted(() => ({
  listFamilyContacts: vi.fn(),
  getFamilyContact: vi.fn(),
  createFamilyContact: vi.fn(),
  updateFamilyContact: vi.fn(),
  listStudentFamilyContacts: vi.fn(),
  linkFamilyContact: vi.fn(),
  unlinkFamilyContact: vi.fn(),
}));

const studentMocks = vi.hoisted(() => ({
  getStudent: vi.fn(),
  listStudents: vi.fn(),
}));

const accessMocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    email: 'admin@example.test',
    displayName: 'Organization Admin',
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

const organizationMocks = vi.hoisted(() => ({
  getCampuses: vi.fn(),
  getAccessibleOrganizations: vi.fn(),
}));

vi.mock('./family-contacts-api.js', () => guardianMocks);
vi.mock('../students/students-api.js', () => studentMocks);
vi.mock('../tenancy/tenancy-api.js', () => accessMocks);
vi.mock('../auth/auth-api.js', () => authMocks);
vi.mock('../organizations/organizations-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../organizations/organizations-api.js')
    >();
  return { ...actual, getCampuses: organizationMocks.getCampuses };
});

const organizationId = '650000000000000000000001';
const studentId = '650000000000000000000002';
const guardianId = '650000000000000000000003';
const guardian: FamilyContactRecord = {
  id: guardianId,
  firstName: 'Leela',
  lastName: 'Rao',
  relationship: 'mother',
  email: 'leela@example.test',
  communicationPreference: 'both',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const student: StudentRecord = {
  id: studentId,
  firstName: 'Mina',
  lastName: 'Rao',
  status: 'active',
  guardianIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const permissions = [
  'guardian.read',
  'guardian.create',
  'guardian.update',
  'student.read',
  'student.update',
];

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(['auth', 'current-user'], authMocks.user);
  const router = createAppRouter({ initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div role="status">Loading page...</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('family and parent relationship pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getCurrentUser.mockResolvedValue({ user: authMocks.user });
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions,
      campusIds: [],
    });
    organizationMocks.getCampuses.mockResolvedValue({ campuses: [] });
    organizationMocks.getAccessibleOrganizations.mockResolvedValue({
      organizations: [],
    });
    guardianMocks.listFamilyContacts.mockResolvedValue({
      items: [guardian],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    guardianMocks.getFamilyContact.mockResolvedValue({
      guardian,
      students: [],
    });
    guardianMocks.createFamilyContact.mockResolvedValue({ guardian });
    guardianMocks.updateFamilyContact.mockResolvedValue({ guardian });
    guardianMocks.listStudentFamilyContacts.mockResolvedValue({
      relations: [],
    });
    guardianMocks.linkFamilyContact.mockResolvedValue({ link: {} });
    guardianMocks.unlinkFamilyContact.mockResolvedValue(undefined);
    studentMocks.getStudent.mockResolvedValue({ student });
    studentMocks.listStudents.mockResolvedValue({
      items: [student],
      total: 1,
      page: 1,
      pageSize: 100,
    });
  });

  it('searches the server-backed family contact directory', async () => {
    const user = userEvent.setup();
    guardianMocks.listFamilyContacts.mockImplementation(
      async (
        _organization: string,
        input: { search?: string; page: number; pageSize: number },
      ) => ({
        items: input.search ? [] : [guardian],
        total: input.search ? 0 : 1,
        page: input.page,
        pageSize: input.pageSize,
      }),
    );
    renderRoute(`/admin/organizations/${organizationId}/guardians`);

    expect(
      await screen.findByRole(
        'link',
        { name: 'Leela Rao' },
        { timeout: 3_000 },
      ),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(guardianId);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search family contacts' }),
      'unknown',
    );
    expect(
      await screen.findByText('No family contacts match this search'),
    ).toBeVisible();
    await waitFor(() => {
      expect(guardianMocks.listFamilyContacts).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({ search: 'unknown', page: 1 }),
      );
    });
  });

  it('validates and creates a family contact before opening the returned record', async () => {
    const user = userEvent.setup();
    renderRoute(`/admin/organizations/${organizationId}/family-contacts/new`);

    await user.click(
      await screen.findByRole('button', { name: 'Create family contact' }),
    );
    expect(
      await screen.findAllByText('Enter at least two characters.'),
    ).toHaveLength(2);
    expect(guardianMocks.createFamilyContact).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('First name'), 'Leela');
    await user.type(screen.getByLabelText('Last name'), 'Rao');
    await user.type(screen.getByLabelText('Email'), 'leela@example.test');
    await user.click(
      screen.getByRole('button', { name: 'Create family contact' }),
    );

    await waitFor(() => {
      expect(guardianMocks.createFamilyContact).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          firstName: 'Leela',
          lastName: 'Rao',
          relationship: 'guardian',
        }),
      );
    });
    expect(
      await screen.findByRole('heading', { name: 'Leela Rao' }),
    ).toBeVisible();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Family contact created successfully.',
    );
  });

  it('updates family contact details and confirms the successful save', async () => {
    const user = userEvent.setup();
    renderRoute(
      `/admin/organizations/${organizationId}/family-contacts/${guardianId}/edit`,
    );

    const firstName = await screen.findByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Leela Devi');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(guardianMocks.updateFamilyContact).toHaveBeenCalledWith(
        organizationId,
        guardianId,
        expect.objectContaining({
          firstName: 'Leela Devi',
          lastName: 'Rao',
        }),
      );
    });
    expect(
      await screen.findByRole('heading', { name: 'Leela Rao' }),
    ).toBeVisible();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Family contact changes saved.',
    );
  });

  it('shows linked student names without displaying record identifiers', async () => {
    guardianMocks.getFamilyContact.mockResolvedValue({
      guardian,
      students: [
        {
          id: 'link-1',
          relationship: 'mother',
          isPrimary: true,
          student: {
            id: studentId,
            firstName: student.firstName,
            lastName: student.lastName,
          },
        },
      ],
    });
    renderRoute(
      `/admin/organizations/${organizationId}/family-contacts/${guardianId}`,
    );

    expect(await screen.findByRole('link', { name: 'Mina Rao' })).toBeVisible();
    expect(document.body).not.toHaveTextContent(studentId);
    expect(document.body).not.toHaveTextContent(guardianId);
  });

  it('shows linked parents in the student Family section', async () => {
    guardianMocks.listStudentFamilyContacts.mockResolvedValue({
      relations: [
        {
          id: 'link-1',
          relationship: 'mother',
          isPrimary: true,
          guardian,
        },
      ],
    });
    renderRoute(`/admin/organizations/${organizationId}/students/${studentId}`);

    expect(
      await screen.findByRole('heading', { name: 'Family' }),
    ).toBeVisible();
    expect(await screen.findByText('Leela Rao')).toBeVisible();
    expect(screen.getByText('mother')).toBeVisible();
    expect(screen.getByText('Main contact')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Link family contact' }),
    ).toBeDisabled();
  });

  it('shows a clear message when student Family details cannot load', async () => {
    guardianMocks.listStudentFamilyContacts.mockRejectedValue(
      new ApiError('Family details unavailable.', 503),
    );
    renderRoute(`/admin/organizations/${organizationId}/students/${studentId}`);

    expect(
      await screen.findByText('Parent details could not be loaded.'),
    ).toBeVisible();
  });

  it('shows API errors and hides create actions without permission', async () => {
    guardianMocks.listFamilyContacts.mockRejectedValue(
      new ApiError('Family contact records unavailable.', 503),
    );
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['guardian.read'],
      campusIds: [],
    });
    renderRoute(`/admin/organizations/${organizationId}/guardians`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Family contact records unavailable.',
    );
    expect(
      screen.queryByRole('link', { name: 'Add family contact' }),
    ).not.toBeInTheDocument();
  });
});
