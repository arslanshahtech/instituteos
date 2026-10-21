import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.js';
import { createAppRouter } from '../app/router.js';
import { ApiError } from '../api/client.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import type { StudentInput, StudentRecord } from './students-api.js';

const studentMocks = vi.hoisted(() => ({
  listStudents: vi.fn(),
  getStudent: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
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

vi.mock('./students-api.js', () => studentMocks);
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
const record: StudentRecord = {
  id: studentId,
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: 'active',
  guardianIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const writablePermissions = [
  'student.read',
  'student.create',
  'student.update',
  'campus.read',
];

function renderStudentRoute(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createAppRouter({ initialEntries: [path] });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('student management pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getCurrentUser.mockResolvedValue({ user: authMocks.user });
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: writablePermissions,
      campusIds: [],
    });
    organizationMocks.getCampuses.mockResolvedValue({ campuses: [] });
    organizationMocks.getAccessibleOrganizations.mockResolvedValue({
      organizations: [],
    });
    studentMocks.listStudents.mockImplementation(
      async (
        _organization: string,
        input: { page: number; pageSize: number },
      ) => ({
        items: [record],
        total: 21,
        page: input.page,
        pageSize: input.pageSize,
      }),
    );
    studentMocks.getStudent.mockResolvedValue({ student: record });
    studentMocks.createStudent.mockImplementation(
      async (_organization: string, input: StudentInput) => ({
        student: { ...record, ...input },
      }),
    );
    studentMocks.updateStudent.mockImplementation(
      async (_organization: string, _student: string, input: StudentInput) => ({
        student: { ...record, ...input },
      }),
    );
  });

  it('loads the server-backed list and applies search, status, and page changes', async () => {
    const user = userEvent.setup();
    renderStudentRoute(`/admin/organizations/${organizationId}/students`);

    expect(
      await screen.findByRole('link', { name: 'Ada Lovelace' }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(studentId);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search students' }),
      'Ada',
    );
    await waitFor(() => {
      expect(studentMocks.listStudents).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({ search: 'Ada', page: 1 }),
      );
    });

    await user.selectOptions(
      screen.getByLabelText('Student status'),
      'inactive',
    );
    await waitFor(() => {
      expect(studentMocks.listStudents).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({ status: 'inactive', page: 1 }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(studentMocks.listStudents).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({ page: 2, pageSize: 20 }),
      );
    });
  });

  it('shows an empty state when the backend returns no students', async () => {
    studentMocks.listStudents.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    renderStudentRoute(`/admin/organizations/${organizationId}/students`);

    expect(await screen.findByText('No students yet')).toBeVisible();
    expect(
      screen.getByText(
        'Create the first student record for this organization.',
      ),
    ).toBeVisible();
  });

  it('shows a retryable error when the student list request fails', async () => {
    const user = userEvent.setup();
    studentMocks.listStudents.mockRejectedValueOnce(
      new ApiError('Student records are unavailable.', 503),
    );
    renderStudentRoute(`/admin/organizations/${organizationId}/students`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Student records are unavailable.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('link', { name: 'Ada Lovelace' }),
    ).toBeVisible();
  });

  it('validates and creates a student before opening the returned record', async () => {
    const user = userEvent.setup();
    renderStudentRoute(`/admin/organizations/${organizationId}/students/new`);

    await user.click(
      await screen.findByRole('button', { name: 'Create student' }),
    );
    expect(
      await screen.findAllByText('Enter at least two characters.'),
    ).toHaveLength(2);
    expect(studentMocks.createStudent).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Create student' }));

    await waitFor(() => {
      expect(studentMocks.createStudent).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'active',
        }),
      );
    });
    expect(
      await screen.findByRole('heading', { name: 'Ada Lovelace' }),
    ).toBeVisible();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Student created successfully.',
    );
  });

  it('requires campus admins to select an assigned campus before saving', async () => {
    const user = userEvent.setup();
    accessMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId,
      role: 'campus_admin',
      permissions: ['student.read', 'student.create', 'campus.read'],
      campusIds: ['650000000000000000000003'],
    });
    organizationMocks.getCampuses.mockResolvedValueOnce({
      campuses: [
        {
          id: '650000000000000000000003',
          organizationId,
          name: 'North Campus',
          status: 'active',
        },
      ],
    });
    renderStudentRoute(`/admin/organizations/${organizationId}/students/new`);

    await user.type(await screen.findByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Create student' }));
    expect(await screen.findByText('Select a campus.')).toBeVisible();
    expect(studentMocks.createStudent).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByLabelText('Campus'),
      '650000000000000000000003',
    );
    await user.click(screen.getByRole('button', { name: 'Create student' }));
    await waitFor(() => {
      expect(studentMocks.createStudent).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
          campusId: '650000000000000000000003',
        }),
      );
    });
  });

  it('loads student detail, saves edits, and hides unauthorized actions', async () => {
    const user = userEvent.setup();
    renderStudentRoute(
      `/admin/organizations/${organizationId}/students/${studentId}`,
    );

    expect(
      await screen.findByRole('heading', { name: 'Student details', level: 2 }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(studentId);
    expect(studentMocks.getStudent).toHaveBeenCalledWith(
      organizationId,
      studentId,
    );
    await user.click(screen.getByRole('link', { name: 'Edit student' }));
    await user.selectOptions(
      await screen.findByLabelText('Status'),
      'inactive',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(studentMocks.updateStudent).toHaveBeenCalledWith(
        organizationId,
        studentId,
        expect.objectContaining({ status: 'inactive' }),
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Student changes saved.',
    );
  });

  it('does not expose student mutation actions without their permissions', async () => {
    const readOnlyClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    accessMocks.getOrganizationAccessContext.mockResolvedValueOnce({
      organizationId,
      role: 'teacher',
      permissions: ['student.read'],
      campusIds: [],
    });
    const readOnlyRouter = createAppRouter({
      initialEntries: [`/admin/organizations/${organizationId}/students`],
    });
    render(
      <QueryClientProvider client={readOnlyClient}>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={readOnlyRouter} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole('link', { name: 'Ada Lovelace' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Add student' }),
    ).not.toBeInTheDocument();
    await readOnlyRouter.navigate(
      `/admin/organizations/${organizationId}/students/new`,
    );
    expect(
      await screen.findByRole('heading', { name: 'Access not available' }),
    ).toBeVisible();
  });
});
