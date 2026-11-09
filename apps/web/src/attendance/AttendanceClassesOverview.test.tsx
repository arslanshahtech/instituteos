import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceClassesOverview } from './AttendanceClassesOverview.js';

const mocks = vi.hoisted(() => ({
  getAcademicYearSummary: vi.fn(),
  listStudentAttendance: vi.fn(),
  getStudentRoster: vi.fn(),
  saveStudentAttendance: vi.fn(),
}));

vi.mock('../academics/academics-api.js', () => ({
  getAcademicYearSummary: mocks.getAcademicYearSummary,
}));
vi.mock('./attendance-api.js', () => ({
  getStudentRoster: mocks.getStudentRoster,
  listStudentAttendance: mocks.listStudentAttendance,
  saveStudentAttendance: mocks.saveStudentAttendance,
}));

function renderOverview(
  canWrite = true,
  sections = [
    { id: 'section-a', name: 'A', classId: 'class-1' },
    { id: 'section-b', name: 'B', classId: 'class-1' },
  ],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onOpenRegister = vi.fn();
  const onDateChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <AttendanceClassesOverview
        organizationId="org-1"
        campusId="campus-1"
        academicYearId="year-1"
        date="2026-11-09"
        onDateChange={onDateChange}
        classes={[{ id: 'class-1', name: 'Grade 8' }]}
        sections={sections}
        canWrite={canWrite}
        onOpenRegister={onOpenRegister}
      />
    </QueryClientProvider>,
  );
  return { onOpenRegister, onDateChange };
}

describe('AttendanceClassesOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    mocks.getAcademicYearSummary.mockResolvedValue({
      summary: {
        bySection: [
          { academicYearId: 'year-1', sectionId: 'section-a', students: 2 },
          { academicYearId: 'year-1', sectionId: 'section-b', students: 1 },
        ],
      },
    });
    mocks.listStudentAttendance.mockResolvedValue({
      items: [{ id: 'att-1', sectionId: 'section-a', status: 'present' }],
    });
    mocks.getStudentRoster.mockImplementation(
      async (_org: string, input: { sectionId: string }) => ({
        items:
          input.sectionId === 'section-a'
            ? [{ id: 's-1' }, { id: 's-2' }]
            : [{ id: 's-3' }],
      }),
    );
    mocks.saveStudentAttendance.mockResolvedValue({ items: [] });
  });

  it('places the date selector after the summary cards and updates the selected date', async () => {
    const { onDateChange } = renderOverview();
    const dateInput = await screen.findByLabelText('Attendance date');
    expect(dateInput).toHaveValue('2026-11-09');
    expect(
      screen.getByText('Registers Marked').compareDocumentPosition(dateInput) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.change(dateInput, { target: { value: '2026-11-10' } });
    expect(onDateChange).toHaveBeenCalledWith('2026-11-10');
  });

  it('searches class and section names and clears the search', async () => {
    renderOverview();
    expect(await screen.findAllByText('Grade 8')).toHaveLength(2);
    const search = screen.getByRole('searchbox', {
      name: 'Search classes and sections',
    });
    fireEvent.change(search, { target: { value: 'grade 8 b' } });
    expect(
      screen.getByText('Showing 1 to 1 of 1 class sections'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Grade 8.*Sec B/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Grade 8.*Sec A/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear class search' }));
    expect(
      screen.getByText('Showing 1 to 2 of 2 class sections'),
    ).toBeInTheDocument();
  });

  it('filters class registers by attendance completion status', async () => {
    renderOverview();
    await screen.findByText('Showing 1 to 2 of 2 class sections');
    fireEvent.click(screen.getByRole('button', { name: /Not marked/ }));
    expect(
      screen.getByText('Showing 1 to 1 of 1 class sections'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Grade 8.*Sec B/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Grade 8.*Sec A/ }),
    ).not.toBeInTheDocument();
  });

  it('paginates class registers six at a time', async () => {
    const sections = 'ABCDEFGH'.split('').map((name) => ({
      id: 'section-' + name.toLowerCase(),
      name,
      classId: 'class-1',
    }));
    renderOverview(true, sections);
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Grade 8.*Sec F/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Grade 8.*Sec G/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Grade 8.*Sec G/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Grade 8.*Sec A/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('opens the selected class register from its action', async () => {
    const { onOpenRegister } = renderOverview();
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Mark Attendance' }))[0]!,
    );
    expect(onOpenRegister).toHaveBeenCalledWith('class-1', 'section-a');
  });

  it('bulk marks each class roster present and refreshes attendance data', async () => {
    renderOverview();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark All Present' }),
    );
    await waitFor(() =>
      expect(mocks.saveStudentAttendance).toHaveBeenCalledTimes(2),
    );
    expect(mocks.saveStudentAttendance).toHaveBeenNthCalledWith(
      1,
      'org-1',
      expect.objectContaining({
        sectionId: 'section-a',
        records: [
          { studentId: 's-1', status: 'present' },
          { studentId: 's-2', status: 'present' },
        ],
      }),
    );
    expect(mocks.saveStudentAttendance).toHaveBeenNthCalledWith(
      2,
      'org-1',
      expect.objectContaining({
        sectionId: 'section-b',
        records: [{ studentId: 's-3', status: 'present' }],
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved attendance for 3 students',
    );
  });

  it('does not expose write actions to read-only users', async () => {
    renderOverview(false);
    expect(await screen.findAllByText('Grade 8')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Mark All Present' }),
    ).not.toBeInTheDocument();
  });
});
