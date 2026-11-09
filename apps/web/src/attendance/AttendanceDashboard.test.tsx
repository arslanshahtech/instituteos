import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceDashboard } from './AttendanceDashboard.js';

vi.mock('./AttendanceClassesOverview.js', () => ({
  AttendanceClassesOverview: ({
    onOpenRegister,
    canWrite,
    sections,
    date,
    onDateChange,
  }: {
    onOpenRegister: (classId: string, sectionId: string) => void;
    canWrite: boolean;
    sections: Array<{ id: string; name: string; classId: string }>;
    date: string;
    onDateChange: (date: string) => void;
  }) => (
    <div>
      <h2>Class attendance overview</h2>
      <span>Grade 8</span>
      <span data-testid="overview-sections">
        {sections
          .map((section) => `${section.classId}:${section.name}`)
          .join(', ')}
      </span>
      <label>
        Date
        <input
          aria-label="Attendance date"
          onChange={(event) => onDateChange(event.target.value)}
          type="date"
          value={date}
        />
      </label>
      {canWrite && <button type="button">Mark All Present</button>}
      <button
        onClick={() => onOpenRegister('class-1', 'section-1')}
        type="button"
      >
        Mark Attendance
      </button>
    </div>
  ),
}));

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
        items: [
          { id: 'class-1', name: 'First Year', campusId: 'campus-1' },
          { id: 'class-2', name: 'Second Year', campusId: 'campus-1' },
        ],
      },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    sections: {
      data: {
        items: [
          { id: 'section-1', name: 'A', classId: 'class-1' },
          { id: 'section-2', name: 'B', classId: 'class-1' },
          { id: 'section-3', name: 'C', classId: 'class-1' },
          { id: 'section-4', name: 'A', classId: 'class-2' },
        ],
      },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
  }),
}));

vi.mock('../academics/academics-api.js', () => ({
  getAcademicYearSummary: vi.fn().mockResolvedValue({
    summary: {
      bySection: [
        { academicYearId: 'year-1', sectionId: 'section-1', students: 1 },
      ],
    },
  }),
}));

vi.mock('./attendance-api.js', () => ({
  listTeacherAttendanceAssignments: vi.fn().mockResolvedValue({ items: [] }),
  getAcademicYearSummary: vi.fn().mockResolvedValue({
    summary: {
      bySection: [
        { academicYearId: 'year-1', sectionId: 'section-1', students: 1 },
      ],
    },
  }),
  listStudentAttendance: vi.fn().mockResolvedValue({ items: [] }),
  getStudentRoster: vi.fn().mockResolvedValue({ items: [] }),
  saveStudentAttendance: vi.fn().mockResolvedValue({ items: [] }),
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

function renderAttendance(openStudents = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
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
  if (openStudents) {
    const studentsTab = screen.queryByRole('button', { name: 'Students' });
    if (studentsTab) fireEvent.click(studentsTab);
  }
  return result;
}

describe('AttendanceDashboard permissions', () => {
  it('opens on the Classes overview and opens a class register', async () => {
    accessState.role = 'organization_admin';
    accessState.permissions = [
      'attendance.read',
      'attendance.write',
      'academics.read',
    ];
    renderAttendance(false);

    expect(
      await screen.findByRole('heading', { name: 'Class attendance overview' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Grade 8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Attendance' }));
    expect(screen.getByLabelText('Search students')).toBeInTheDocument();
  });
  it('passes every section across all campus classes to the Classes overview', async () => {
    accessState.role = 'organization_admin';
    accessState.permissions = ['attendance.read', 'academics.read'];
    renderAttendance(false);

    expect(await screen.findByTestId('overview-sections')).toHaveTextContent(
      'class-1:A, class-1:B, class-1:C, class-2:A',
    );
  });

  it('allows reading attendance but disables all write controls without attendance.write', () => {
    accessState.role = 'organization_admin';
    accessState.permissions = ['attendance.read', 'academics.read'];
    renderAttendance();

    expect(screen.getByRole('status')).toHaveTextContent('read-only access');
    expect(
      screen.queryByRole('button', { name: 'Mark All Present' }),
    ).not.toBeInTheDocument();
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

  it('defaults the attendance date to the current local day', () => {
    accessState.role = 'organization_admin';
    accessState.permissions = ['attendance.read', 'academics.read'];
    renderAttendance();

    const now = new Date();
    const localToday = new Date(
      now.getTime() - now.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 10);
    expect(screen.getByLabelText('Date')).toHaveValue(localToday);
  });

  it('supports marking the entire selected class present in one action', () => {
    accessState.role = 'organization_admin';
    accessState.permissions = [
      'attendance.read',
      'attendance.write',
      'academics.read',
    ];
    renderAttendance();

    expect(
      screen.getByRole('button', { name: 'Mark All Present' }),
    ).toBeInTheDocument();
  });
});
