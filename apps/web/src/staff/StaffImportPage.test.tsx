import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffImportPage } from './StaffImportPage.js';

const mocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
  getCampuses: vi.fn(),
  parseStudentImportFile: vi.fn(),
  createStaff: vi.fn(),
  recordTransferHistory: vi.fn(),
}));

vi.mock('../tenancy/tenancy-api.js', () => ({
  getOrganizationAccessContext: mocks.getOrganizationAccessContext,
}));
vi.mock('../organizations/organizations-api.js', () => ({
  getCampuses: mocks.getCampuses,
}));
vi.mock('../students/student-import-parser.js', () => ({
  parseStudentImportFile: mocks.parseStudentImportFile,
}));
vi.mock('./staff-api.js', () => ({
  createStaff: mocks.createStaff,
}));
vi.mock('../reporting/reporting-api.js', () => ({
  recordTransferHistory: mocks.recordTransferHistory,
}));

const organizationId = '650000000000000000000001';
const sheet = {
  sheetName: 'Staff',
  headers: [
    'firstName',
    'lastName',
    'employeeCode',
    'email',
    'staffType',
    'status',
  ],
  rows: [
    {
      rowNumber: 2,
      cells: [
        'Ayesha',
        'Khan',
        'EMP-001',
        'ayesha@example.test',
        'teacher',
        'active',
      ],
    },
    {
      rowNumber: 3,
      cells: [
        'Sara',
        'Ali',
        'EMP-001',
        'sara@example.test',
        'teacher',
        'active',
      ],
    },
    {
      rowNumber: 4,
      cells: ['Missing', '', 'EMP-003', '', 'teacher', 'active'],
    },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/admin/organizations/${organizationId}/staff/import`]}
      >
        <Routes>
          <Route
            path="/admin/organizations/:organizationId/staff/import"
            element={<StaffImportPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('staff import page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['staff.create'],
      campusIds: [],
    });
    mocks.getCampuses.mockResolvedValue({ campuses: [] });
    mocks.parseStudentImportFile.mockResolvedValue(sheet);
    mocks.createStaff.mockResolvedValue({ staff: { id: 'staff-1' } });
    mocks.recordTransferHistory.mockResolvedValue({ item: {} });
  });

  it('previews rows before creating staff and imports only valid non-duplicate rows after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Import staff' });
    const file = new File(['register'], 'staff.csv', { type: 'text/csv' });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    await screen.findByText(/3 rows detected/);

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview staff records' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Review staff import' }),
    ).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(
      screen.getByText('Duplicate employee code or email in this file.'),
    ).toBeVisible();
    expect(screen.getByText('First and last name are required.')).toBeVisible();
    expect(mocks.createStaff).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm and import 1 staff records',
      }),
    );
    await waitFor(() => expect(mocks.createStaff).toHaveBeenCalledTimes(1));
    expect(mocks.createStaff).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        firstName: 'Ayesha',
        lastName: 'Khan',
        employeeCode: 'EMP-001',
        email: 'ayesha@example.test',
        staffType: 'teacher',
        status: 'active',
      }),
    );
    expect(confirmSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: 'Import results' }),
    ).toBeVisible();
    expect(mocks.recordTransferHistory).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        dataType: 'staff',
        totalRows: 3,
        createdRows: 1,
        skippedRows: 1,
        failedRows: 1,
      }),
    );
    confirmSpy.mockRestore();
  });
});
