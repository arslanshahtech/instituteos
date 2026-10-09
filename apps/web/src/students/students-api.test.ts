import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client.js';
import {
  createStudent,
  getStudent,
  listStudents,
  updateStudent,
} from './students-api.js';

vi.mock('../api/client.js', () => ({
  apiRequest: vi.fn(),
}));

describe('student API integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the supported search, status, and pagination query parameters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 20,
    });

    await listStudents('org/one', {
      search: 'Ada Lovelace',
      status: 'active',
      page: 2,
      pageSize: 20,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      '/organizations/org%2Fone/students?page=2&pageSize=20&search=Ada+Lovelace&status=active',
    );
  });

  it('uses the backend detail, create, and partial-update routes and payloads', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ student: {} });
    const input = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      status: 'active' as const,
    };

    await getStudent('org-1', 'student-1');
    await createStudent('org-1', input);
    await updateStudent('org-1', 'student-1', input);

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-1/students/student-1',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-1/students',
      { method: 'POST', body: JSON.stringify(input) },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/organizations/org-1/students/student-1',
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  });
});
