import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import { AdmissionsListPage } from './AdmissionsListPage.js';
import type { ApplicationRecord, InquiryRecord } from './admissions-api.js';

const apiMocks = vi.hoisted(() => ({
  listInquiries: vi.fn(),
  listApplications: vi.fn(),
  createInquiry: vi.fn(),
  createApplication: vi.fn(),
  updateInquiryStatus: vi.fn(),
  getApplication: vi.fn(),
  reviewApplication: vi.fn(),
}));
const accessMocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
}));
const campusMocks = vi.hoisted(() => ({ getCampuses: vi.fn() }));

vi.mock('./admissions-api.js', () => apiMocks);
vi.mock('../tenancy/tenancy-api.js', () => accessMocks);
vi.mock('../organizations/organizations-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../organizations/organizations-api.js')
    >();
  return { ...actual, getCampuses: campusMocks.getCampuses };
});

const organizationId = '650000000000000000000001';
const inquiry: InquiryRecord = {
  id: '650000000000000000000002',
  firstName: 'Nora',
  lastName: 'Ali',
  email: 'nora@example.test',
  status: 'new',
  gradeLevelInterest: 'Year 4',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const application: ApplicationRecord = {
  id: '650000000000000000000003',
  firstName: 'Nora',
  lastName: 'Ali',
  status: 'submitted',
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderAdmissionsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter
          initialEntries={[`/admin/organizations/${organizationId}/admissions`]}
        >
          <Routes>
            <Route
              path="/admin/organizations/:organizationId/admissions"
              element={<AdmissionsListPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Admissions list page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['admission.read', 'admission.create', 'admission.review'],
      campusIds: [],
    });
    campusMocks.getCampuses.mockResolvedValue({ campuses: [] });
    apiMocks.listInquiries.mockResolvedValue({
      items: [inquiry],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    apiMocks.listApplications.mockResolvedValue({
      items: [application],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    apiMocks.createInquiry.mockResolvedValue({ inquiry });
    apiMocks.createApplication.mockResolvedValue({ application });
    apiMocks.updateInquiryStatus.mockResolvedValue({ inquiry });
  });

  it('shows server records and filters inquiries by status', async () => {
    const { container } = renderAdmissionsPage();
    expect(await screen.findByText('Nora Ali')).toBeVisible();
    expect(screen.getByText('Year 4')).toBeVisible();
    expect(
      container.querySelectorAll(
        '.admissions-inquiry-table .inquiry-mobile-label',
      ),
    ).toHaveLength(6);
    expect(
      container.querySelector('.admissions-inquiry-table tbody tr'),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Filter by status' }),
      {
        target: { value: 'contacted' },
      },
    );
    await waitFor(() =>
      expect(apiMocks.listInquiries).toHaveBeenLastCalledWith(
        organizationId,
        expect.objectContaining({ status: 'contacted', page: 1 }),
      ),
    );
  });

  it('creates a validated inquiry and reports success', async () => {
    const user = userEvent.setup();
    renderAdmissionsPage();
    await screen.findByText('Nora Ali');
    await user.type(screen.getByLabelText('Applicant first name'), 'Rina');
    await user.type(screen.getByLabelText('Applicant last name'), 'Patel');
    await user.click(screen.getByRole('button', { name: 'Create inquiry' }));

    await waitFor(() =>
      expect(apiMocks.createInquiry).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ firstName: 'Rina', lastName: 'Patel' }),
      ),
    );
    expect(await screen.findByText('Inquiry created.')).toBeVisible();
  });

  it('shows validation errors and does not submit an incomplete inquiry', async () => {
    const user = userEvent.setup();
    renderAdmissionsPage();
    await screen.findByText('Nora Ali');
    await user.click(screen.getByRole('button', { name: 'Create inquiry' }));

    expect(
      await screen.findAllByText('Enter at least two characters.'),
    ).toHaveLength(2);
    expect(apiMocks.createInquiry).not.toHaveBeenCalled();
  });

  it('opens application review records without rendering their internal ids', async () => {
    const user = userEvent.setup();
    renderAdmissionsPage();
    await screen.findByText('Nora Ali');
    await user.click(screen.getByRole('button', { name: 'Applications' }));
    expect(
      await screen.findByRole('link', { name: 'Nora Ali' }),
    ).toHaveAttribute(
      'href',
      `/admin/organizations/${organizationId}/admissions/applications/${application.id}`,
    );
    expect(document.body).not.toHaveTextContent(application.id);
  });
});
