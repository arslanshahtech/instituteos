import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import { ApplicationReviewPage } from './ApplicationReviewPage.js';

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

vi.mock('./admissions-api.js', () => apiMocks);
vi.mock('../tenancy/tenancy-api.js', () => accessMocks);

const organizationId = '650000000000000000000001';
const applicationId = '650000000000000000000002';
const studentId = '650000000000000000000003';
let reviewCompleted = false;

function renderReviewPage() {
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
          initialEntries={[
            `/admin/organizations/${organizationId}/admissions/applications/${applicationId}`,
          ]}
        >
          <Routes>
            <Route
              path="/admin/organizations/:organizationId/admissions/applications/:applicationId"
              element={<ApplicationReviewPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('application review page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewCompleted = false;
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['admission.read', 'admission.review', 'student.create'],
      campusIds: [],
    });
    apiMocks.getApplication.mockImplementation(async () => ({
      application: {
        id: applicationId,
        firstName: 'Nora',
        lastName: 'Ali',
        status: reviewCompleted ? 'approved' : 'submitted',
        ...(reviewCompleted ? { convertedStudentId: studentId } : {}),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }));
    apiMocks.reviewApplication.mockImplementation(async () => {
      reviewCompleted = true;
      return {
        application: {
          id: applicationId,
          firstName: 'Nora',
          lastName: 'Ali',
          status: 'approved',
          convertedStudentId: studentId,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        student: { id: studentId, firstName: 'Nora', lastName: 'Ali' },
      };
    });
  });

  it('approves an application through review and exposes the converted student link', async () => {
    const user = userEvent.setup();
    renderReviewPage();
    await user.click(
      await screen.findByRole('button', { name: 'Approve application' }),
    );

    expect(apiMocks.reviewApplication).toHaveBeenCalledWith(
      organizationId,
      applicationId,
      { status: 'approved' },
    );
    expect(
      await screen.findByText(
        'Application approved and student record created.',
      ),
    ).toBeVisible();
    expect(
      await screen.findByRole('link', { name: 'View converted student' }),
    ).toHaveAttribute(
      'href',
      `/admin/organizations/${organizationId}/students/${studentId}`,
    );
    expect(document.body).not.toHaveTextContent(studentId);
  });

  it('does not show review actions to a read-only admissions user', async () => {
    accessMocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'admissions_reception',
      permissions: ['admission.read'],
      campusIds: [],
    });
    renderReviewPage();

    expect(await screen.findByText('Applicant information')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Approve application' }),
    ).not.toBeInTheDocument();
  });
});
