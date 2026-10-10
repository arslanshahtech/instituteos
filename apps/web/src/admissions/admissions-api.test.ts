import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client.js';
import {
  createApplication,
  createInquiry,
  getApplication,
  listApplications,
  listInquiries,
  reviewApplication,
  updateInquiryStatus,
} from './admissions-api.js';

vi.mock('../api/client.js', () => ({
  apiRequest: vi.fn(),
}));

describe('admissions API integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests server-filtered inquiries and applications using supported parameters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      inquiries: { items: [], total: 0, page: 2, pageSize: 20 },
      applications: { items: [], total: 0, page: 2, pageSize: 20 },
    });
    const base = {
      search: 'Nora Ali',
      page: 2,
      pageSize: 20,
    };

    await listInquiries('org/one', { ...base, status: 'contacted' });
    await listApplications('org/one', { ...base, status: 'submitted' });

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/organizations/org%2Fone/admissions?page=2&pageSize=20&search=Nora+Ali&inquiryStatus=contacted',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org%2Fone/admissions?page=2&pageSize=20&search=Nora+Ali&applicationStatus=submitted',
    );
  });

  it('uses the existing create, review, and detail routes and payloads', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const inquiry = {
      firstName: 'Nora',
      lastName: 'Ali',
      gradeLevelInterest: 'Year 4',
    };
    const application = {
      firstName: 'Nora',
      lastName: 'Ali',
      status: 'submitted' as const,
    };

    await createInquiry('org-1', inquiry);
    await updateInquiryStatus('org-1', 'inquiry-1', 'contacted');
    await createApplication('org-1', application);
    await getApplication('org-1', 'application-1');
    await reviewApplication('org-1', 'application-1', {
      status: 'approved',
      decisionReason: 'Complete',
    });

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-1/admissions/inquiries',
      { method: 'POST', body: JSON.stringify(inquiry) },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-1/admissions/inquiries/inquiry-1',
      { method: 'PATCH', body: JSON.stringify({ status: 'contacted' }) },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/organizations/org-1/admissions/applications',
      { method: 'POST', body: JSON.stringify(application) },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      4,
      '/organizations/org-1/admissions/applications/application-1',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      5,
      '/organizations/org-1/admissions/applications/application-1',
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          decisionReason: 'Complete',
        }),
      },
    );
  });
});
