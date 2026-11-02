import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage.js';

const accessState = vi.hoisted(() => ({
  permissions: ['organization.read', 'organization.update'],
}));

vi.mock('../staff/StaffPageShared.js', () => ({
  apiMessage: () => 'Settings request failed.',
  useOrganizationAccess: () => ({
    data: { role: 'organization_owner', permissions: accessState.permissions },
    error: null,
    isPending: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./settings-api.js', () => ({
  useOrganizationSettings: () => ({
    data: undefined,
    error: null,
    isPending: false,
    refetch: vi.fn(),
  }),
  useUpdateOrganizationSettings: () => ({
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
}));

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/organizations/org-1/settings']}>
      <Routes>
        <Route
          element={<SettingsPage />}
          path="/organizations/:organizationId/settings"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage tabs', () => {
  beforeEach(() => {
    accessState.permissions = ['organization.read', 'organization.update'];
  });

  it('shows a distinct settings section for each tab', () => {
    renderSettingsPage();

    expect(
      screen.getByRole('heading', { name: 'Institute information' }),
    ).toBeInTheDocument();

    const sections = [
      ['Contact & details', 'Contact & details'],
      ['Localization', 'Localization'],
      ['Notifications', 'Notifications'],
      ['Teacher attendance', 'Teacher self-attendance'],
      ['Institute Info', 'Institute information'],
    ];

    for (const [tabLabel, heading] of sections) {
      fireEvent.click(screen.getByRole('button', { name: tabLabel }));
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: tabLabel })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      if (tabLabel === 'Teacher attendance') {
        expect(
          screen.getByRole('checkbox', {
            name: /Allow teachers to view attendance history/,
          }),
        ).toBeChecked();
        expect(
          screen.getByRole('checkbox', {
            name: /Allow teachers to mark their own attendance/,
          }),
        ).not.toBeChecked();
      }
    }
  });

  it('keeps organization settings read-only when an Admin lacks organization.update', () => {
    accessState.permissions = ['organization.read'];
    renderSettingsPage();

    expect(screen.getByRole('status')).toHaveTextContent('read-only access');
    expect(screen.getByLabelText('Logo URL')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save settings' }),
    ).not.toBeInTheDocument();
  });
});
