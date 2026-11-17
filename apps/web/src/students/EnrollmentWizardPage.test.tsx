import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import { EnrollmentWizardPage } from './EnrollmentWizardPage.js';

const mocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
  getEnrollmentIdentifiers: vi.fn(),
  getCampuses: vi.fn(),
  listAcademicYears: vi.fn(),
  listAcademicClasses: vi.fn(),
  listAcademicSections: vi.fn(),
  enrollStudent: vi.fn(),
}));

vi.mock('../tenancy/tenancy-api.js', () => ({
  getOrganizationAccessContext: mocks.getOrganizationAccessContext,
}));
vi.mock('../organizations/organizations-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../organizations/organizations-api.js')
    >();
  return { ...actual, getCampuses: mocks.getCampuses };
});
vi.mock('../academics/academics-api.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../academics/academics-api.js')>();
  return {
    ...actual,
    listAcademicYears: mocks.listAcademicYears,
    listAcademicClasses: mocks.listAcademicClasses,
    listAcademicSections: mocks.listAcademicSections,
  };
});
vi.mock('./students-api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./students-api.js')>();
  return {
    ...actual,
    getEnrollmentIdentifiers: mocks.getEnrollmentIdentifiers,
    enrollStudent: mocks.enrollStudent,
  };
});

const organizationId = '650000000000000000000001';

function renderEnrollmentPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter
          initialEntries={[
            `/admin/organizations/${organizationId}/admissions/enroll`,
          ]}
        >
          <Routes>
            <Route
              path="/admin/organizations/:organizationId/admissions/enroll"
              element={<EnrollmentWizardPage />}
            />
            <Route
              path="/admin/organizations/:organizationId/students"
              element={<div>Student directory</div>}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('student enrollment wizard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: [
        'student.create',
        'campus.read',
        'academics.read',
        'academics.write',
      ],
      campusIds: [],
    });
    mocks.getEnrollmentIdentifiers.mockResolvedValue({
      registrationNumber: 'REG-001',
      familyNumber: 'F-001',
    });
    mocks.getCampuses.mockResolvedValue({ campuses: [] });
    mocks.listAcademicYears.mockResolvedValue({ items: [] });
    mocks.listAcademicClasses.mockResolvedValue({ items: [] });
    mocks.listAcademicSections.mockResolvedValue({ items: [] });
    mocks.enrollStudent.mockResolvedValue({ student: { id: 'student-1' } });
  });

  it('returns to the student directory from the enrollment back link', async () => {
    renderEnrollmentPage();

    expect(
      await screen.findByRole('heading', { name: 'Student Enrollment' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Back to students' }));

    expect(await screen.findByText('Student directory')).toBeVisible();
  });

  it('loads the next registration number and allows manual entry', async () => {
    mocks.getCampuses.mockResolvedValue({
      campuses: [
        {
          id: '650000000000000000000003',
          organizationId,
          name: 'North Campus',
          status: 'active',
        },
      ],
    });
    renderEnrollmentPage();

    const registrationNumber = await screen.findByDisplayValue('REG-001');
    expect(registrationNumber).toHaveAttribute(
      'aria-label',
      'Registration number',
    );
    expect(registrationNumber).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    expect(registrationNumber).not.toHaveAttribute('readonly');
  });
});
