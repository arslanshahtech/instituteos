import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassEnrollmentPanel } from './ClassEnrollmentPanel.js';

const mocks = vi.hoisted(() => ({
  getEligibleStudents: vi.fn(),
  getStudentRoster: vi.fn(),
  removeStudentFromSection: vi.fn(),
  bulkPlaceStudents: vi.fn(),
  placeStudent: vi.fn(),
  createStudent: vi.fn(),
}));

vi.mock('../attendance/attendance-api.js', () => ({
  getEligibleStudents: mocks.getEligibleStudents,
  getStudentRoster: mocks.getStudentRoster,
  removeStudentFromSection: mocks.removeStudentFromSection,
  bulkPlaceStudents: mocks.bulkPlaceStudents,
  placeStudent: mocks.placeStudent,
}));
vi.mock('../students/students-api.js', () => ({
  createStudent: mocks.createStudent,
}));
vi.mock('../staff/StaffPageShared.js', () => ({
  apiMessage: () => 'Request failed.',
}));

function renderPanel(
  initialView: 'students' | 'add-students' = 'students',
  teacherOptions: {
    focusRequest?: number;
    canReadStudents?: boolean;
    canAddStudents?: boolean;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ClassEnrollmentPanel
        organizationId="org-1"
        classes={[
          {
            id: 'class-1',
            organizationId: 'org-1',
            campusId: 'campus-1',
            name: 'Class 1',
            code: 'C1',
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        sections={[
          {
            id: 'section-1',
            organizationId: 'org-1',
            classId: 'class-1',
            name: 'A',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        years={[
          {
            id: 'year-1',
            organizationId: 'org-1',
            name: '2026-27',
            startDate: '2026-04-01',
            endDate: '2027-03-31',
            status: 'active',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        initialView={initialView}
        focusRequest={teacherOptions.focusRequest ?? 0}
        canReadStudents={teacherOptions.canReadStudents}
        canAddStudents={teacherOptions.canAddStudents}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEligibleStudents.mockResolvedValue({ items: [] });
  mocks.getStudentRoster.mockResolvedValue({ items: [] });
  mocks.removeStudentFromSection.mockResolvedValue({ removed: true });
  mocks.bulkPlaceStudents.mockResolvedValue({
    added: [],
    skipped: [],
    failed: [],
  });
  mocks.placeStudent.mockResolvedValue({ placed: true });
  mocks.createStudent.mockResolvedValue({
    student: { id: 'student-new', firstName: 'New', lastName: 'Learner' },
  });
});

describe('ClassEnrollmentPanel', () => {
  it('keeps enrollment focused on students and omits manual teacher assignment', () => {
    renderPanel();

    expect(
      screen.getByRole('tab', { name: 'View Students' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Add Student' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Assign Teacher' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Assign teacher' }),
    ).not.toBeInTheDocument();
  });

  it('keeps student roster read-only and avoids loading eligible students without add permissions', async () => {
    renderPanel('students', {
      canReadStudents: true,
      canAddStudents: false,
    });

    expect(
      screen.getByRole('tab', { name: 'View Students' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Add Student' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add new student' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.getStudentRoster).toHaveBeenCalled());
    expect(mocks.getEligibleStudents).not.toHaveBeenCalled();
  });

  it('opens the Add Student destination and keeps it selected when requested', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Add Student' }));

    expect(screen.getByRole('tab', { name: 'Add Student' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { name: 'Add students' }),
    ).toBeInTheDocument();
  });

  it('loads existing students for the selected class and bulk-adds all selected students', async () => {
    const user = userEvent.setup();
    mocks.getEligibleStudents.mockResolvedValue({
      items: [
        { id: 'student-1', firstName: 'Ali', lastName: 'Khan' },
        { id: 'student-2', firstName: 'Sara', lastName: 'Ahmed' },
        { id: 'student-3', firstName: 'Hamza', lastName: 'Raza' },
        { id: 'student-4', firstName: 'Ayesha', lastName: 'Noor' },
      ],
    });
    mocks.bulkPlaceStudents.mockResolvedValue({
      added: ['student-1', 'student-2', 'student-3', 'student-4'],
      skipped: [],
      failed: [],
    });

    renderPanel();
    expect(await screen.findAllByText('Ali Khan')).toHaveLength(2);
    expect(await screen.findAllByText('Sara Ahmed')).toHaveLength(2);
    expect(await screen.findAllByText('Hamza Raza')).toHaveLength(2);
    expect(await screen.findAllByText('Ayesha Noor')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Select all shown' }));
    await user.click(
      screen.getByRole('button', { name: 'Add 4 students to section' }),
    );

    await waitFor(() => {
      expect(mocks.bulkPlaceStudents).toHaveBeenCalledWith('org-1', {
        studentIds: ['student-1', 'student-2', 'student-3', 'student-4'],
        classId: 'class-1',
        sectionId: 'section-1',
        academicYearId: 'year-1',
        campusId: 'campus-1',
      });
    });
    expect(await screen.findByText(/4 added/)).toBeInTheDocument();
  });

  it('recovers a newly created student when section placement fails without inviting duplicate creation', async () => {
    const user = userEvent.setup();
    mocks.placeStudent.mockRejectedValue(new Error('Placement failed.'));
    mocks.getEligibleStudents.mockResolvedValue({
      items: [{ id: 'student-new', firstName: 'New', lastName: 'Learner' }],
    });

    renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Add Student' }));
    await user.click(screen.getByRole('button', { name: 'Add new student' }));
    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'Learner');
    await user.click(
      screen.getByRole('button', { name: 'Create student and add to section' }),
    );

    expect(
      await screen.findByText(
        /If the student was created but enrollment failed/,
      ),
    ).toBeInTheDocument();
    expect(mocks.createStudent).toHaveBeenCalledTimes(1);
    expect(mocks.placeStudent).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('textbox', {
        name: 'Search eligible students to add',
      }),
    ).toHaveValue('New Learner');
    expect(await screen.findAllByText('New Learner')).toHaveLength(2);
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('filters eligible students by name and offers a clear action when there are no matches', async () => {
    const user = userEvent.setup();
    mocks.getEligibleStudents.mockResolvedValue({
      items: [
        { id: 'student-1', firstName: 'Ali', lastName: 'Khan' },
        { id: 'student-2', firstName: 'Sara', lastName: 'Ahmed' },
      ],
    });
    renderPanel();

    const search = await screen.findByRole('textbox', {
      name: 'Search eligible students to add',
    });
    await user.type(search, 'Sara');
    expect(await screen.findAllByText('Sara Ahmed')).toHaveLength(2);
    expect(screen.queryByText('Ali Khan')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'Nobody');
    expect(
      await screen.findByText('No students match “Nobody”.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findAllByText('Ali Khan')).toHaveLength(2);
  });

  it('shows students already assigned to the selected class section', async () => {
    mocks.getStudentRoster.mockResolvedValue({
      items: [{ id: 'roster-1', firstName: 'Mina', lastName: 'Iqbal' }],
    });
    renderPanel('students');

    expect(
      screen.queryByRole('heading', { name: 'Assign teacher' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Subject teacher')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Currently enrolled students'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Enrolled')).toBeInTheDocument();
    expect(await screen.findAllByText('Mina Iqbal')).toHaveLength(2);
    await userEvent.click(
      screen.getByRole('button', { name: /Select students/ }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /Mina Iqbal/ }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove selected' }),
    );
    await waitFor(() =>
      expect(mocks.removeStudentFromSection).toHaveBeenCalledWith(
        'org-1',
        'roster-1',
        {
          classId: 'class-1',
          sectionId: 'section-1',
          academicYearId: 'year-1',
          campusId: 'campus-1',
        },
      ),
    );
  });
});
