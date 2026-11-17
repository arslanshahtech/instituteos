import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StaffRecord } from '../staff/staff-api.js';
import type { StaffAttendanceRecord } from './attendance-api.js';
import { AttendanceStaffWorkspace } from './AttendanceStaffWorkspace.js';

const staff: StaffRecord[] = [
  {
    id: 'staff-1',
    organizationId: 'org-1',
    firstName: 'Sadia',
    lastName: 'Khan',
    employeeCode: 'EMP-001',
    staffType: 'teacher',
    designation: 'English Teacher',
    department: 'Academic',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'staff-2',
    organizationId: 'org-1',
    firstName: 'Bilal',
    lastName: 'Ahmed',
    employeeCode: 'EMP-002',
    staffType: 'other_staff',
    designation: 'Accountant',
    department: 'Finance',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'staff-3',
    organizationId: 'org-1',
    firstName: 'Ayesha',
    lastName: 'Siddiqui',
    employeeCode: 'EMP-003',
    staffType: 'teacher',
    designation: 'Science Teacher',
    department: 'Academic',
    status: 'on_leave',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'staff-4',
    organizationId: 'org-1',
    firstName: 'Huma',
    lastName: 'Raza',
    employeeCode: 'EMP-004',
    staffType: 'teacher',
    designation: 'Art Teacher',
    department: 'Academic',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const records: StaffAttendanceRecord[] = [
  {
    id: 'mark-1',
    staffId: 'staff-1',
    date: '2026-11-09',
    status: 'present',
    updatedAt: '2026-11-09T03:42:00.000Z',
  },
  {
    id: 'mark-2',
    staffId: 'staff-2',
    date: '2026-11-09',
    status: 'absent',
  },
  {
    id: 'mark-3',
    staffId: 'staff-3',
    date: '2026-11-09',
    status: 'on-leave',
  },
];

function renderWorkspace(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <AttendanceStaffWorkspace
      staff={staff}
      records={records}
      canWrite
      date="2026-11-12"
      onDateChange={vi.fn()}
      isSaving={false}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe('AttendanceStaffWorkspace', () => {
  it('shows the reference summary cards and staff attendance table', () => {
    renderWorkspace();

    expect(
      screen.getByRole('heading', { name: 'Staff Attendance' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Attendance date')).toHaveValue('2026-11-12');
    expect(
      document.querySelector('.attendance-staff-table-toolbar'),
    ).toBeInTheDocument();
    const listCard = document.querySelector('.attendance-staff-table-card');
    expect(
      listCard?.contains(
        screen.getByRole('searchbox', { name: 'Search staff' }),
      ),
    ).toBe(true);
    expect(
      listCard?.contains(
        screen.getByRole('button', { name: 'Mark All Present' }),
      ),
    ).toBe(true);
    expect(
      document.querySelectorAll('.attendance-staff-metric-icon'),
    ).toHaveLength(4);
    expect(screen.getByText('Total Staff')).toBeInTheDocument();
    expect(
      screen.getByText('Present', {
        selector: '.attendance-staff-metric-label',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Absent', {
        selector: '.attendance-staff-metric-label',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Leave / Half day', {
        selector: '.attendance-staff-metric-label',
      }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.attendance-staff-metric-checked strong')
        ?.textContent,
    ).toBe('4');
    expect(screen.getByText('Sadia Khan')).toBeInTheDocument();
    expect(screen.getByText('EMP-001')).toBeInTheDocument();
    expect(screen.queryByText('Employee ID not set')).not.toBeInTheDocument();
    expect(
      screen.getByText('Not marked', {
        selector: '.attendance-staff-status-not-marked',
      }),
    ).toBeInTheDocument();
  });

  it('filters staff by name and attendance status', () => {
    renderWorkspace();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search staff' }), {
      target: { value: 'bilal' },
    });
    expect(screen.getByText('Bilal Ahmed')).toBeInTheDocument();
    expect(screen.queryByText('Sadia Khan')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search staff' }), {
      target: { value: '' },
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Staff attendance status' }),
      {
        target: { value: 'not-marked' },
      },
    );
    expect(screen.getByText('Huma Raza')).toBeInTheDocument();
    expect(screen.queryByText('Sadia Khan')).not.toBeInTheDocument();
  });

  it('checks a staff member in immediately and supports manual attendance marking', () => {
    const onSave = renderWorkspace();

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark Present' })[3]);
    expect(onSave).toHaveBeenCalledWith('staff-4', 'present');

    fireEvent.click(screen.getAllByRole('button', { name: 'Manual Mark' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const statusSelect = screen.getByRole('combobox', {
      name: 'Attendance status',
    }) as HTMLSelectElement;
    expect(
      Array.from(statusSelect.options).map((option) => option.value),
    ).toEqual(['present', 'absent', 'on-leave', 'half-day']);
    fireEvent.change(statusSelect, {
      target: { value: 'half-day' },
    });
    fireEvent.change(screen.getByPlaceholderText('Add a note if needed...'), {
      target: { value: 'Arrived after lunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Attendance' }));
    expect(onSave).toHaveBeenLastCalledWith(
      'staff-1',
      'half-day',
      'Arrived after lunch',
    );
  });

  it('opens Manual Mark so an admin can choose any staff member', () => {
    const onSave = renderWorkspace();

    fireEvent.click(screen.getAllByRole('button', { name: 'Manual Mark' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Staff member' }), {
      target: { value: 'staff-2' },
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Attendance status' }),
      {
        target: { value: 'absent' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Attendance' }));
    expect(onSave).toHaveBeenCalledWith('staff-2', 'absent', undefined);
  });

  it('marks all staff present from the bulk action', () => {
    const onSave = renderWorkspace();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mark All Present' }));
    expect(onSave).toHaveBeenCalledTimes(staff.length);
    for (const person of staff) {
      expect(onSave).toHaveBeenCalledWith(person.id, 'present');
    }
    vi.restoreAllMocks();
  });
});
