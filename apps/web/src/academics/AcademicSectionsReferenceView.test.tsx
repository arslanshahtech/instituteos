// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcademicSectionsReferenceView } from './AcademicSectionsReferenceView.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
  AcademicYearSummary,
} from './academics-api.js';

afterEach(() => cleanup());

const classes: AcademicClass[] = [
  {
    id: 'class-1',
    organizationId: 'org-1',
    campusId: 'campus-1',
    name: 'Prep',
    code: 'PREP',
    studyLevel: 'other',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'class-2',
    organizationId: 'org-1',
    campusId: 'campus-1',
    name: 'Class 1',
    code: 'C1',
    studyLevel: 'other',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
];
const sections: AcademicSection[] = [
  {
    id: 'section-a',
    organizationId: 'org-1',
    classId: 'class-1',
    name: 'Section A',
    capacity: 20,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'section-b',
    organizationId: 'org-1',
    classId: 'class-2',
    name: 'Section B',
    capacity: 25,
    createdAt: '',
    updatedAt: '',
  },
];
const sessions: AcademicYear[] = [
  {
    id: 'year-current',
    organizationId: 'org-1',
    name: '2026-27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    status: 'active',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'year-old',
    organizationId: 'org-1',
    name: '2025-26',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'archived',
    createdAt: '',
    updatedAt: '',
  },
];
const summary: AcademicYearSummary = {
  totals: { classes: 2, sections: 2, students: 17 },
  bySession: [
    { academicYearId: 'year-current', classes: 1, sections: 1, students: 10 },
    { academicYearId: 'year-old', classes: 1, sections: 1, students: 7 },
  ],
  bySection: [
    { academicYearId: 'year-current', sectionId: 'section-a', students: 10 },
    { academicYearId: 'year-old', sectionId: 'section-b', students: 7 },
  ],
};

describe('AcademicSectionsReferenceView', () => {
  it('shows session-scoped counts and section capacity', () => {
    render(
      <AcademicSectionsReferenceView
        sections={sections}
        classes={classes}
        sessions={sessions}
        summary={summary}
        canWrite
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Sections' })).toBeTruthy();
    expect(screen.getByText('10 / 20')).toBeTruthy();
    expect(screen.getByText('0 / 25')).toBeTruthy();
    expect(screen.queryByText('AVG / SECTION')).toBeNull();
    expect(screen.queryByText('10.0')).toBeNull();
    expect(screen.getByText('Seat Capacity')).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('Configured across all sections')).toBeTruthy();
  });

  it('filters by class and search, and wires create/edit/delete actions', () => {
    const onCreate = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <AcademicSectionsReferenceView
        sections={sections}
        classes={classes}
        sessions={sessions}
        summary={summary}
        canWrite
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Filter by class' }),
      { target: { value: 'class-2' } },
    );
    expect(screen.getByText('Section B')).toBeTruthy();
    expect(screen.queryByText('Section A')).toBeNull();
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search sections' }),
      { target: { value: 'does-not-exist' } },
    );
    expect(screen.getByText('No matching sections')).toBeTruthy();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Filter by class' }),
      { target: { value: 'all' } },
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search sections' }),
      { target: { value: 'Section A' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Section A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Section A' }));
    expect(onEdit).toHaveBeenCalledWith(sections[0]);
    expect(onDelete).toHaveBeenCalledWith(sections[0]);
    fireEvent.click(screen.getByRole('button', { name: /Add Section/ }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('keeps session selection out of the toolbar and keeps pagination controls on one row', () => {
    const { container } = render(
      <AcademicSectionsReferenceView
        sections={sections}
        classes={classes}
        sessions={sessions}
        summary={summary}
        canWrite={false}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('combobox', { name: 'Academic session' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /CSV/i })).toBeNull();
    expect(screen.getByText('10 / 20')).toBeTruthy();
    const pagination = container.querySelector('.academic-sections-pagination');
    const summaryGroup = pagination?.querySelector(
      '.academic-sections-pagination-summary',
    );
    expect(summaryGroup?.textContent).toContain('Showing 1-2 of 2');
    expect(summaryGroup?.textContent).toContain('Rows per page');
    expect(
      pagination?.querySelector('select[aria-label="Rows per page"]'),
    ).toBeTruthy();
  });

  it('does not present archived session counts as current when no active session exists', () => {
    const archivedOnly = sessions.map((session) => ({
      ...session,
      status: 'archived' as const,
    }));
    render(
      <AcademicSectionsReferenceView
        sections={sections}
        classes={classes}
        sessions={archivedOnly}
        summary={summary}
        canWrite={false}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('No active session')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Section/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(
      screen.queryByRole('columnheader', { name: 'Description' }),
    ).toBeNull();
  });
});
