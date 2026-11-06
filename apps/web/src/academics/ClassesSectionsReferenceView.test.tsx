// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => cleanup());
import { ClassesSectionsReferenceView } from './ClassesSectionsReferenceView.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
  AcademicSubject,
} from './academics-api.js';

describe('ClassesSectionsReferenceView', () => {
  const baseProps = () => ({
    classes: [
      {
        id: 'class-1',
        organizationId: 'org-1',
        campusId: 'campus-1',
        name: 'Class Five',
        code: 'FIVE',
        sortOrder: 5,
        studyLevel: 'other' as const,
        programName: 'Primary',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'class-2',
        organizationId: 'org-1',
        campusId: 'campus-1',
        name: 'First Year',
        code: 'FY',
        sortOrder: 6,
        studyLevel: 'first_year' as const,
        programName: 'FSc Pre-Medical',
        createdAt: '',
        updatedAt: '',
      },
    ] as AcademicClass[],
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
    ] as AcademicSection[],
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
    ] as AcademicYear[],
    campuses: [{ id: 'campus-1', name: 'Main Campus' }],
    subjects: [
      {
        id: 'subject-1',
        organizationId: 'org-1',
        name: 'Mathematics',
        code: 'MATH',
        classIds: ['class-1'],
        createdAt: '',
        updatedAt: '',
      },
    ] as AcademicSubject[],
    studentsCount: 20,
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onOpenCampusSetup: vi.fn(),
  });

  it('renders the dedicated Classes heading, requested actions and four summary metrics', () => {
    render(<ClassesSectionsReferenceView {...baseProps()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Classes' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Manage All Classes in Your Institute.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Education Levels/ }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Class' })).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getAllByText('Sections').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Subjects').length).toBeGreaterThan(0);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add section to/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Manage students in/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Assign teacher to/ }),
    ).toBeNull();
  });

  it('shows the PDF-aligned class table and related counts from available data', () => {
    render(<ClassesSectionsReferenceView {...baseProps()} />);

    expect(screen.getByRole('table')).toBeTruthy();
    for (const heading of [
      'Class',
      'Level / Grade',
      'Session',
      'Sections',
      'Subjects',
      'Students',
      'Actions',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy();
    }
    expect(screen.getByText('Class Five')).toBeTruthy();
    expect(screen.getAllByText('2026-2027').length).toBe(2);
    expect(
      screen.getByRole('button', { name: 'Edit Class Five' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Delete Class Five' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /View Class Five details/ }),
    ).toBeNull();
  });

  it('filters classes by search and education level', () => {
    render(<ClassesSectionsReferenceView {...baseProps()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search classes' }), {
      target: { value: 'First Year' },
    });
    expect(screen.getAllByText('First Year').length).toBeGreaterThan(0);
    expect(screen.queryByText('Class Five')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search classes' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Education Levels/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Other 1/ }));
    expect(screen.getByText('Class Five')).toBeTruthy();
    expect(screen.queryByRole('row', { name: /First Year/ })).toBeNull();
  });

  it('uses the Education Levels action to choose an available level', () => {
    render(<ClassesSectionsReferenceView {...baseProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /Education Levels/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /All Levels 2/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /First Year 1/ })).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: /Second Year 0/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: /First Year 1/ }));

    expect(screen.getAllByText('First Year').length).toBeGreaterThan(0);
    expect(screen.queryByText('Class Five')).toBeNull();
  });

  it('keeps pagination controls compact and changes page size', () => {
    const props = baseProps();
    props.classes = Array.from({ length: 12 }, (_, index) => ({
      ...props.classes[0]!,
      id: 'class-' + index,
      name: 'Class ' + index,
      code: 'C' + index,
    }));
    render(<ClassesSectionsReferenceView {...props} />);

    expect(screen.getByText(/Showing 1/)).toBeTruthy();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), {
      target: { value: '25' },
    });
    expect(screen.getByText(/Showing 1/)).toBeTruthy();
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
  });
});
