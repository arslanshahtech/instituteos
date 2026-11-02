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
  } as unknown as CommunicationsService;
  const messaging = {
    listThreads: vi.fn().mockResolvedValue([{ id: 'assigned-thread' }]),
    replyToThread: vi
      .fn()
      .mockResolvedValue({
        id: 'reply-created',
        content: 'Thanks for the update.',
      }),
    startConversation: vi.fn(),
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

  it('does not allow a teacher to start a parent-initiated conversation', async () => {
    const { app, messaging } = appForRole('teacher');
    const response = await request(app)
      .post(`/${organizationId}/communications/threads`)
      .set('Cookie', `instituteos_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        studentId: '650000000000000000000004',
        teacherUserId: '650000000000000000000005',
        subjectTitle: 'Homework',
        initialMessage: 'Please explain the homework.',
      });

    expect(response.status).toBe(403);
    expect(messaging.startConversation).not.toHaveBeenCalled();
  });
});
