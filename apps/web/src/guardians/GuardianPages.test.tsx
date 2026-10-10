import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.js';
import { createAppRouter } from '../app/router.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import type { StudentRecord } from '../students/students-api.js';
import type { GuardianRecord, GuardianRelationship } from './guardians-api.js';

const guardianMocks = vi.hoisted(() => ({
  listGuardians: vi.fn(),
  getGuardian: vi.fn(),
  createGuardian: vi.fn(),
  updateGuardian: vi.fn(),
  listStudentGuardians: vi.fn(),
  linkGuardian: vi.fn(),
  unlinkGuardian: vi.fn(),
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

vi.mock('./guardians-api.js', () => guardianMocks);
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
const guardian: GuardianRecord = {
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
  const router = createAppRouter({ initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('guardian management pages', () => {
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
    guardianMocks.listGuardians.mockResolvedValue({
      items: [guardian],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    guardianMocks.getGuardian.mockResolvedValue({
      guardian,
      students: [],
    });
    guardianMocks.createGuardian.mockResolvedValue({ guardian });
    guardianMocks.updateGuardian.mockResolvedValue({ guardian });
    guardianMocks.listStudentGuardians.mockResolvedValue({ relations: [] });
    guardianMocks.linkGuardian.mockResolvedValue({ link: {} });
    guardianMocks.unlinkGuardian.mockResolvedValue(undefined);
    studentMocks.getStudent.mockResolvedValue({ student });
    studentMocks.listStudents.mockResolvedValue({
      items: [student],
      total: 1,
      page: 1,
      pageSize: 100,
    });
  });

  it('searches the server-backed guardian directory', async () => {
    const user = userEvent.setup();
    guardianMocks.listGuardians.mockImplementation(
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
      await screen.findByRole('link', { name: 'Leela Rao' }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(guardianId);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search guardians' }),
      'unknown',
    );
    expect(
      await screen.findByText('No guardians match this search'),
    ).toBeVisible();
    await waitFor(() => {
      expect(guardianMocks.listGuardians).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({ search: 'unknown', page: 1 }),
      );
    });
  });

  it('validates and creates a guardian before opening the returned record', async () => {
    const user = userEvent.setup();
    renderRoute(`/admin/organizations/${organizationId}/guardians/new`);

    await user.click(
      await screen.findByRole('button', { name: 'Create guardian' }),
    );
    expect(
      await screen.findAllByText('Enter at least two characters.'),
    ).toHaveLength(2);
    expect(guardianMocks.createGuardian).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('First name'), 'Leela');
    await user.type(screen.getByLabelText('Last name'), 'Rao');
    await user.type(screen.getByLabelText('Email'), 'leela@example.test');
    await user.click(screen.getByRole('button', { name: 'Create guardian' }));

    await waitFor(() => {
      expect(guardianMocks.createGuardian).toHaveBeenCalledWith(
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
      'Guardian created successfully.',
    );
  });

  it('updates guardian details and confirms the successful save', async () => {
    const user = userEvent.setup();
    renderRoute(
      `/admin/organizations/${organizationId}/guardians/${guardianId}/edit`,
    );

    const firstName = await screen.findByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Leela Devi');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(guardianMocks.updateGuardian).toHaveBeenCalledWith(
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
      'Guardian changes saved.',
    );
  });

  it('shows linked student names without displaying record identifiers', async () => {
    guardianMocks.getGuardian.mockResolvedValue({
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
      `/admin/organizations/${organizationId}/guardians/${guardianId}`,
    );

    expect(await screen.findByRole('link', { name: 'Mina Rao' })).toBeVisible();
    expect(document.body).not.toHaveTextContent(studentId);
    expect(document.body).not.toHaveTextContent(guardianId);
  });

  it('links a guardian from the student detail page', async () => {
    const user = userEvent.setup();
    let relations: {
      id: string;
      relationship: GuardianRelationship;
      isPrimary: boolean;
      guardian: GuardianRecord;
    }[] = [];
    guardianMocks.listGuardians.mockResolvedValue({
      items: [guardian],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    guardianMocks.listStudentGuardians.mockImplementation(async () => ({
      relations,
    }));
    guardianMocks.linkGuardian.mockImplementation(
      async (
        _organizationId: string,
        _studentId: string,
        _guardianId: string,
        input: { relationship: GuardianRelationship; isPrimary: boolean },
      ) => {
        relations = [
          {
            id: 'link-1',
            relationship: input.relationship,
            isPrimary: input.isPrimary,
            guardian,
          },
        ];
        return { link: {} };
      },
    );
    guardianMocks.unlinkGuardian.mockImplementation(async () => {
      relations = [];
    });
    renderRoute(`/admin/organizations/${organizationId}/students/${studentId}`);

    expect(
      await screen.findByText('No guardians are linked to this student yet.'),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Link existing guardian'),
      guardianId,
    );
    await user.click(screen.getByRole('button', { name: 'Link guardian' }));

    await waitFor(() => {
      expect(guardianMocks.linkGuardian).toHaveBeenCalledWith(
        organizationId,
        studentId,
        guardianId,
        { relationship: 'guardian', isPrimary: false },
      );
    });
    expect(
      await screen.findByText('Guardian linked to student.'),
    ).toBeVisible();
    expect(
      await screen.findByRole('link', { name: 'Leela Rao' }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Unlink' }));
    expect(
      await screen.findByText('No guardians are linked to this student yet.'),
    ).toBeVisible();
    expect(await screen.findByText('Guardian unlinked.')).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText('Link existing guardian'),
      guardianId,
    );
    await user.click(screen.getByRole('button', { name: 'Link guardian' }));
    expect(
      await screen.findByRole('link', { name: 'Leela Rao' }),
    ).toBeVisible();
    expect(guardianMocks.linkGuardian).toHaveBeenCalledTimes(2);
    expect(guardianMocks.unlinkGuardian).toHaveBeenCalledWith(
      organizationId,
      studentId,
      guardianId,
    );
  });

  it('keeps guardian search available while loading and resolves full-name results', async () => {
    const user = userEvent.setup();
    guardianMocks.listGuardians.mockImplementation(
      async (
        _organization: string,
        input: { search?: string; page: number; pageSize: number },
      ) => {
        const search = input.search?.trim().toLowerCase().replace(/\s+/g, ' ');
        return {
          items: !search || search === 'leela rao' ? [guardian] : [],
          total: !search || search === 'leela rao' ? 1 : 0,
          page: input.page,
          pageSize: input.pageSize,
        };
      },
    );
    renderRoute(`/admin/organizations/${organizationId}/students/${studentId}`);

    const search = await screen.findByRole('textbox', {
      name: 'Find guardian',
    });
    await user.type(search, '  LEELA   RAO  ');
    await waitFor(() => {
      expect(guardianMocks.listGuardians).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ search: 'LEELA   RAO', page: 1 }),
      );
    });
    expect(
      await screen.findByRole('option', { name: 'Leela Rao' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Loading guardian choices…'),
    ).not.toBeInTheDocument();
  });

  it('shows an error instead of remaining in guardian-search loading state', async () => {
    const user = userEvent.setup();
    guardianMocks.listGuardians
      .mockResolvedValueOnce({
        items: [guardian],
        total: 1,
        page: 1,
        pageSize: 20,
      })
      .mockRejectedValueOnce(
        new ApiError('Guardian search failed.', 503, undefined, 'req-123'),
      )
      .mockResolvedValue({
        items: [guardian],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    renderRoute(`/admin/organizations/${organizationId}/students/${studentId}`);

    const search = await screen.findByRole('textbox', {
      name: 'Find guardian',
    });
    await user.type(search, 'Leela');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Guardian search failed. (Reference: req-123)',
    );
    expect(search).toBeInTheDocument();
    expect(
      screen.queryByText('Loading guardian choices…'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('option', { name: 'Leela Rao' }),
    ).toBeVisible();
  });

  it('shows API errors and hides create actions without permission', async () => {
    guardianMocks.listGuardians.mockRejectedValue(
      new ApiError('Guardian records unavailable.', 503),
    );
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['guardian.read'],
      campusIds: [],
    });
    renderRoute(`/admin/organizations/${organizationId}/guardians`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Guardian records unavailable.',
    );
    expect(
      screen.queryByRole('link', { name: 'Add guardian' }),
    ).not.toBeInTheDocument();
  });
});
