import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademicImportPage } from './AcademicImportPage.js';

const mocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
  listAcademicCampuses: vi.fn(),
  listAcademicClasses: vi.fn(),
  listAcademicSections: vi.fn(),
  listAcademicSubjects: vi.fn(),
  saveAcademicsResource: vi.fn(),
  parseStudentImportFile: vi.fn(),
  recordTransferHistory: vi.fn(),
}));

vi.mock('../tenancy/tenancy-api.js', () => ({
  getOrganizationAccessContext: mocks.getOrganizationAccessContext,
}));
vi.mock('../students/student-import-parser.js', () => ({
  parseStudentImportFile: mocks.parseStudentImportFile,
}));
vi.mock('./academics-api.js', () => ({
  listAcademicCampuses: mocks.listAcademicCampuses,
  listAcademicClasses: mocks.listAcademicClasses,
  listAcademicSections: mocks.listAcademicSections,
  listAcademicSubjects: mocks.listAcademicSubjects,
  saveAcademicsResource: mocks.saveAcademicsResource,
}));
vi.mock('../reporting/reporting-api.js', () => ({
  recordTransferHistory: mocks.recordTransferHistory,
}));

const organizationId = '650000000000000000000001';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          `/admin/organizations/${organizationId}/academics/import`,
        ]}
      >
        <Routes>
          <Route
            path="/admin/organizations/:organizationId/academics/import"
            element={<AcademicImportPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('academic import page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['academics.read', 'academics.write', 'campus.read'],
      campusIds: [],
    });
    mocks.listAcademicCampuses.mockResolvedValue({
      campuses: [
        { id: '650000000000000000000003', organizationId, name: 'Main Campus' },
      ],
    });
    mocks.listAcademicClasses.mockResolvedValue({ items: [] });
    mocks.listAcademicSections.mockResolvedValue({ items: [] });
    mocks.listAcademicSubjects.mockResolvedValue({ items: [] });
    mocks.parseStudentImportFile.mockResolvedValue({
      sheetName: 'Classes',
      headers: ['name', 'code'],
      rows: [
        { rowNumber: 2, cells: ['Class 8', 'CLS-08'] },
        { rowNumber: 3, cells: ['Class 9', 'CLS-08'] },
      ],
    });
    mocks.saveAcademicsResource.mockResolvedValue({ class: { id: 'class-1' } });
    mocks.recordTransferHistory.mockResolvedValue({ item: {} });
  });

  it('previews academic rows and creates only eligible records after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Import academic records' });
    const file = new File(['register'], 'classes.csv', { type: 'text/csv' });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    await screen.findByRole('heading', { name: 'Match spreadsheet columns' });

    fireEvent.click(screen.getByRole('button', { name: 'Preview classes' }));
    expect(await screen.findByText(/Review\s+classes\s+import/)).toBeVisible();
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(
      screen.getByText(
        'Class code already exists in this campus or import file.',
      ),
    ).toBeVisible();
    expect(mocks.saveAcademicsResource).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /Confirm and import 1 classes/ }),
    );
    await waitFor(() =>
      expect(mocks.saveAcademicsResource).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveAcademicsResource).toHaveBeenCalledWith(
      organizationId,
      'classes',
      undefined,
      expect.objectContaining({
        name: 'Class 8',
        code: 'CLS-08',
        campusId: '650000000000000000000003',
      }),
    );
    expect(confirmSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: 'Import results' }),
    ).toBeVisible();
    expect(mocks.recordTransferHistory).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        dataType: 'classes',
        totalRows: 2,
        createdRows: 1,
        skippedRows: 1,
        failedRows: 0,
      }),
    );
    confirmSpy.mockRestore();
  });
});
