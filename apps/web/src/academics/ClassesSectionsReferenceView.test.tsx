import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassesSectionsReferenceView } from './ClassesSectionsReferenceView.js';

describe('ClassesSectionsReferenceView', () => {
  const baseProps = () => ({
    classes: [
      {
        id: 'class-1',
        organizationId: 'org-1',
        campusId: 'campus-1',
        name: 'Class 5',
        code: 'C5',
        sortOrder: 0,
        createdAt: '',
        updatedAt: '',
      },
    ],
    sections: [
      {
        id: 'section-1',
        organizationId: 'org-1',
        classId: 'class-1',
        name: 'Section A',
        capacity: 30,
        createdAt: '',
        updatedAt: '',
      },
    ],
    years: [
      {
        id: 'year-1',
        organizationId: 'org-1',
        name: '2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        status: 'active' as const,
        createdAt: '',
        updatedAt: '',
      },
    ],
    campuses: [{ id: 'campus-1', name: 'Main Campus' }],
    subjects: [],
    assignments: [],
    teachers: [],
    onCreate: vi.fn(),
    onCreateSubject: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onOpenEnrollment: vi.fn(),
    onOpenCampusSetup: vi.fn(),
  });

  it('preselects the current class when adding a section from its details', () => {
    const props = baseProps();
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add Section/ }));

    expect(props.onCreate).toHaveBeenCalledWith('sections', 'class-1');
  });

  it('opens the Add Student view directly from the selected class actions', () => {
    const props = baseProps();
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Student' }));

    expect(props.onOpenEnrollment).toHaveBeenCalledWith(
      'section-1',
      'class-1',
      'add-students',
    );
  });

  it('shows only the shared Academics page heading, not a duplicate class heading', () => {
    render(<ClassesSectionsReferenceView {...baseProps()} />);

    expect(
      screen.queryByRole('heading', {
        level: 1,
        name: 'Classes & Sections',
      }),
    ).not.toBeInTheDocument();
  });

  it('opens teacher assignment even when the class still needs a section', () => {
    const props = baseProps();
    props.sections = [];
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));
    fireEvent.click(screen.getByRole('button', { name: /Assign Teacher/ }));

    expect(props.onOpenEnrollment).toHaveBeenCalledWith(
      undefined,
      'class-1',
      'teacher',
    );
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('opens the student roster for the selected class and section', () => {
    const props = baseProps();
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));
    fireEvent.click(screen.getByRole('button', { name: /View Students/ }));

    expect(props.onOpenEnrollment).toHaveBeenCalledWith(
      'section-1',
      'class-1',
      'students',
    );
  });

  it('opens subject creation from the teachers and subjects detail tab', () => {
    const props = baseProps();
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Teachers & Subjects/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add Subject/ }));

    expect(props.onCreateSubject).toHaveBeenCalledTimes(1);
  });

  it('respects read-only Admin permissions without hiding class data', () => {
    const props = {
      ...baseProps(),
      canWriteAcademics: false,
      canReadStudents: true,
      canAddStudents: false,
      canAssignTeachers: false,
    };
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));

    expect(
      screen.getByRole('button', { name: /View Students/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create Class' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Add Section/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add Student' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Assign Teacher/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit Class' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Class' }),
    ).not.toBeInTheDocument();
  });

  it('keeps Assign Teacher available from the teachers and subjects tab', () => {
    const props = baseProps();
    render(<ClassesSectionsReferenceView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Class 5/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Teachers & Subjects/ }));
    fireEvent.click(screen.getByRole('button', { name: /Assign Teacher/ }));

    expect(props.onOpenEnrollment).toHaveBeenCalledWith(
      'section-1',
      'class-1',
      'teacher',
    );
  });
});
