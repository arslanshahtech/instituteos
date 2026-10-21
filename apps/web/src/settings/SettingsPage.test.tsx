import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage.js';

vi.mock('../staff/StaffPageShared.js', () => ({
  apiMessage: () => 'Settings request failed.',
  useOrganizationAccess: () => ({
    data: { role: 'organization_owner', permissions: [] },
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
  it('shows a distinct settings section for each tab', () => {
    renderSettingsPage();

    expect(
      screen.getByRole('heading', { name: 'Institute information' }),
    ).toBeInTheDocument();

    const sections = [
      ['Contact & details', 'Contact & details'],
      ['Localization', 'Localization'],
      ['Notifications', 'Notifications'],
      ['Institute Info', 'Institute information'],
    ];

    for (const [tabLabel, heading] of sections) {
      fireEvent.click(screen.getByRole('button', { name: tabLabel }));
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: tabLabel }),
      ).toHaveAttribute('aria-pressed', 'true');
    }
  });
});
