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
    expect(
      screen.getByRole('combobox', { name: 'Enrollment status' }),
    ).toHaveValue('all');
    expect(screen.getByText('Ahmed Khan')).toBeInTheDocument();
    expect(screen.getAllByText('First Year').length).toBeGreaterThan(0);
  });

  it('enables the section filter only after selecting a class and shows that class sections', async () => {
    renderWorkspace();
    const section = screen.getByRole('combobox', { name: 'Section' });
    expect(section).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), {
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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes (1)' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Late' }));
    expect(screen.getByText('Aisha Khan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Absent' }));
    expect(screen.getByText('No students found')).toBeInTheDocument();
  });

  it('shows four attendance summary cards and reflects each mark in the Status column', async () => {
    const { container } = renderWorkspace();
    await screen.findByText('Aisha Khan');

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
