import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.js';
import { createAppRouter } from '../app/router.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import type { StaffInput, StaffRecord } from './staff-api.js';

const staffMocks = vi.hoisted(() => ({
  listStaff: vi.fn(),
  getStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
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

vi.mock('./staff-api.js', () => staffMocks);
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
const staffId = '650000000000000000000002';
const staff: StaffRecord = {
  id: staffId,
  organizationId,
  firstName: 'Ada',
  lastName: 'Lovelace',
  employeeCode: 'EMP-014',
  department: 'Science',
  designation: 'Teacher',
  status: 'active',
  email: 'ada@example.test',
  qualifications: ['MSc Physics'],
  subjects: ['Physics'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const permissions = [
  'staff.read',
  'staff.create',
  'staff.update',
  'campus.read',
];

function renderStaffRoute(path: string) {
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

describe('staff management pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getCurrentUser.mockResolvedValue({ user: authMocks.user });
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions,
      campusIds: [],
    });
    organizationMocks.getCampuses.mockResolvedValue({
      campuses: [
        {
          id: '650000000000000000000003',
          organizationId,
          name: 'Central Campus',
          status: 'active',
        },
      ],
    });
    organizationMocks.getAccessibleOrganizations.mockResolvedValue({
      organizations: [],
    });
    staffMocks.listStaff.mockResolvedValue({
      items: [staff],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    staffMocks.getStaff.mockResolvedValue({ staff });
    staffMocks.createStaff.mockImplementation(
      async (_organization: string, input: StaffInput) => ({
        staff: { ...staff, ...input },
      }),
    );
    staffMocks.updateStaff.mockImplementation(
      async (_organization: string, _staffId: string, input: StaffInput) => ({
        staff: { ...staff, ...input },
      }),
    );
  });

  it('loads staff and sends search, department, status and campus filters to the server', async () => {
    const user = userEvent.setup();
    renderStaffRoute(`/admin/organizations/${organizationId}/staff`);
    expect(
      await screen.findByRole('link', { name: 'Ada Lovelace' }),
    ).toHaveAttribute(
      'href',
      `/admin/organizations/${organizationId}/staff/${staffId}`,
    );
    await user.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      'Ada',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Department' }),
      'Science',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status' }),
      'active',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Campus' }),
      '650000000000000000000003',
    );

    await waitFor(() => {
      expect(staffMocks.listStaff).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({
          search: 'Ada',
          department: 'Science',
          status: 'active',
          campusId: '650000000000000000000003',
        }),
      );
    });
  });

  it('creates a staff profile, navigates to its detail page and displays profile fields', async () => {
    const user = userEvent.setup();
    renderStaffRoute(`/admin/organizations/${organizationId}/staff/new`);

    await screen.findByRole('textbox', { name: 'First name' });
    await user.type(screen.getByRole('textbox', { name: 'First name' }), 'Ada');
    await user.type(
      screen.getByRole('textbox', { name: 'Last name' }),
      'Lovelace',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Employee code' }),
      'EMP-014',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Subjects / specialization' }),
      'Physics, Mathematics',
    );
    await user.click(
      screen.getByRole('button', { name: 'Create staff member' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Ada Lovelace' }),
    ).toBeInTheDocument();
    expect(staffMocks.createStaff).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        employeeCode: 'EMP-014',
        subjects: ['Physics', 'Mathematics'],
      }),
    );
    expect(screen.getByText('MSc Physics')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();
  });

  it('validates required name fields and submits changes from the edit form', async () => {
    const user = userEvent.setup();
    renderStaffRoute(
      `/admin/organizations/${organizationId}/staff/${staffId}/edit`,
    );
    await screen.findByDisplayValue('EMP-014');
    await user.clear(screen.getByRole('textbox', { name: 'First name' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Enter at least two characters.'),
    ).toBeInTheDocument();
    expect(staffMocks.updateStaff).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole('textbox', { name: 'First name' }),
      'Augusta',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(staffMocks.updateStaff).toHaveBeenCalledWith(
        organizationId,
        staffId,
        expect.objectContaining({ firstName: 'Augusta' }),
      );
    });
  });

  it('protects the list when staff.read is missing', async () => {
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'teacher',
      permissions: [],
      campusIds: [],
    });
    renderStaffRoute(`/admin/organizations/${organizationId}/staff`);
    expect(await screen.findByText('Access not available')).toBeInTheDocument();
    expect(staffMocks.listStaff).not.toHaveBeenCalled();
  });
});
