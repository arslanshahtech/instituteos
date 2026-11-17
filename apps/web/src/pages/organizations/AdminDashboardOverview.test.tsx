import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardOverview } from './AdminDashboardOverview.js';

vi.mock('../../admissions/admissions-api.js', () => ({
  listApplications: vi.fn(),
}));
vi.mock('../../academics/academics-api.js', () => ({
  listAcademicYears: vi.fn(),
  listSectionTimetables: vi.fn(),
}));
vi.mock('../../attendance/attendance-api.js', () => ({
  listStudentAttendance: vi.fn(),
}));
vi.mock('../../finance/finance-api.js', () => ({
  listDailyCollections: vi.fn(),
  listInvoices: vi.fn(),
}));
vi.mock('../../communications/communications-api.js', () => ({
  listAnnouncements: vi.fn(),
}));
vi.mock('../../examinations/examinations-api.js', () => ({
  listExams: vi.fn(),
}));
vi.mock('../../staff/staff-api.js', () => ({ listStaff: vi.fn() }));
vi.mock('../../students/students-api.js', () => ({ listStudents: vi.fn() }));
vi.mock('../../reporting/reporting-api.js', () => ({
  useOrganizationSummary: vi.fn(),
}));

import { listApplications } from '../../admissions/admissions-api.js';
import {
  listAcademicYears,
  listSectionTimetables,
} from '../../academics/academics-api.js';
import { listStudentAttendance } from '../../attendance/attendance-api.js';
import {
  listDailyCollections,
  listInvoices,
} from '../../finance/finance-api.js';
import { listAnnouncements } from '../../communications/communications-api.js';
import { listExams } from '../../examinations/examinations-api.js';
import { listStaff } from '../../staff/staff-api.js';
import { listStudents } from '../../students/students-api.js';
import { useOrganizationSummary } from '../../reporting/reporting-api.js';

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

const allDashboardPermissions = [
  'reporting.read',
  'student.read',
  'finance.read',
  'attendance.read',
  'admission.read',
  'staff.read',
  'examination.read',
  'communication.read',
  'academics.read',
];

function renderDashboard(permissions = allDashboardPermissions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminDashboardOverview
          organizationId="org-1"
          permissions={permissions}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminDashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const today = new Date();
    const todayKey = localDateKey(today);
    const weekday = today
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();

    vi.mocked(useOrganizationSummary).mockReturnValue({
      data: {
        summary: {
          activeStudentCount: 42,
          activeStaffCount: 8,
          activeClassCount: 5,
          finance: {
            totalInvoiced: 50000,
            totalCollected: 38000,
            totalPending: 12000,
            totalOverdue: 5000,
          },
          attendance: { todayAttendanceRate: 90, recordsCount: 2 },
        },
      },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(listStudents).mockResolvedValue({
      items: [],
      total: 42,
      page: 1,
      pageSize: 1,
    });
    vi.mocked(listDailyCollections).mockResolvedValue({
      items: [{ date: todayKey, amountCollected: 12500, paymentCount: 5 }],
    });
    vi.mocked(listStudentAttendance).mockResolvedValue({
      items: [
        { date: todayKey, status: 'present' },
        { date: todayKey, status: 'absent' },
      ],
    } as never);
    vi.mocked(listApplications).mockResolvedValue({
      items: [
        {
          id: 'app-1',
          firstName: 'Amina',
          lastName: 'Khan',
          program: 'Class 8',
          status: 'submitted',
          createdAt: todayKey,
        },
        {
          id: 'app-2',
          firstName: 'Bilal',
          lastName: 'Ali',
          program: 'Class 9',
          status: 'approved',
          createdAt: todayKey,
        },
        {
          id: 'app-3',
          firstName: 'Sara',
          lastName: 'Noor',
          program: 'Class 7',
          status: 'in_review',
          createdAt: todayKey,
        },
      ],
      total: 3,
      page: 1,
      pageSize: 20,
    } as never);
    vi.mocked(listInvoices).mockResolvedValue({ items: [] });
    vi.mocked(listStaff).mockResolvedValue({
      items: [
        {
          id: 'staff-1',
          firstName: 'Hina',
          lastName: 'Ahmed',
          designation: 'Science Teacher',
          department: 'Science',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
    } as never);
    vi.mocked(listExams).mockResolvedValue({ items: [] });
    vi.mocked(listAnnouncements).mockResolvedValue({ items: [] });
    vi.mocked(listAcademicYears).mockResolvedValue({
      items: [{ id: 'year-1', name: '2026-27', status: 'active' }],
    } as never);
    vi.mocked(listSectionTimetables).mockResolvedValue({
      items: [
        {
          sectionId: 'section-1',
          entries: [
            {
              id: 'period-1',
              dayOfWeek: weekday,
              startTime: '09:00',
              endTime: '09:45',
              type: 'class',
              name: 'Mathematics',
            },
          ],
        },
      ],
    } as never);
  });

  it('renders the reference dashboard hierarchy with three operation cards and a separate timetable row', async () => {
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Recent Admissions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Recent Admissions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Fee Defaulters' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Staff on Leave' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Hina Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Science Teacher')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: "Today's Timetable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Important Notices & Tasks' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Reports & Export' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Transport Status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open Reports & Export/ }),
    ).toHaveAttribute('href', '/admin/organizations/org-1/reports');
    expect(screen.getByText('Active Staff')).toBeInTheDocument();
    expect(screen.getByText('Total Billed')).toBeInTheDocument();
    expect(screen.getByText('Collected')).toBeInTheDocument();
    expect(screen.getByText('Dues')).toBeInTheDocument();
    expect(screen.getByText('76% of billed fees')).toBeInTheDocument();
    expect(
      screen.getByText('24% of billed fees outstanding'),
    ).toBeInTheDocument();

    const weeklyButton = screen.getByRole('button', { name: 'Weekly' });
    fireEvent.click(weeklyButton);
    expect(weeklyButton).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('img', { name: 'Weekly fee collection trend' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does not expose finance figures without finance.read', async () => {
    renderDashboard([
      'reporting.read',
      'student.read',
      'attendance.read',
      'admission.read',
      'staff.read',
      'examination.read',
      'communication.read',
      'academics.read',
    ]);

    expect(
      await screen.findByText('Finance information unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Collection trend is unavailable for your current access.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Rs. 12,000')).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue: Rs. 5,000')).not.toBeInTheDocument();
  });

  it('filters the admissions feed and switches the live collection chart period', async () => {
    renderDashboard();

    expect(await screen.findByText('Amina Khan')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Monthly fee collection trend' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bilal Ali')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    await waitFor(() => {
      expect(screen.getByText('Amina Khan')).toBeInTheDocument();
      expect(screen.queryByText('Bilal Ali')).not.toBeInTheDocument();
    });

    const weeklyButton = screen.getByRole('button', { name: 'Weekly' });
    fireEvent.click(weeklyButton);
    expect(weeklyButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
