import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentPortalPage } from './ParentPortalPage.js';

const mocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
  getPortalMe: vi.fn(),
  listSchoolEvents: vi.fn(),
  useParentAnnouncements: vi.fn(),
  useThreads: vi.fn(),
  useThreadDetail: vi.fn(),
  useSendReply: vi.fn(),
  useStartConversation: vi.fn(),
  useMessagingContacts: vi.fn(),
  user: {
    id: 'parent-user-1',
    email: 'parent@example.test',
    displayName: 'Parent',
  },
}));

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../tenancy/tenancy-api.js', () => ({
  getOrganizationAccessContext: mocks.getOrganizationAccessContext,
}));

vi.mock('./portal-api.js', () => ({
  getPortalMe: mocks.getPortalMe,
}));

vi.mock('../events-holidays/events-holidays-api.js', () => ({
  listSchoolEvents: mocks.listSchoolEvents,
}));

vi.mock('../communications/communications-api.js', () => ({
  useThreads: mocks.useThreads,
  useThreadDetail: mocks.useThreadDetail,
  useSendReply: mocks.useSendReply,
  useStartConversation: mocks.useStartConversation,
  useMessagingContacts: mocks.useMessagingContacts,
  useParentAnnouncements: mocks.useParentAnnouncements,
}));

const organizationId = '650000000000000000000001';

const portalResponse = {
  role: 'parent_guardian' as const,
  guardian: {
    firstName: 'Nadia',
    lastName: 'Rao',
    displayName: 'Nadia Rao',
  },
  students: [
    {
      id: 'student-1',
      firstName: 'Mina',
      lastName: 'Rao',
      displayName: 'Mina Rao',
      status: 'active',
      campusName: 'Main Campus',
      className: 'First Year',
      sectionName: 'A',
      attendance: {
        totalMarked: 2,
        present: 1,
        absent: 1,
        late: 0,
        leave: 0,
        percentage: 50,
        records: [
          { date: '2025-10-12', status: 'absent', remarks: 'Not present' },
          { date: '2025-10-11', status: 'present', remarks: '' },
        ],
      },
      fees: {
        totalOutstanding: 1500,
        totalPaid: 3500,
        totalInvoiced: 5000,
        invoices: [
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            billingCycle: 'October 2025',
            issueDate: '2025-10-01',
            dueDate: '2025-10-10',
            totalAmount: 5000,
            paidAmount: 3500,
            discountAmount: 0,
            arrearsAmount: 0,
            outstandingAmount: 1500,
            status: 'partial',
          },
        ],
        receipts: [
          {
            id: 'receipt-1',
            receiptNumber: 'RCP-001',
            invoiceNumber: 'INV-001',
            billingCycle: 'October 2025',
            amountPaid: 3500,
            paymentMethod: 'bank_transfer',
            transactionReference: 'TXN-7788',
            paymentDate: '2025-10-08',
          },
        ],
      },
      results: [
        {
          id: 'result-1',
          examName: 'Mid Term Examination 2026',
          subjectName: 'Mathematics',
          date: '2026-11-10',
          marksObtained: 42,
          totalMarks: 50,
          percentage: 84,
          grade: 'A',
          isAbsent: false,
        },
        {
          id: 'result-2',
          examName: 'Mid Term Examination 2026',
          subjectName: 'English',
          date: '2026-11-11',
          marksObtained: 36,
          totalMarks: 50,
          percentage: 72,
          grade: 'B',
          isAbsent: false,
        },
      ],
      resultsAvailable: true,
      homework: [
        {
          id: 'homework-1',
          title: 'Chapter 4 exercises',
          type: 'homework',
          subjectName: 'Mathematics',
          teacherName: 'School administration',
          dueDate: '2026-11-12',
          assignedDate: '2026-11-06',
          instructions: 'Complete questions 1-5.',
          totalMarks: null,
        },
      ],
    },
    {
      id: 'student-2',
      firstName: 'Arman',
      lastName: 'Rao',
      displayName: 'Arman Rao',
      status: 'active',
      campusName: 'Main Campus',
      className: 'Second Year',
      sectionName: 'B',
      attendance: {
        totalMarked: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        percentage: null,
        records: [],
      },
      fees: {
        totalOutstanding: 0,
        totalPaid: 0,
        totalInvoiced: 0,
        invoices: [],
        receipts: [],
      },
      results: [],
      resultsAvailable: false,
      homework: [],
    },
  ],
};

function renderParentPortal(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/parent/organizations/:organizationId/:section?"
            element={<ParentPortalPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('parent workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'parent_guardian',
      permissions: [],
      campusIds: [],
    });
    mocks.getPortalMe.mockResolvedValue(portalResponse);
    mocks.useThreads.mockReturnValue({ data: { items: [] }, isLoading: false });
    mocks.useThreadDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mocks.useSendReply.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mocks.useStartConversation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mocks.useMessagingContacts.mockReturnValue({
      data: {
        items: [
          {
            studentId: 'student-1',
            studentName: 'Mina Rao',
            className: 'First Year',
            sectionName: 'A',
            teachers: [{ userId: 'teacher-1', displayName: 'Class Teacher' }],
            guardians: [],
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    mocks.useParentAnnouncements.mockReturnValue({
      data: {
        items: [
          {
            id: 'announcement-1',
            title: 'Nursery orientation',
            content: 'Orientation details for families.',
            publishDate: '2026-11-15',
            isPinned: true,
          },
          {
            id: 'announcement-2',
            title: 'School timing update',
            content: 'Updated school timings.',
            publishDate: '2026-11-14',
            isPinned: false,
          },
          {
            id: 'announcement-3',
            title: 'Older notice',
            content: 'An older update.',
            publishDate: '2026-11-10',
            isPinned: false,
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    mocks.listSchoolEvents.mockResolvedValue({
      items: [
        {
          id: 'holiday-1',
          title: 'Mid-term break',
          type: 'holiday',
          noClasses: true,
          startDate: '2026-11-10',
          endDate: '2026-11-11',
          remarks: '',
          createdAt: null,
        },
      ],
      summary: { holidays: 1, events: 0, total: 1, past: 0 },
    });
  });

  it('shows only the children returned by the linked-family portal and allows sibling selection', async () => {
    const user = userEvent.setup();
    renderParentPortal(`/parent/organizations/${organizationId}`);

    expect(
      await screen.findByRole('heading', { name: "Your Child's Progress" }),
    ).toBeVisible();
    expect(screen.getByText('Mina Rao')).toBeVisible();
    expect(screen.queryByText(/Welcome back,/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Student information' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your linked children' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('ATTENDANCE RATE')).toBeVisible();
    expect(screen.getByText('FEES OUTSTANDING')).toBeVisible();
    expect(screen.getByText('OVERALL AVERAGE')).toBeVisible();
    expect(screen.getByText('DAILY DIARY')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Attendance Calendar' }),
    ).toBeVisible();
    expect(screen.getByText(/November 2026/)).toBeVisible();
    expect(
      screen.getByLabelText('1 Nov').closest('.parent-calendar-day'),
    ).toBeVisible();
    expect(document.querySelectorAll('.parent-calendar-day')).toHaveLength(30);
    expect(mocks.listSchoolEvents).toHaveBeenCalledWith(organizationId);
    expect(
      screen.getByRole('heading', { name: 'Progress by Subject' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Fees History' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Recent Results' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Notices' }),
    ).not.toBeInTheDocument();
    const picker = await screen.findByRole('combobox', {
      name: 'Select linked student',
    });
    await user.selectOptions(picker, 'student-2');

    expect(picker).toHaveValue('student-2');
    expect(screen.getByText('Arman Rao')).toBeVisible();
    expect(mocks.getPortalMe).toHaveBeenCalledWith(organizationId);
  });

  it('keeps the parent Messages header and student selector single and compact', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/messages`);

    expect(
      await screen.findByRole('heading', { name: 'Messages', level: 1 }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('heading', { name: 'Messages', level: 1 }),
    ).toHaveLength(1);
    expect(
      screen.queryByText("Private conversations with your child's teachers."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Viewing student')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'College messages' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('All chats')).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Select linked student' }),
    ).toHaveValue('student-1');
    expect(
      screen.queryByLabelText('Filter conversations by student'),
    ).not.toBeInTheDocument();
  });

  it('shows an accessible exam overview and subject-wise published results', async () => {
    renderParentPortal('/parent/organizations/' + organizationId + '/results');
    expect(
      await screen.findByRole('heading', { name: 'Results', level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Exam results' })).toBeVisible();
    expect(screen.getByText('Published results')).toBeVisible();
    expect(screen.getByText('Subjects assessed')).toBeVisible();
    expect(screen.getByText('Average score')).toBeVisible();
    expect(screen.getByText('78%')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Mid Term Examination 2026' }),
    ).toBeVisible();
    expect(screen.getByText('Mathematics')).toBeVisible();
    expect(screen.getByText('42 / 50 marks')).toBeVisible();
    expect(screen.getByText('English')).toBeVisible();
    expect(screen.getByText('36 / 50 marks')).toBeVisible();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(
      screen.queryByText(
        /A clear view of your child's published exam performance/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Results shown here are read-only/),
    ).not.toBeInTheDocument();
  });
  it('opens the Daily Diary section and shows published work for the selected child', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/homework`);

    expect(
      await screen.findByRole('heading', {
        name: 'Daily Diary',
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getByText('Chapter 4 exercises')).toBeVisible();
    expect(screen.getByText(/Mathematics/)).toBeVisible();
    expect(screen.getByText(/School administration/)).toBeVisible();
    expect(screen.getByText('Teacher instructions')).toBeVisible();
    expect(screen.getByText('Complete questions 1-5.')).toBeVisible();
    expect(document.querySelector('.parent-diary-type')).toHaveTextContent(
      'Homework',
    );
    expect(screen.getByLabelText('Work type')).toHaveValue('all');
  });

  it('shows attendance history including absences for the selected child', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/attendance`);

    expect(
      await screen.findByRole('heading', { name: 'Attendance history' }),
    ).toBeVisible();
    expect(document.querySelector('.parent-status-absent')).toHaveTextContent(
      'Absent',
    );
    expect(screen.getByText('12 Oct 2025')).toBeVisible();
    expect(document.querySelector('.parent-status-present')).toHaveTextContent(
      'Present',
    );
    expect(
      document.querySelector('.parent-attendance-stat.is-absent'),
    ).toHaveTextContent('Absent');
    expect(
      document.querySelector('.parent-attendance-stat.is-late'),
    ).toHaveTextContent('Late');
    expect(
      document.querySelector('.parent-attendance-stat.is-leave'),
    ).toHaveTextContent('Leave');
    expect(
      screen.getByRole('combobox', { name: 'Attendance period' }),
    ).toHaveValue('all');
    expect(
      screen.getByRole('progressbar', { name: 'All time attendance rate' }),
    ).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('2 recorded days')).toBeVisible();
  });

  it('updates the four attendance cards when the summary period changes', async () => {
    const user = userEvent.setup();
    renderParentPortal(
      '/parent/organizations/' + organizationId + '/attendance',
    );

    const period = await screen.findByRole('combobox', {
      name: 'Attendance period',
    });
    expect(document.querySelectorAll('.parent-attendance-stat')).toHaveLength(
      4,
    );
    expect(
      document.querySelector('.parent-attendance-stat.is-present'),
    ).toHaveTextContent('1');
    expect(
      document.querySelector('.parent-attendance-stat.is-absent'),
    ).toHaveTextContent('1');

    await user.selectOptions(period, 'month');
    expect(period).toHaveValue('month');
    expect(
      screen.getByRole('progressbar', { name: 'This month attendance rate' }),
    ).toHaveAttribute('aria-valuenow', '0');

    await user.selectOptions(period, 'week');
    expect(period).toHaveValue('week');
    expect(
      screen.getByRole('progressbar', { name: 'This week attendance rate' }),
    ).toHaveAttribute('aria-valuenow', '0');
    expect(document.querySelectorAll('.parent-attendance-stat')).toHaveLength(
      4,
    );
    expect(screen.getByText('12 Oct 2025')).toBeVisible();
  });
  it('shows fee summaries, invoice progress, recorded receipts and print actions without online payment', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/fees`);

    expect(
      await screen.findByRole('heading', { name: 'Fee overview' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Fee invoices' })).toBeVisible();
    expect(screen.getByText('INV-001 ? Issued 1 Oct 2025')).toBeVisible();
    expect(screen.getByText('Partially paid')).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: 'INV-001 payment progress' }),
    ).toHaveAttribute('aria-valuenow', '70');
    expect(
      screen.getByRole('heading', { name: 'Payment receipts' }),
    ).toBeVisible();
    expect(screen.getByText('RCP-001')).toBeVisible();
    expect(screen.getByText(/bank transfer/i)).toBeVisible();
    expect(
      screen.getByRole('button', { name: /print \/ save/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /pay online/i }),
    ).not.toBeInTheDocument();
  });
});
