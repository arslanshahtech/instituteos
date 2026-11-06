// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcademicSessionsReferenceView } from './AcademicSessionsReferenceView.js';
import type { AcademicYear, AcademicYearSummary } from './academics-api.js';

afterEach(() => cleanup());

const sessions: AcademicYear[] = [
  {
    id: 'session-1',
    organizationId: 'org-1',
    name: '2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'session-2',
    organizationId: 'org-1',
    name: '2025-2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'archived',
    createdAt: '2025-03-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
  },
];

const summary: AcademicYearSummary = {
  totals: { classes: 3, sections: 5, students: 42 },
  bySection: [],
  bySession: [
    { academicYearId: 'session-1', classes: 2, sections: 3, students: 24 },
    { academicYearId: 'session-2', classes: 1, sections: 2, students: 18 },
  ],
};

describe('AcademicSessionsReferenceView', () => {
  it('shows the session summary and counts from active placements', () => {
    render(
      <AcademicSessionsReferenceView
        sessions={sessions}
        summary={summary}
        canWrite
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Academic Sessions' }),
    ).toBeTruthy();
    expect(screen.getByText('2026-2027')).toBeTruthy();
    expect(screen.getByText('2025-2026')).toBeTruthy();
    expect(screen.queryByText('2 sessions')).toBeNull();
    const currentRow = screen.getByText('2026-2027').closest('tr');
    expect(currentRow).not.toBeNull();
    expect(
      within(currentRow as HTMLTableRowElement).getByText('2'),
    ).toBeTruthy();
    expect(
      within(currentRow as HTMLTableRowElement).getByText('3'),
    ).toBeTruthy();
    expect(
      within(currentRow as HTMLTableRowElement).getByText('24'),
    ).toBeTruthy();
    const previousRow = screen.getByText('2025-2026').closest('tr');
    expect(previousRow).not.toBeNull();
    expect(screen.getByText('42')).toBeTruthy();
    expect(
      screen.queryByRole('columnheader', { name: 'Avg. / Section' }),
    ).toBeNull();
  });

  it('filters sessions and calls edit/delete actions', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <AcademicSessionsReferenceView
        sessions={sessions}
        summary={summary}
        canWrite
        onCreate={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search sessions' }),
      {
        target: { value: '2025' },
      },
    );
    expect(screen.getByText('2025-2026')).toBeTruthy();
    expect(screen.queryByText('2 sessions')).toBeNull();
    expect(screen.queryByText('2026-2027')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit 2025-2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2025-2026' }));
    expect(onEdit).toHaveBeenCalledWith(sessions[1]);
    expect(onDelete).toHaveBeenCalledWith(sessions[1]);
  });

  it('supports creating sessions and hides write controls for read-only users', () => {
    const onCreate = vi.fn();
    const emptySummary: AcademicYearSummary = {
      totals: { classes: 0, sections: 0, students: 0 },
      bySection: [],
      bySession: [
        { academicYearId: 'session-1', classes: 0, sections: 0, students: 0 },
      ],
    };
    const writer = render(
      <AcademicSessionsReferenceView
        sessions={[]}
        summary={emptySummary}
        canWrite
        onCreate={onCreate}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Add Session/ })[0]!);
    expect(onCreate).toHaveBeenCalledTimes(1);
    writer.unmount();

    render(
      <AcademicSessionsReferenceView
        sessions={sessions}
        summary={emptySummary}
        canWrite={false}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Add Session/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByText('Avg. / Section')).toBeNull();
    expect(screen.queryByText('N/A')).toBeNull();
  });
});
