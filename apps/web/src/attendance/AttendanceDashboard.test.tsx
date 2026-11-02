import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceDashboard } from './AttendanceDashboard.js';

const accessState = vi.hoisted(() => ({
  role: 'organization_admin',
  permissions: ['attendance.read', 'academics.read'],
}));

vi.mock('../staff/StaffPageShared.js', () => ({
  apiMessage: () => 'Attendance request failed.',
  useOrganizationAccess: () => ({
    data: {
      organizationId: '650000000000000000000001',
      role: accessState.role,
      permissions: accessState.permissions,
      campusIds: [],
    },
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../academics/academics-queries.js', () => ({
  useAcademicsWorkspace: () => ({
    campuses: {
      data: { campuses: [{ id: 'campus-1', name: 'Main Campus' }] },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    years: {
      data: { items: [{ id: 'year-1', name: '2026–2027', status: 'active' }] },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    classes: {
      data: {
        items: [{ id: 'class-1', name: 'Grade 8', campusId: 'campus-1' }],
      },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    sections: {
      data: { items: [{ id: 'section-1', name: 'A', classId: 'class-1' }] },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
  }),
}));

vi.mock('./attendance-api.js', () => ({
  listTeacherAttendanceAssignments: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../staff/staff-api.js', () => ({
  listStaff: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('./attendance-queries.js', () => ({
  useAttendanceRoster: () => ({
    data: {
      items: [
        {
          id: 'student-1',
          firstName: 'Ali',
          lastName: 'Khan',
          status: 'present',
        },
      ],
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useEligibleStudents: () => ({
    data: { items: [] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePlaceStudent: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useSaveStudentAttendance: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useSaveStaffAttendance: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useStaffAttendance: () => ({
    data: { items: [] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function renderAttendance() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          '/admin/organizations/650000000000000000000001/attendance',
        ]}
      >
        <Routes>
          <Route
            element={<AttendanceDashboard />}
            path="/admin/organizations/:organizationId/attendance"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AttendanceDashboard permissions', () => {
  it('allows reading attendance but disables all write controls without attendance.write', () => {
    accessState.role = 'organization_admin';
    accessState.permissions = ['attendance.read', 'academics.read'];
    renderAttendance();

    expect(screen.getByRole('status')).toHaveTextContent('read-only access');
    expect(screen.getByRole('button', { name: 'Present' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Save Attendance' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('Place an enrolled student in this section'),
    ).not.toBeInTheDocument();
  });

  it('denies attendance access when the membership lacks attendance.read', () => {
    accessState.role = 'organization_admin';
    accessState.permissions = ['academics.read'];
    renderAttendance();

    expect(
      screen.queryByRole('button', { name: 'Save Attendance' }),
    ).not.toBeInTheDocument();
  });
});
