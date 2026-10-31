import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentImportPage } from './StudentImportPage.js';

const mocks = vi.hoisted(() => ({
  getOrganizationAccessContext: vi.fn(),
  getCampuses: vi.fn(),
  parseStudentImportFile: vi.fn(),
  suggestStudentImportMappings: vi.fn(),
  previewStudentImport: vi.fn(),
  importStudents: vi.fn(),
}));

vi.mock('../tenancy/tenancy-api.js', () => ({
  getOrganizationAccessContext: mocks.getOrganizationAccessContext,
}));
vi.mock('../organizations/organizations-api.js', () => ({
  getCampuses: mocks.getCampuses,
}));
vi.mock('./student-import-parser.js', () => ({
  parseStudentImportFile: mocks.parseStudentImportFile,
  suggestStudentImportMappings: mocks.suggestStudentImportMappings,
  STUDENT_IMPORT_FIELDS: [
    { value: 'fullName', label: 'Full student name' },
    { value: 'firstName', label: 'First name' },
    { value: 'lastName', label: 'Last name / surname' },
    { value: 'preferredName', label: 'Preferred name' },
    { value: 'dateOfBirth', label: 'Date of birth' },
    { value: 'gender', label: 'Gender' },
    { value: 'contactEmail', label: 'Student email' },
    { value: 'phone', label: 'Student phone' },
    { value: 'status', label: 'Status' },
    { value: 'guardianName', label: 'Parent / guardian name' },
    { value: 'guardianPhone', label: 'Parent / guardian phone' },
    { value: 'guardianEmail', label: 'Parent / guardian email' },
    {
      value: 'guardianRelationship',
      label: 'Relationship to student',
    },
  ],
}));
vi.mock('./students-api.js', () => ({
  previewStudentImport: mocks.previewStudentImport,
  importStudents: mocks.importStudents,
}));

const organizationId = '650000000000000000000001';
const sheet = {
  sheetName: 'Students',
  headers: ['Student Name', 'DOB'],
  rows: [{ rowNumber: 2, cells: ['Ali Raza', '2012-01-02'] }],
};
const preview = {
  rows: [
    {
      rowNumber: 2,
      status: 'warning' as const,
      input: { firstName: 'Ali', lastName: 'Raza', dateOfBirth: '2012-01-02' },
      firstName: 'Ali',
      lastName: 'Raza',
      issues: ['Full name was split automatically; please verify it.'],
    },
  ],
  summary: {
    total: 1,
    ready: 0,
    warnings: 1,
    duplicates: 0,
    errors: 0,
    importable: 1,
  },
};
const importResult = {
  rows: [
    {
      rowNumber: 2,
      outcome: 'created' as const,
      message: 'Student profile created.',
      studentId: 'student-1',
    },
  ],
  summary: { total: 1, created: 1, skipped: 0, failed: 0 },
};

function renderImportPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          `/admin/organizations/${organizationId}/students/import`,
        ]}
      >
        <Routes>
          <Route
            path="/admin/organizations/:organizationId/students/import"
            element={<StudentImportPage />}
          />
          <Route
            path="/admin/organizations/:organizationId/students"
            element={<div>Student directory</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('student import page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'organization_admin',
      permissions: ['student.create'],
      campusIds: [],
    });
    mocks.getCampuses.mockResolvedValue({ campuses: [] });
    mocks.parseStudentImportFile.mockResolvedValue(sheet);
    mocks.suggestStudentImportMappings.mockReturnValue([
      'fullName',
      'dateOfBirth',
    ]);
    mocks.previewStudentImport.mockResolvedValue(preview);
    mocks.importStudents.mockResolvedValue(importResult);
  });

  it('does not expose import controls without student.create permission', async () => {
    mocks.getOrganizationAccessContext.mockResolvedValue({
      organizationId,
      role: 'teacher',
      permissions: ['student.read'],
      campusIds: [],
    });
    renderImportPage();

    expect(
      await screen.findByRole('heading', { name: 'Permission required' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Student register file')).toBeNull();
  });

  it('parses, maps, previews and confirms rows, then displays the import report', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderImportPage();
    await screen.findByRole('heading', { name: 'Import students' });

    expect(
      document.querySelector('.student-import-file-picker'),
    ).toBeInTheDocument();
    expect(screen.getByText('Browse files')).toBeInTheDocument();
    const file = new File(['sample workbook'], 'school-register.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(await screen.findByLabelText('Student register file'), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/Selected:/)).toBeTruthy();
    expect(
      document.querySelector('.student-import-scope-note'),
    ).toHaveTextContent('shared guardian link');
    expect(mocks.parseStudentImportFile).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText('Map Student Name')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Preview rows' }));
    expect(
      await screen.findByRole('heading', { name: '3. Review before import' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Full name was split automatically; please verify it.'),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm and import 1 profiles' }),
    );
    await waitFor(() =>
      expect(mocks.importStudents).toHaveBeenCalledWith(organizationId, {
        rows: [
          {
            rowNumber: 2,
            data: { fullName: 'Ali Raza', dateOfBirth: '2012-01-02' },
          },
        ],
      }),
    );
    expect(confirmSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: '4. Import report' }),
    ).toBeTruthy();
    expect(screen.getByText('Created')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it('maps parent and guardian columns into the confirmed import payload', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.parseStudentImportFile.mockResolvedValue({
      sheetName: 'Students',
      headers: [
        'Student Name',
        'Guardian Name',
        'Guardian Phone',
        'Guardian Email',
        'Guardian Relationship',
      ],
      rows: [
        {
          rowNumber: 2,
          cells: [
            'Ali Raza',
            'Muhammad Khan',
            '0300-1234567',
            'parent@example.test',
            'father',
          ],
        },
      ],
    });
    mocks.suggestStudentImportMappings.mockReturnValue([
      'fullName',
      'guardianName',
      'guardianPhone',
      'guardianEmail',
      'guardianRelationship',
    ]);

    renderImportPage();
    await screen.findByRole('heading', { name: 'Import students' });
    const file = new File(['student and guardian rows'], 'students.csv', {
      type: 'text/csv',
    });
    fireEvent.change(await screen.findByLabelText('Student register file'), {
      target: { files: [file] },
    });

    await screen.findByText(/Selected:/);
    expect(screen.getByLabelText('Map Guardian Name')).toHaveValue(
      'guardianName',
    );
    expect(screen.getByLabelText('Map Guardian Phone')).toHaveValue(
      'guardianPhone',
    );
    expect(screen.getByLabelText('Map Guardian Email')).toHaveValue(
      'guardianEmail',
    );
    expect(screen.getByLabelText('Map Guardian Relationship')).toHaveValue(
      'guardianRelationship',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview rows' }));
    await screen.findByRole('heading', { name: '3. Review before import' });
    await waitFor(() => {
      expect(mocks.previewStudentImport).toHaveBeenCalledWith(organizationId, {
        rows: [
          {
            rowNumber: 2,
            data: {
              fullName: 'Ali Raza',
              guardianName: 'Muhammad Khan',
              guardianPhone: '0300-1234567',
              guardianEmail: 'parent@example.test',
              guardianRelationship: 'father',
            },
          },
        ],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm and import 1 profiles' }),
    );
    await waitFor(() => {
      expect(mocks.importStudents).toHaveBeenCalledWith(organizationId, {
        rows: [
          {
            rowNumber: 2,
            data: {
              fullName: 'Ali Raza',
              guardianName: 'Muhammad Khan',
              guardianPhone: '0300-1234567',
              guardianEmail: 'parent@example.test',
              guardianRelationship: 'father',
            },
          },
        ],
      });
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
