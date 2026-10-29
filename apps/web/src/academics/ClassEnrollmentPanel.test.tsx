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
  saveAcademicsResource: vi.fn(),
}));

vi.mock('../attendance/attendance-api.js', () => ({
  getEligibleStudents: mocks.getEligibleStudents,
  getStudentRoster: mocks.getStudentRoster,
  removeStudentFromSection: mocks.removeStudentFromSection,
  bulkPlaceStudents: mocks.bulkPlaceStudents,
}));
vi.mock('../staff/StaffPageShared.js', () => ({
  apiMessage: () => 'Request failed.',
}));
vi.mock('./academics-api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./academics-api.js')>()),
  saveAcademicsResource: mocks.saveAcademicsResource,
}));

function renderPanel(initialView: 'students' | 'teacher' = 'students') {
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
        subjects={[
          {
            id: 'subject-1',
            organizationId: 'org-1',
            name: 'English',
            code: 'ENG',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        teachers={[{ id: 'teacher-1', firstName: 'Ayesha', lastName: 'Khan' }]}
        initialView={initialView}
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
  mocks.saveAcademicsResource.mockResolvedValue({
    assignment: { id: 'assignment-1' },
  });
});

describe('ClassEnrollmentPanel', () => {
  it('assigns a selected teacher to the chosen class section, subject, and academic year', async () => {
    const user = userEvent.setup();
    renderPanel('teacher');
    expect(
      screen.getByRole('heading', { name: 'Assign teacher' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Currently enrolled students' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Add students' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Section'), 'section-1');
    await user.selectOptions(
      screen.getByLabelText('Subject teacher'),
      'teacher-1',
    );
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-1');
    await user.click(screen.getByRole('button', { name: 'Assign teacher' }));

    await waitFor(() => {
      expect(mocks.saveAcademicsResource).toHaveBeenCalledWith(
        'org-1',
        'teacher-assignments',
        undefined,
        {
          teacherStaffId: 'teacher-1',
          subjectId: 'subject-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYearId: 'year-1',
        },
      );
    });
    expect(
      await screen.findByText(
        'Teacher assigned to this class section and subject.',
      ),
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
