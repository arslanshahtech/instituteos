import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client.js';
import {
  createFamily,
  deleteFamily,
  getFamily,
  listFamilies,
  updateFamily,
} from './families-api.js';

vi.mock('../api/client.js', () => ({ apiRequest: vi.fn() }));

describe('families API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists families with encoded organization and query parameters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    await listFamilies('org/one', {
      search: 'Khan family',
      page: 1,
      pageSize: 20,
    });
    expect(apiRequest).toHaveBeenCalledWith(
      '/organizations/org%2Fone/families?search=Khan+family&page=1&pageSize=20',
    );
  });

  it('gets a family using the organization-scoped detail endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getFamily('org-1', 'family/1');
    expect(apiRequest).toHaveBeenCalledWith(
      '/organizations/org-1/families/family%2F1',
    );
  });

  it('creates a family without changing the existing guardian/student API payload fields', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      family: { _id: 'f-1', familyNumber: 'F-001' },
    });
    const input = {
      guardianIds: ['g-1'],
      studentIds: ['s-1'],
      name: 'Khan Family',
    };
    await createFamily('org-1', input);
    expect(apiRequest).toHaveBeenCalledWith('/organizations/org-1/families', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  });

  it('updates a family through PATCH', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const input = { familyNumber: 'F-002', name: 'Updated Family' };
    await updateFamily('org-1', 'f-1', input);
    expect(apiRequest).toHaveBeenCalledWith(
      '/organizations/org-1/families/f-1',
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  });

  it('deletes a family through the existing organization-scoped endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue(undefined);
    await deleteFamily('org-1', 'f-1');
    expect(apiRequest).toHaveBeenCalledWith(
      '/organizations/org-1/families/f-1',
      { method: 'DELETE' },
    );
  });
});
