import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('shows the simple admission form and recent server-backed applications without inquiry UI', async () => {
    renderAdmissionsPage();
    expect(await screen.findByText('Nora Ali')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'New Admission Form' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Recent Applications' })).toBeVisible();
    expect(screen.getByText('Pending', { selector: '.reference-status' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Inquiries' })).not.toBeInTheDocument();
    expect(apiMocks.listApplications).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
    expect(apiMocks.listInquiries).not.toHaveBeenCalled();
  });

  it('submits the simplified admission form for approval', async () => {
    const user = userEvent.setup();
    renderAdmissionsPage();
    await screen.findByText('Nora Ali');
    await user.type(screen.getByLabelText('Student name'), 'Rina Patel');
    await user.type(screen.getByLabelText('Date of birth'), '2012-05-15');
    await user.clear(screen.getByLabelText('Class / grade'));
    await user.type(screen.getByLabelText('Class / grade'), 'Year 5');
    await user.type(screen.getByLabelText('Guardian name'), 'Raj Patel');
    await user.type(screen.getByLabelText('Guardian phone'), '03001234567');
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));

    await waitFor(() =>
      expect(apiMocks.createApplication).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          firstName: 'Rina',
          lastName: 'Patel',
          status: 'submitted',
          phone: '03001234567',
          program: 'Year 5',
          dateOfBirth: '2012-05-15',
          guardianName: 'Raj Patel',
          guardianPhone: '03001234567',
          feePlan: 'Standard',
        }),
      ),
    );
    expect(await screen.findByText('Application submitted.')).toBeVisible();
    expect(apiMocks.createInquiry).not.toHaveBeenCalled();
  });

  it('validates the admission form and does not submit incomplete data', async () => {
    const user = userEvent.setup();
    renderAdmissionsPage();
    await screen.findByText('Nora Ali');
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('Enter the student’s full name.')).toBeVisible();
    expect(screen.getByText('Select the date of birth.')).toBeVisible();
    expect(screen.getByText('Select a class or grade.')).toBeVisible();
    expect(apiMocks.createApplication).not.toHaveBeenCalled();
  });

  it('opens application review records without rendering their internal ids', async () => {
    renderAdmissionsPage();
    expect(
      await screen.findByRole('link', { name: 'Review Nora Ali application' }),
    ).toHaveAttribute(
      'href',
      `/admin/organizations/${organizationId}/admissions/applications/${application.id}`,
    );
    expect(document.body).not.toHaveTextContent(application.id);
  });
});
