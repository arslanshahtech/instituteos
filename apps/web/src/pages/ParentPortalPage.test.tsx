import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentPortalPage } from './ParentPortalPage.js';

const mocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
  getPortalMe: vi.fn(),
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
        leave: 0,
        percentage: 50,
        records: [
          { date: '2025-10-12', status: 'absent', remarks: 'Not present' },
          { date: '2025-10-11', status: 'present', remarks: '' },
        ],
      },
      fees: {
        totalOutstanding: 1500,
        invoices: [
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            billingCycle: 'October 2025',
            dueDate: '2025-10-10',
            totalAmount: 5000,
            paidAmount: 3500,
            outstandingAmount: 1500,
            status: 'partially_paid',
          },
        ],
      },
      results: [],
      resultsAvailable: false,
      homework: [
        {
          id: 'homework-1',
          title: 'Chapter 4 exercises',
          type: 'homework',
          subjectName: 'Mathematics',
          teacherName: 'School administration',
          dueDate: '2026-11-12',
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
        leave: 0,
        percentage: null,
        records: [],
      },
      fees: { totalOutstanding: 0, invoices: [] },
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
  });

  it('shows only the children returned by the linked-family portal and allows sibling selection', async () => {
    const user = userEvent.setup();
    renderParentPortal(`/parent/organizations/${organizationId}`);

    expect(
      await screen.findByRole('heading', { name: 'Mina Rao' }),
    ).toBeVisible();
    expect(screen.getByText('Welcome back, Nadia Rao')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Your linked children' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Mina Rao.*First Year/ }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Arman Rao.*Second Year/ }),
    ).toBeVisible();
    const picker = await screen.findByRole('combobox', {
      name: 'Select linked student',
    });
    await user.selectOptions(picker, 'student-2');

    expect(screen.getByRole('heading', { name: 'Arman Rao' })).toBeVisible();
    expect(mocks.getPortalMe).toHaveBeenCalledWith(organizationId);
  });

  it('opens the Homework & tests section and shows published work for the selected child', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/homework`);

    expect(
      await screen.findByRole('heading', {
        name: 'Published homework & tests',
      }),
    ).toBeVisible();
    expect(screen.getByText('Chapter 4 exercises')).toBeVisible();
    expect(screen.getByText(/Mathematics/)).toBeVisible();
    expect(screen.getByText(/Assigned by School administration/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Homework & tests/ }),
    ).toHaveAttribute(
      'href',
      `/parent/organizations/${organizationId}/homework`,
    );
  });

  it('shows attendance history including absences for the selected child', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/attendance`);

    expect(
      await screen.findByRole('heading', { name: 'Attendance history' }),
    ).toBeVisible();
    expect(screen.getByText('absent')).toBeVisible();
    expect(screen.getByText('12 Oct 2025')).toBeVisible();
    expect(screen.getByText('present')).toBeVisible();
  });

  it('shows invoice totals, paid amounts, and outstanding balances without online payment actions', async () => {
    renderParentPortal(`/parent/organizations/${organizationId}/fees`);

    expect(
      await screen.findByRole('heading', { name: 'Fee details' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent?.includes('INV-001') === true,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent?.includes('Total') === true &&
          element.textContent.includes('Paid'),
      ),
    ).toBeVisible();
    expect(screen.getByText(/Receipt download is not exposed/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /pay online/i }),
    ).not.toBeInTheDocument();
  });
});
