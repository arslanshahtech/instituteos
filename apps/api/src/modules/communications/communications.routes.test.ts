import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { hashOpaqueToken } from '../auth/auth.service.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from '../tenancy/tenancy.types.js';
import { createCommunicationsRouter } from './communications.routes.js';
import type { AnnouncementRecord } from './communications.types.js';
import type {
  CommunicationsService,
  MessagingService,
} from './communications.service.js';

afterEach(() => vi.restoreAllMocks());

const organizationId = '650000000000000000000001';
const userId = '650000000000000000000002';
const csrfToken = 'teacher-communications-csrf';

function appForRole(role: OrganizationRole) {
  const announcements = {
    listAnnouncements: vi.fn().mockResolvedValue([]),
    createAnnouncement: vi
      .fn()
      .mockResolvedValue({ id: 'announcement-created' }),
    updateAnnouncement: vi
      .fn()
      .mockResolvedValue({ id: 'announcement-updated' }),
    deleteAnnouncement: vi.fn().mockResolvedValue(undefined),
  } as unknown as CommunicationsService;
  const messaging = {
    listThreads: vi.fn().mockResolvedValue([{ id: 'assigned-thread' }]),
    replyToThread: vi.fn().mockResolvedValue({
      id: 'reply-created',
      content: 'Thanks for the update.',
    }),
    startConversation: vi.fn(),
    startTeacherConversation: vi.fn().mockResolvedValue({
      thread: { id: 'teacher-thread' },
      message: { id: 'teacher-message' },
    }),
  } as unknown as MessagingService;
  const accessRepository: OrganizationAccessRepository = {
    findActiveMembership: vi.fn().mockResolvedValue({
      membershipId: '650000000000000000000003',
      organizationId,
      userId,
      role,
      campusIds: [],
    }),
    findLifecycleOwner: vi.fn().mockResolvedValue(false),
    hasPlatformRole: vi.fn().mockResolvedValue(false),
  };
  const authenticate = async (
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    response.locals.auth = {
      user: { id: userId },
      session: { csrfTokenHash: hashOpaqueToken(csrfToken) },
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    createCommunicationsRouter(
      announcements,
      messaging,
      accessRepository,
      authenticate,
    ),
  );
  app.use(errorHandler);
  return { app, announcements, messaging };
}

describe('Teacher communications authorization routes', () => {
  it('allows a teacher to list only threads returned for their authenticated account', async () => {
    const { app, messaging } = appForRole('teacher');
    const response = await request(app).get(
      `/${organizationId}/communications/threads`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [{ id: 'assigned-thread' }] });
    expect(messaging.listThreads).toHaveBeenCalledWith(
      organizationId,
      userId,
      'teacher',
    );
  });

  it('allows a teacher to reply to an existing conversation through the protected messaging route', async () => {
    const { app, messaging } = appForRole('teacher');
    const threadId = '650000000000000000000012';
    const response = await request(app)
      .post(`/${organizationId}/communications/threads/${threadId}/messages`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ content: 'Thanks for the update.' });

    expect(response.status).toBe(201);
    expect(messaging.replyToThread).toHaveBeenCalledWith(
      organizationId,
      userId,
      'teacher',
      threadId,
      { content: 'Thanks for the update.' },
    );
  });

  it('does not allow teachers to manage organization-wide announcements', async () => {
    const { app, announcements } = appForRole('teacher');
    const response = await request(app).get(`/${organizationId}/announcements`);

    expect(response.status).toBe(403);
    expect(announcements.listAnnouncements).not.toHaveBeenCalled();
  });

  it('gives parents a read-only feed of published guardian and all-audience notices', async () => {
    const { app, announcements } = appForRole('parent_guardian');
    const records: AnnouncementRecord[] = [
      {
        id: 'notice-all',
        organizationId,
        title: 'School closure',
        content: 'The campus will be closed on Friday.',
        targetAudience: 'all',
        status: 'published',
        publishDate: '2026-11-16T00:00:00.000Z',
        authorId: userId,
        isPinned: true,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-guardians',
        organizationId,
        title: 'Parent meeting',
        content: 'The parent meeting starts at 10 AM.',
        targetAudience: 'guardians',
        status: 'published',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-staff',
        organizationId,
        title: 'Staff notice',
        content: 'Staff-only update.',
        targetAudience: 'staff',
        status: 'published',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-campus',
        organizationId,
        campusId: '650000000000000000000099',
        title: 'Other campus notice',
        content: 'This campus is not assigned to this parent.',
        targetAudience: 'guardians',
        status: 'published',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-draft',
        organizationId,
        title: 'Draft notice',
        content: 'This is not published.',
        targetAudience: 'guardians',
        status: 'draft',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
    ];
    vi.mocked(announcements.listAnnouncements).mockResolvedValue(records);

    const response = await request(app).get(
      '/' + organizationId + '/announcements/parent-feed',
    );

    expect(response.status).toBe(200);
    expect(
      response.body.items.map((item: AnnouncementRecord) => item.title),
    ).toEqual(['School closure', 'Parent meeting']);
    expect(announcements.listAnnouncements).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        userId,
        role: 'parent_guardian',
      }),
      { status: 'published' },
    );
  });

  it('gives teachers a read-only feed of published staff and all-audience notices', async () => {
    const { app, announcements } = appForRole('teacher');
    const records: AnnouncementRecord[] = [
      {
        id: 'notice-all',
        organizationId,
        title: 'Institute update',
        content: 'Assembly at 8 AM.',
        targetAudience: 'all',
        status: 'published',
        publishDate: '2026-11-16T00:00:00.000Z',
        authorId: userId,
        isPinned: true,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-staff',
        organizationId,
        title: 'Staff meeting',
        content: 'Meeting at 1 PM.',
        targetAudience: 'staff',
        status: 'published',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-guardians',
        organizationId,
        title: 'Parent-only update',
        content: 'For guardians.',
        targetAudience: 'guardians',
        status: 'published',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
      {
        id: 'notice-draft',
        organizationId,
        title: 'Draft',
        content: 'Not published.',
        targetAudience: 'staff',
        status: 'draft',
        publishDate: '2026-11-15T00:00:00.000Z',
        authorId: userId,
        isPinned: false,
        createdAt: '2026-11-15T00:00:00.000Z',
        updatedAt: '2026-11-15T00:00:00.000Z',
      },
    ];
    vi.mocked(announcements.listAnnouncements).mockResolvedValue(records);

    const response = await request(app).get(
      '/' + organizationId + '/announcements/teacher-feed',
    );

    expect(response.status).toBe(200);
    expect(
      response.body.items.map((item: AnnouncementRecord) => item.title),
    ).toEqual(['Institute update', 'Staff meeting']);
    expect(announcements.listAnnouncements).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, userId, role: 'teacher' }),
      { status: 'published' },
    );
  });

  it('allows a teacher to start a conversation with a selected linked guardian', async () => {
    const { app, messaging } = appForRole('teacher');
    const response = await request(app)
      .post(`/${organizationId}/communications/threads`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        studentId: '650000000000000000000004',
        teacherUserId: userId,
        guardianUserId: '650000000000000000000006',
        subjectTitle: 'Homework',
        initialMessage: 'Please explain the homework.',
      });

    expect(response.status).toBe(201);
    expect(messaging.startTeacherConversation).toHaveBeenCalledWith(
      organizationId,
      userId,
      '650000000000000000000006',
      expect.objectContaining({
        studentId: '650000000000000000000004',
        teacherUserId: userId,
      }),
      undefined,
    );
  });

  it('allows organization admins to list parent-teacher conversations and reply', async () => {
    const { app, messaging } = appForRole('organization_admin');
    const listResponse = await request(app).get(
      `/${organizationId}/communications/threads`,
    );
    const replyResponse = await request(app)
      .post(
        `/${organizationId}/communications/threads/650000000000000000000012/messages`,
      )
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ content: 'Admin follow-up.' });

    expect(listResponse.status).toBe(200);
    expect(replyResponse.status).toBe(201);
    expect(messaging.listThreads).toHaveBeenCalledWith(
      organizationId,
      userId,
      'organization_admin',
    );
    expect(messaging.replyToThread).toHaveBeenCalledWith(
      organizationId,
      userId,
      'admin',
      '650000000000000000000012',
      { content: 'Admin follow-up.' },
    );
  });

  it('does not grant principal-director access to private Messages', async () => {
    const { app, messaging } = appForRole('principal_director');
    const response = await request(app).get(
      `/${organizationId}/communications/threads`,
    );

    expect(response.status).toBe(403);
    expect(messaging.listThreads).not.toHaveBeenCalled();
  });

  it('allows an organization admin to create, update and delete announcements', async () => {
    const { app, announcements } = appForRole('organization_admin');
    const createResponse = await request(app)
      .post(`/${organizationId}/announcements`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Term update',
        content: 'School reopens on Monday.',
        targetAudience: 'all',
        status: 'published',
        isPinned: true,
      });
    const updateResponse = await request(app)
      .patch(`/${organizationId}/announcements/650000000000000000000012`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Updated term update' });
    const deleteResponse = await request(app)
      .delete(`/${organizationId}/announcements/650000000000000000000012`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken);

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(204);
    expect(announcements.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        userId,
        role: 'organization_admin',
      }),
      expect.objectContaining({
        title: 'Term update',
        content: 'School reopens on Monday.',
        status: 'published',
      }),
    );
    expect(announcements.updateAnnouncement).toHaveBeenCalled();
    expect(announcements.deleteAnnouncement).toHaveBeenCalled();
  });

  it('rejects announcement writes without CSRF protection', async () => {
    const { app, announcements } = appForRole('organization_admin');
    const response = await request(app)
      .post(`/${organizationId}/announcements`)
      .send({
        title: 'Term update',
        content: 'School reopens on Monday.',
        targetAudience: 'all',
        status: 'published',
        isPinned: false,
      });

    expect(response.status).toBe(403);
    expect(announcements.createAnnouncement).not.toHaveBeenCalled();
  });
});
