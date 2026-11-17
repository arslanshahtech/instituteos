import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage.js';

const rolePolicyState = vi.hoisted(() => ({
  data: {
    policies: {},
    defaults: {
      organization_admin: ['organization.read'],
      teacher: ['attendance.read'],
    },
    roles: ['organization_admin', 'teacher'],
    permissions: ['organization.read', 'attendance.read'],
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: rolePolicyState.data,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const accessState = vi.hoisted(() => ({
  permissions: ['organization.read', 'organization.update'],
}));

const settingsState = vi.hoisted(() => ({
  data: {
    organizationId: 'org-1',
    branding: { primaryColor: '#0f766e' },
    contact: {},
    localization: {
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      dateFormat: 'YYYY-MM-DD',
    },
    notifications: {
      emailAlerts: true,
      smsAlerts: false,
      autoAttendanceAlerts: false,
    },
    staffSetup: {
      departments: [],
      designations: [],
      employmentTypes: [],
      workShifts: [],
      qualifications: [],
      documentTypes: [],
    },
    teacherSelfAttendance: {
      viewOwnAttendance: true,
      selfMarkingEnabled: false,
      allowedStatuses: ['present'],
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  mutate: vi.fn(),
}));

vi.mock('../staff/StaffPageShared.js', () => ({
  apiMessage: () => 'Settings request failed.',
  useOrganizationAccess: () => ({
    data: {
      role: accessState.permissions.includes('organization.read')
        ? 'organization_owner'
        : 'teacher',
      permissions: accessState.permissions,
    },
    error: null,
    isPending: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./settings-api.js', () => ({
  useOrganizationSettings: () => ({
    data: { settings: settingsState.data },
    error: null,
    isPending: false,
    refetch: vi.fn(),
  }),
  useUpdateOrganizationSettings: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutate: settingsState.mutate,
  }),
}));

vi.mock('./ProfileSettingsPage.js', () => ({
  ProfileSettingsPage: () => <div>Personal profile form</div>,
}));

function renderSettingsPage(initial = '/organizations/org-1/settings') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          element={<SettingsPage />}
          path="/organizations/:organizationId/settings"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    accessState.permissions = ['organization.read', 'organization.update'];
    settingsState.mutate.mockClear();
  });

  it('shows only the three intended sections for the organization owner', () => {
    renderSettingsPage();
    for (const name of ['My Profile', 'Notifications', 'Roles & Permissions']) {
      expect(
        screen.getByRole('button', { name: new RegExp(name) }),
      ).toBeInTheDocument();
    }
    for (const removedSection of [
      'Institute Info',
      'Localization',
      'Staff Setup',
      'Attendance',
    ]) {
      expect(
        screen.queryByRole('button', {
          name: new RegExp(removedSection),
        }),
      ).not.toBeInTheDocument();
    }
    expect(screen.getByText('Personal profile form')).toBeInTheDocument();
  });

  it('saves notification preferences', () => {
    renderSettingsPage();
    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /SMS alerts/ }));
    expect(settingsState.mutate).toHaveBeenCalledWith({
      notifications: {
        emailAlerts: true,
        smsAlerts: true,
        autoAttendanceAlerts: false,
      },
    });
  });

  it('opens My Profile as a separate settings section', () => {
    renderSettingsPage();
    fireEvent.click(screen.getByRole('button', { name: /My Profile/ }));
    expect(screen.getByText('Personal profile form')).toBeInTheDocument();
  });

  it('opens the owner-only role permissions matrix', () => {
    renderSettingsPage();
    fireEvent.click(
      screen.getByRole('button', { name: /Roles & Permissions/ }),
    );
    expect(
      screen.getByRole('heading', { name: 'Roles & Permissions' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Configure role')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'View organization' }),
    ).toBeChecked();
  });

  it('keeps organization settings read-only when organization.update is missing', () => {
    accessState.permissions = ['organization.read'];
    renderSettingsPage('/organizations/org-1/settings?tab=notifications');
    expect(screen.getByRole('status')).toHaveTextContent('read-only access');
    expect(
      screen.getByRole('checkbox', { name: /Email alerts/ }),
    ).toBeDisabled();
  });

  it('shows only My Profile to non-manager roles', () => {
    accessState.permissions = ['profile.read'];
    renderSettingsPage();
    expect(screen.getByText('Personal profile form')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /My Profile/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Settings sections' }),
    ).toHaveClass('settings-tabs-single');
    expect(
      screen.queryByRole('button', { name: /Notifications/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Roles & Permissions/ }),
    ).not.toBeInTheDocument();
  });
});
