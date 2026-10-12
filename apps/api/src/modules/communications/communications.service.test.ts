import { describe, expect, it, vi } from 'vitest';
import { CommunicationsService } from './communications.service.js';
import type {
  AnnouncementContext,
  AnnouncementRecord,
  AnnouncementRepository,
  CreateAnnouncementInput,
} from './communications.types.js';

const organizationId = '650000000000000000000001';
const campusId = '650000000000000000000002';
const otherCampusId = '650000000000000000000003';
const authorId = '650000000000000000000004';
const announcementId = '650000000000000000000005';

const context: AnnouncementContext = {
  organizationId,
  userId: authorId,
  campusIds: [campusId],
  role: 'campus_admin',
};

const record: AnnouncementRecord = {
  id: announcementId,
  organizationId,
  campusId,
  title: 'Campus notice',
  content: 'Term begins Monday.',
  targetAudience: 'all',
  status: 'published',
  publishDate: '2026-10-12T00:00:00.000Z',
  authorId,
  isPinned: false,
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
};

function repository(
  overrides: Partial<AnnouncementRepository> = {},
): AnnouncementRepository {
  return {
    listAnnouncements: vi.fn().mockResolvedValue([record]),
    getAnnouncement: vi.fn().mockResolvedValue(record),
    createAnnouncement: vi.fn().mockResolvedValue(record),
    updateAnnouncement: vi.fn().mockResolvedValue(record),
    deleteAnnouncement: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('CommunicationsService', () => {
  it('creates an announcement with the authenticated author and validated input', async () => {
    const repo = repository();
    const service = new CommunicationsService(repo);
    const input: CreateAnnouncementInput = {
      campusId,
      title: '  Campus notice  ',
      content: '  Term begins Monday.  ',
      targetAudience: 'students',
      publishDate: '2026-10-12T09:30:00.000Z',
      isPinned: true,
    };

    await service.createAnnouncement(context, input);

    expect(repo.createAnnouncement).toHaveBeenCalledWith(
      organizationId,
      authorId,
      expect.objectContaining({
        campusId,
        title: 'Campus notice',
        content: 'Term begins Monday.',
        targetAudience: 'students',
        publishDate: '2026-10-12T09:30:00.000Z',
        isPinned: true,
      }),
    );
  });

  it('applies query filters and limits list results to assigned campuses', async () => {
    const repo = repository();
    const service = new CommunicationsService(repo);

    await service.listAnnouncements(context, {
      status: 'published',
      targetAudience: 'students',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });

    expect(repo.listAnnouncements).toHaveBeenCalledWith(
      organizationId,
      {
        status: 'published',
        targetAudience: 'students',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      },
      [campusId],
    );
  });

  it('rejects creation for a campus outside the user campus scope', async () => {
    const repo = repository();
    const service = new CommunicationsService(repo);

    await expect(
      service.createAnnouncement(context, {
        campusId: otherCampusId,
        title: 'Campus notice',
        content: 'Term begins Monday.',
      }),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    expect(repo.createAnnouncement).not.toHaveBeenCalled();
  });

  it('prevents reading announcements belonging to another campus', async () => {
    const repo = repository({
      getAnnouncement: vi.fn().mockResolvedValue({
        ...record,
        campusId: otherCampusId,
      }),
    });
    const service = new CommunicationsService(repo);

    await expect(
      service.getAnnouncement(context, announcementId),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });
  });
});
