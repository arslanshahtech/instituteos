import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client.js';
import {
  createGuardian,
  getGuardian,
  linkGuardian,
  listGuardians,
  listStudentGuardians,
  unlinkGuardian,
  updateGuardian,
} from './guardians-api.js';

vi.mock('../api/client.js', () => ({
  apiRequest: vi.fn(),
}));

describe('guardian API integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the organization-scoped list endpoint and supported query parameters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 20,
    });

    await listGuardians('org/one', {
      search: 'Leela Rao',
      page: 2,
      pageSize: 20,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      '/organizations/org%2Fone/guardians?page=2&pageSize=20&search=Leela+Rao',
    );
  });

  it('maps CRUD and relationship calls to the existing People API routes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const input = {
      firstName: 'Leela',
      lastName: 'Rao',
      relationship: 'mother' as const,
      email: 'leela@example.test',
    };

    await createGuardian('org-1', input);
    await getGuardian('org-1', 'guardian-1');
    await updateGuardian('org-1', 'guardian-1', input);
    await listStudentGuardians('org-1', 'student-1');
    await linkGuardian('org-1', 'student-1', 'guardian-1', {
      relationship: 'mother',
      isPrimary: true,
    });
    await unlinkGuardian('org-1', 'student-1', 'guardian-1');

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-1/guardians',
      { method: 'POST', body: JSON.stringify(input) },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-1/guardians/guardian-1',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/organizations/org-1/guardians/guardian-1',
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      4,
      '/organizations/org-1/students/student-1/guardians',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      5,
      '/organizations/org-1/guardians/guardian-1/links',
      {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          relationship: 'mother',
          isPrimary: true,
        }),
      },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      6,
      '/organizations/org-1/students/student-1/guardians/guardian-1',
      { method: 'DELETE' },
    );
  });
});
