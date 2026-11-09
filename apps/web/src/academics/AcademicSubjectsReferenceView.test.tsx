// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcademicSubjectsReferenceView } from './AcademicSubjectsReferenceView.js';
import type { AcademicClass, AcademicSubject } from './academics-api.js';
import type { ExamSchedule } from '../examinations/examinations-api.js';

afterEach(() => cleanup());

const classes: AcademicClass[] = [
  {
    id: 'class-1',
    organizationId: 'org-1',
    campusId: 'campus-1',
    name: 'Class 9',
    code: 'C9',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'class-2',
    organizationId: 'org-1',
    campusId: 'campus-1',
    name: 'Class 10',
    code: 'C10',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
];
const subjects: AcademicSubject[] = [
  {
    id: 'subject-1',
    organizationId: 'org-1',
    name: 'Mathematics',
    code: 'MATH',
    classIds: ['class-1'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'subject-2',
    organizationId: 'org-1',
    name: 'Physics',
    code: 'PHY',
    classIds: ['class-2'],
    createdAt: '',
    updatedAt: '',
  },
];
const schedules: ExamSchedule[] = [
  {
    id: 'exam-1',
    examId: 'exam-a',
    subjectId: 'subject-1',
    classId: 'class-1',
    sectionId: 'section-a',
    date: '2026-09-01',
    startTime: '09:00',
    durationMinutes: 90,
    totalMarks: 100,
    passingMarks: 40,
    marksReviewStatus: 'draft',
    marksSubmittedAt: null,
    marksSubmittedBy: null,
  },
  {
    id: 'exam-2',
    examId: 'exam-b',
    subjectId: 'subject-1',
    classId: 'class-1',
    sectionId: 'section-a',
    date: '2026-10-01',
    startTime: '09:00',
    durationMinutes: 90,
    totalMarks: 50,
    passingMarks: 20,
    marksReviewStatus: 'draft',
    marksSubmittedAt: null,
    marksSubmittedBy: null,
  },
];

describe('AcademicSubjectsReferenceView', () => {
  it('shows subjects and derives marks and passing percentage from exam schedules', () => {
    render(
      <AcademicSubjectsReferenceView
        subjects={subjects}
        classes={classes}
        schedules={schedules}
        canWrite
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Subjects' })).toBeTruthy();
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('Physics')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('150')).toBeTruthy();
    expect(within(table).getByText('40.0%')).toBeTruthy();
    expect(within(table).getAllByText('?')).toHaveLength(2);
    expect(screen.queryByText('Department')).toBeNull();
  });

  it('filters subjects by class and search and supports create, edit and delete', () => {
    const onCreate = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <AcademicSubjectsReferenceView
        subjects={subjects}
        classes={classes}
        schedules={schedules}
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
    expect(screen.getByText('Physics')).toBeTruthy();
    expect(screen.queryByText('Mathematics')).toBeNull();
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search subjects' }),
      { target: { value: 'no-match' } },
    );
    expect(screen.getByText('No matching subjects')).toBeTruthy();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Filter by class' }),
      { target: { value: 'all' } },
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search subjects' }),
      { target: { value: 'Mathematics' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mathematics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Mathematics' }));
    expect(onEdit).toHaveBeenCalledWith(subjects[0]);
    expect(onDelete).toHaveBeenCalledWith(subjects[0]);
    fireEvent.click(screen.getByRole('button', { name: /Add Subject/ }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('keeps pagination summary and rows-per-page together', () => {
    const { container } = render(
      <AcademicSubjectsReferenceView
        subjects={subjects}
        classes={classes}
        schedules={schedules}
        canWrite={false}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const summary = container.querySelector(
      '.academic-subjects-pagination-summary',
    );
    expect(summary?.textContent).toContain('Showing 1-2 of 2');
    expect(summary?.textContent).toContain('Rows per page');
    expect(
      container.querySelector('select[aria-label="Rows per page"]'),
    ).toBeTruthy();
  });

  it('uses subject defaults when there are no exam schedules and hides write actions', () => {
    render(
      <AcademicSubjectsReferenceView
        subjects={[{ ...subjects[0]!, totalMarks: 100, passingPercentage: 35 }]}
        classes={classes}
        schedules={[]}
        canWrite={false}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('100')).toBeTruthy();
    expect(within(table).getByText('35.0%')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Subject/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });
});
