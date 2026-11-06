import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcademicOverview } from './AcademicOverview.js';

describe('AcademicOverview', () => {
  it('shows institute-wide academic metrics and navigates to setup areas', async () => {
    const onOpen = vi.fn();
    render(
      <AcademicOverview
        years={[
          {
            id: 'year-1',
            organizationId: 'org-1',
            name: '2026-2027',
            startDate: '2026-04-01',
            endDate: '2027-03-31',
            status: 'active',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        terms={[
          {
            id: 'term-1',
            organizationId: 'org-1',
            name: 'Term 1',
            academicYearId: 'year-1',
            startDate: '2026-04-01',
            endDate: '2026-07-31',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        classes={[
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
        ]}
        sections={[
          {
            id: 'section-1',
            organizationId: 'org-1',
            classId: 'class-1',
            name: 'A',
            capacity: 30,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        subjects={[
          {
            id: 'subject-1',
            organizationId: 'org-1',
            name: 'Mathematics',
            code: 'MATH',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        campuses={[{ id: 'campus-1', name: 'Main Campus' }]}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText('Academic Overview')).toBeInTheDocument();
    expect(screen.queryByText('Teacher assignments')).not.toBeInTheDocument();
    expect(screen.getByText('2026-2027')).toBeInTheDocument();
    expect(screen.getByText('Current: 2026-2027')).toBeInTheDocument();
    expect(screen.getByText('1 term(s) configured')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Manage academic years' }).click();
    expect(onOpen).toHaveBeenCalledWith('academic-years');
  });

  it('prompts the operator to create an active year when none exists', () => {
    const onOpen = vi.fn();
    render(
      <AcademicOverview
        years={[]}
        terms={[]}
        classes={[]}
        sections={[]}
        subjects={[]}
        campuses={[]}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText('No active session')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Set up academic year' }),
    ).toBeInTheDocument();
  });
});
