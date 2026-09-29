import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from './app/providers.js';
import { createAppRouter } from './app/router.js';
import { queryClient } from './app/query-client.js';
import { getApiHealth } from './api/client.js';

vi.mock('./api/client.js', () => ({
  getApiHealth: vi.fn().mockResolvedValue({
    status: 'ok',
    service: 'instituteos-api',
    timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

function renderPath(path: string) {
  const router = createAppRouter({ initialEntries: [path] });
  return render(<AppProviders router={router} />);
}

describe('frontend application foundation', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(getApiHealth).mockResolvedValue({
      status: 'ok',
      service: 'instituteos-api',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('redirects to the platform layout and loads API status through the query client', async () => {
    renderPath('/');

    expect(
      await screen.findByRole('heading', { name: 'Platform workspace' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('instituteos-api')).toBeInTheDocument();
    expect(getApiHealth).toHaveBeenCalledOnce();
  });

  it('switches between role layout previews without implying authorization', async () => {
    const user = userEvent.setup();
    renderPath('/admin');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role layout preview' }),
      'teacher',
    );

    expect(
      await screen.findByRole('heading', { name: 'Teaching workspace' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Teacher · Layout preview')).toBeInTheDocument();
  });

  it('opens mobile navigation and closes it after navigation', async () => {
    const user = userEvent.setup();
    renderPath('/student');
    const menuButton = screen.getByRole('button', { name: 'Open menu' });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('link', { name: 'UI foundations' }));

    expect(
      await screen.findByRole('heading', { name: 'UI foundations' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(menuButton).toHaveAttribute('aria-expanded', 'false'),
    );
  });

  it('provides an accessible dialog and dismissible toast foundation', async () => {
    const user = userEvent.setup();
    renderPath('/platform/foundations');

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(
      screen.getByRole('dialog', { name: 'Dialog foundation' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Show notification' }));
    expect(
      await screen.findByText('Your preview notification is ready.'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(
      screen.queryByText('Your preview notification is ready.'),
    ).not.toBeInTheDocument();
  });

  it('validates forms and exposes errors beside their fields', async () => {
    const user = userEvent.setup();
    renderPath('/admin/foundations');

    await user.click(screen.getByRole('button', { name: 'Validate form' }));
    expect(
      await screen.findByText('Enter at least two characters.'),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'Display name' }),
      'InstituteOS',
    );
    await user.click(screen.getByRole('button', { name: 'Validate form' }));
    expect(
      await screen.findByText('Form foundation submitted successfully.'),
    ).toBeInTheDocument();
  });

  it('renders accessible loading, empty, error, denied, and table empty states', () => {
    renderPath('/parent/foundations');

    expect(screen.getByText('Loading view…')).toBeInTheDocument();
    expect(screen.getAllByText('No results yet')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load this view',
    );
    expect(screen.getByText('Access not available')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Example data table' }),
    ).toBeInTheDocument();
  });
});
