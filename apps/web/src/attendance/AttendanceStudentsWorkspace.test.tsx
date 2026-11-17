import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceStudentsWorkspace } from './AttendanceStudentsWorkspace.js';
import {
  listStudents,
  listStudentPlacements,
} from '../students/students-api.js';
import {
  listStudentAttendance,
  saveStudentAttendance,
} from './attendance-api.js';

vi.mock('../students/students-api.js', () => ({
  listStudents: vi.fn(),
  listStudentPlacements: vi.fn(),
}));
vi.mock('./attendance-api.js', () => ({
  listStudentAttendance: vi.fn(),
  saveStudentAttendance: vi.fn(),
}));

const student = {
  id: 'student-1',
  firstName: 'Aisha',
  lastName: 'Khan',
  registrationNumber: 'IO-001',
  fatherName: 'Ahmed Khan',
  parentMobile: '03001234567',
  campusId: 'campus-1',
  status: 'active' as const,
  guardianIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const placement = {
  studentId: 'student-1',
  classId: 'class-1',
  className: 'First Year',
  sectionId: 'section-a',
  sectionName: 'A',
  academicYearId: 'year-1',
  academicYearName: '2026-27',
  campusId: 'campus-1',
  monthlyFee: 0,
};

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AttendanceStudentsWorkspace
        organizationId="org-1"
        campusId="campus-1"
        academicYearId="year-1"
        date="2026-11-09"
        onDateChange={vi.fn()}
        classes={[
          { id: 'class-1', name: 'First Year' },
          { id: 'class-2', name: 'Second Year' },
        ]}
        sections={[
          { id: 'section-a', name: 'A', classId: 'class-1' },
          { id: 'section-b', name: 'B', classId: 'class-1' },
          { id: 'section-c', name: 'C', classId: 'class-2' },
        ]}
        canWrite
        isTeacher={false}
        teacherAssignments={[]}
      />
    </QueryClientProvider>,
  );
}

describe('AttendanceStudentsWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listStudents).mockResolvedValue({
      items: [student],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    vi.mocked(listStudentPlacements).mockResolvedValue({ items: [placement] });
    vi.mocked(listStudentAttendance).mockResolvedValue({ items: [] });
    vi.mocked(saveStudentAttendance).mockResolvedValue({ items: [] });
  });

  it('shows students from all classes by default and keeps Section disabled until a class is chosen', async () => {
    renderWorkspace();
    expect(screen.getByRole('combobox', { name: 'Section' })).toBeDisabled();
    expect(await screen.findByText('Aisha Khan')).toBeInTheDocument();
    expect(vi.mocked(listStudents).mock.calls[0]?.[1]).not.toHaveProperty(
      'status',
    );
    expect(screen.getByRole('combobox', { name: 'All Students' })).toHaveValue(
      'all',
    );
    expect(screen.getByText('Ahmed Khan')).toBeInTheDocument();
    expect(screen.getAllByText('First Year').length).toBeGreaterThan(0);
  });

  it('keeps the complete roster loaded while applying search locally', async () => {
    vi.mocked(listStudents).mockResolvedValueOnce({
      items: [
        student,
        {
          ...student,
          id: 'student-2',
          firstName: 'Sara',
          lastName: 'Malik',
          registrationNumber: 'IO-002',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    renderWorkspace();
    await screen.findByText('Aisha Khan');

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search students' }),
      {
        target: { value: 'Sara' },
      },
    );

    expect(screen.getByText('Sara Malik')).toBeInTheDocument();
    expect(screen.queryByText('Aisha Khan')).not.toBeInTheDocument();
    expect(vi.mocked(listStudents).mock.calls[0]?.[1]).not.toHaveProperty(
      'search',
    );
  });

  it('enables the section filter only after selecting a class and shows that class sections', async () => {
    renderWorkspace();
    const section = screen.getByRole('combobox', { name: 'Section' });
    expect(section).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'All Classes' }), {
      target: { value: 'class-1' },
    });
    expect(section).toBeEnabled();
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'C' })).not.toBeInTheDocument();
  });

  it('marks a student and saves attendance against the student active class-section placement', async () => {
    renderWorkspace();
    await screen.findByText('Aisha Khan');
    fireEvent.click(screen.getByRole('button', { name: 'Aisha Khan absent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));
    await waitFor(() =>
      expect(saveStudentAttendance).toHaveBeenCalledWith('org-1', {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-a',
        date: '2026-11-09',
        records: [{ studentId: 'student-1', status: 'absent' }],
      }),
    );
  });

  it('shows a short-lived save confirmation after attendance is saved', async () => {
    renderWorkspace();
    await screen.findByText('Aisha Khan');
    fireEvent.click(screen.getByRole('button', { name: 'Aisha Khan present' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));

    expect(
      await screen.findByText('Attendance saved for 1 students.'),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          screen.queryByText('Attendance saved for 1 students.'),
        ).not.toBeInTheDocument(),
      { timeout: 4500 },
    );
  });

  it('filters the student list by attendance status', async () => {
    vi.mocked(listStudentAttendance).mockResolvedValue({
      items: [
        {
          id: 'attendance-1',
          studentId: 'student-1',
          classId: 'class-1',
          sectionId: 'section-a',
          academicYearId: 'year-1',
          campusId: 'campus-1',
          date: '2026-11-09',
          status: 'late',
        },
      ],
    });
    renderWorkspace();
    await screen.findByText('Aisha Khan');
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Attendance status' }),
      {
        target: { value: 'late' },
      },
    );
    expect(screen.getAllByText('Aisha Khan').length).toBeGreaterThan(0);
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Attendance status' }),
      {
        target: { value: 'absent' },
      },
    );
    expect(screen.getByText('No students found')).toBeInTheDocument();
  });

  it('keeps the student workspace focused on the selected-day register without a standalone history feed', async () => {
    renderWorkspace();
    await screen.findByText('Aisha Khan');

    expect(
      screen.queryByRole('heading', { name: 'Attendance History' }),
    ).not.toBeInTheDocument();
    expect(listStudentAttendance).toHaveBeenCalledTimes(1);
    expect(listStudentAttendance).toHaveBeenCalledWith('org-1', {
      dateFrom: '2026-11-09',
      dateTo: '2026-11-09',
      campusId: 'campus-1',
      academicYearId: 'year-1',
    });
  });

  it('shows the simplified heading, student class metadata and compact attendance marks', async () => {
    renderWorkspace();
    await screen.findByText('Aisha Khan');

    expect(
      screen.getByRole('heading', { name: 'Student Attendance' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('DAILY REGISTER')).not.toBeInTheDocument();
    expect(screen.getByText('First Year · Section A')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Aisha Khan leave' }),
    ).toHaveTextContent('LB');
  });

  it('preserves unsaved marks when class filters change', async () => {
    vi.mocked(listStudents).mockResolvedValueOnce({
      items: [
        student,
        {
          ...student,
          id: 'student-2',
          firstName: 'Sara',
          lastName: 'Malik',
          registrationNumber: 'IO-002',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    vi.mocked(listStudentPlacements).mockResolvedValueOnce({
      items: [
        placement,
        {
          ...placement,
          studentId: 'student-2',
          classId: 'class-2',
          className: 'Second Year',
          sectionId: 'section-c',
          sectionName: 'C',
        },
      ],
    });

    renderWorkspace();
    await screen.findByText('Aisha Khan');
    fireEvent.click(screen.getByRole('button', { name: 'Aisha Khan absent' }));

    fireEvent.change(screen.getByRole('combobox', { name: 'All Classes' }), {
      target: { value: 'class-2' },
    });
    await screen.findByText('Sara Malik');
    fireEvent.click(screen.getByRole('button', { name: 'Sara Malik present' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save (2)' }));

    await waitFor(() => {
      expect(saveStudentAttendance).toHaveBeenCalledTimes(2);
    });
    expect(saveStudentAttendance).toHaveBeenCalledWith('org-1', {
      campusId: 'campus-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-a',
      date: '2026-11-09',
      records: [{ studentId: 'student-1', status: 'absent' }],
    });
    expect(saveStudentAttendance).toHaveBeenCalledWith('org-1', {
      campusId: 'campus-1',
      academicYearId: 'year-1',
      classId: 'class-2',
      sectionId: 'section-c',
      date: '2026-11-09',
      records: [{ studentId: 'student-2', status: 'present' }],
    });
  });

  it('shows four attendance summary cards and reflects each mark in the Status column', async () => {
    const { container } = renderWorkspace();
    await screen.findByText('Aisha Khan');

    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Search students')).toBeInTheDocument();
    const primaryFilters = container.querySelector(
      '.attendance-students-filter-row-primary',
    );
    const secondaryFilters = container.querySelector(
      '.attendance-students-filter-row-secondary',
    );
    expect(
      primaryFilters?.querySelector('[aria-label="Date"]'),
    ).toBeInTheDocument();
    expect(
      primaryFilters?.querySelector('[aria-label="Search students"]'),
    ).toBeInTheDocument();
    expect(secondaryFilters?.querySelectorAll('select')).toHaveLength(4);
    expect(screen.getByLabelText('All Classes')).toBeInTheDocument();
    expect(screen.getByLabelText('Section')).toBeInTheDocument();
    expect(screen.getByLabelText('All Students')).toBeInTheDocument();
    expect(screen.getByLabelText('Attendance status')).toBeInTheDocument();
    expect(
      container.querySelectorAll('.attendance-students-status-filters'),
    ).toHaveLength(0);
    expect(
      container.querySelector('.attendance-students-mobile-status'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.attendance-student-class-meta'),
    ).toHaveTextContent('First Year · Section A');

    expect(
      container.querySelectorAll('.attendance-students-metric'),
    ).toHaveLength(4);
    expect(
      screen.getByText('Marked', {
        selector: '.attendance-students-metric-label',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Present', {
        selector: '.attendance-students-metric-label',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Absent', {
        selector: '.attendance-students-metric-label',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('On leave', {
        selector: '.attendance-students-metric-label',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 of 1 students marked')).toBeInTheDocument();
    expect(
      screen.getByText('Not marked', {
        selector: '.attendance-students-status-pill',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aisha Khan present' }));
    expect(
      screen.getByText('Present', {
        selector: '.attendance-students-status-pill',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aisha Khan late' }));
    expect(
      screen.getByText('Late', {
        selector: '.attendance-students-status-pill',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aisha Khan leave' }));
    expect(
      screen.getByText('Leave', {
        selector: '.attendance-students-status-pill',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 of 1 students marked')).toBeInTheDocument();
  });
});
