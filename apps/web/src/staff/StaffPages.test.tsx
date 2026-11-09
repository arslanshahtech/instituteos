import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.js';
import { createAppRouter } from '../app/router.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import type { StaffInput, StaffRecord } from './staff-api.js';

const attendanceMocks = vi.hoisted(() => ({ listStaffAttendance: vi.fn() }));

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
vi.mock('../attendance/attendance-api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../attendance/attendance-api.js')>();
  return { ...actual, listStaffAttendance: attendanceMocks.listStaffAttendance };
});
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
  staffType: 'teacher',
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
  client.setQueryData(['auth', 'current-user'], authMocks.user);
  const router = createAppRouter({ initialEntries: [path] });
  return render(
    <QueryClientProvider client={client}>
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

describe('staff management pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attendanceMocks.listStaffAttendance.mockResolvedValue({ items: [] });
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

  it('loads staff and sends search, staff type and status filters to the server', async () => {
    const user = userEvent.setup();
    renderStaffRoute(`/admin/organizations/${organizationId}/staff`);
    expect(
      await screen.findByRole(
        'link',
        { name: 'Ada Lovelace' },
        { timeout: 8_000 },
      ),
    ).toHaveAttribute(
      'href',
      `/admin/organizations/${organizationId}/staff/${staffId}`,
    );
    await user.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      'Ada',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Staff Type' }),
      'teacher',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status' }),
      'active',
    );

    await waitFor(() => {
      expect(staffMocks.listStaff).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({
          search: 'Ada',
          staffType: 'teacher',
          status: 'active',
        }),
      );
    });
  }, 10_000);

  it('shows staff directory columns and permission-aware profile actions', async () => {
    const user = userEvent.setup();
    renderStaffRoute(`/admin/organizations/${organizationId}/staff`);

    expect(
      await screen.findByRole('columnheader', { name: 'Employee ID' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff directory' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Designation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Staff Type' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Campus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Contact' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('EMP-014')).toBeInTheDocument();
    expect(screen.getAllByText('Teacher').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: 'View profile for Ada Lovelace' }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' + organizationId + '/staff/' + staffId,
    );
    expect(
      screen.getByRole('link', { name: 'View timetable for Ada Lovelace' }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' +
        organizationId +
        '/staff/' +
        staffId +
        '/timetable',
    );
    expect(
      screen.getByRole('link', { name: 'Edit Ada Lovelace' }),
    ).toHaveAttribute(
      'href',
      '/admin/organizations/' + organizationId + '/staff/' + staffId + '/edit',
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(
      screen.getByRole('button', { name: 'Archive Ada Lovelace' }),
    );
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(staffMocks.updateStaff).toHaveBeenCalledWith(
        organizationId,
        staffId,
        { status: 'inactive' },
      );
    });
    confirmSpy.mockRestore();
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
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('textbox', { name: 'Employee ID / code' });
    await user.type(
      screen.getByRole('textbox', { name: 'Employee ID / code' }),
      'EMP-014',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Subjects / specialization' }),
      'Physics, Mathematics',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: 'Review & account access' });
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
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('MSc Physics')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Attendance' }));
    expect(await screen.findByText('No attendance records yet')).toBeInTheDocument();
    expect(attendanceMocks.listStaffAttendance).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ staffId }),
    );

    await user.click(screen.getByRole('tab', { name: 'Leave' }));
    expect(screen.getByText('Leave management is not connected yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Salary' }));
    expect(screen.getByText('Payroll records are not configured yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByText('Staff document storage is not connected yet')).toBeInTheDocument();
  });
  it('loads existing staff details into the edit form', async () => {
    renderStaffRoute(
      `/admin/organizations/${organizationId}/staff/${staffId}/edit`,
    );
    expect(await screen.findByDisplayValue('Ada')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lovelace')).toBeInTheDocument();
    expect(staffMocks.updateStaff).not.toHaveBeenCalled();
  });
  it('protects the list when staff.read is missing', async () => {
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: [],
      campusIds: [],
    });
    renderStaffRoute(`/admin/organizations/${organizationId}/staff`);
    expect(await screen.findByText('Access not available')).toBeInTheDocument();
    expect(staffMocks.listStaff).not.toHaveBeenCalled();
  });
});
