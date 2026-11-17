import { describe, expect, it, vi } from 'vitest';
import {
  buildWhatsAppShareUrl,
  OrganizationService,
} from './organizations.service.js';
import type { OrganizationRepository } from './organizations.types.js';
import type { AuthEmailDelivery } from '../auth/auth.types.js';

const context = {
  membershipId: '650000000000000000000003',
  organizationId: '650000000000000000000001',
  userId: '650000000000000000000002',
  role: 'organization_owner' as const,
  campusIds: [],
  permissions: ['member.invite'],
};

function setup(delivered = true) {
  const repository = {
    findOrganization: vi.fn().mockResolvedValue({
      id: context.organizationId,
      name: 'North Institute',
      status: 'active',
    }),
    createInvitation: vi.fn().mockResolvedValue(undefined),
    revokeInvitation: vi.fn().mockResolvedValue(undefined),
  };
  const emailDelivery = {
    sendInvitation: vi.fn().mockResolvedValue(delivered),
    sendVerification: vi.fn(),
    sendPasswordReset: vi.fn(),
  };
  const service = new OrganizationService(
    repository as unknown as OrganizationRepository,
    emailDelivery as unknown as AuthEmailDelivery,
    () => new Date('2026-11-14T12:00:00.000Z'),
  );
  return { service, repository, emailDelivery };
}

describe('organization member invitations', () => {
  it('stores a hashed, seven-day invitation and sends the raw one-time token by email', async () => {
    const { service, repository, emailDelivery } = setup();

    const result = await service.invite(context, {
      email: ' Teacher@Example.edu ',
      role: 'teacher',
      campusIds: [],
    });

    expect(result.emailSent).toBe(true);
    expect(result.whatsappShareUrl).toBeNull();
    expect(repository.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: context.organizationId,
        invitedByUserId: context.userId,
        email: 'teacher@example.edu',
        role: 'teacher',
        campusIds: [],
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: new Date('2026-11-21T12:00:00.000Z'),
      }),
    );
    const invitation = repository.createInvitation.mock.calls[0]?.[0];
    const deliveredToken = emailDelivery.sendInvitation.mock.calls[0]?.[1];
    expect(deliveredToken).toHaveLength(43);
    expect(invitation?.tokenHash).not.toBe(deliveredToken);
    expect(emailDelivery.sendInvitation).toHaveBeenCalledWith(
      'teacher@example.edu',
      deliveredToken,
      'North Institute',
    );
    expect(repository.revokeInvitation).not.toHaveBeenCalled();
  });

  it('revokes a failed invitation when the local-only URL cannot be shared externally', async () => {
    const { service, repository, emailDelivery } = setup(false);

    await expect(
      service.invite(context, {
        email: 'parent@example.edu',
        role: 'parent_guardian',
        campusIds: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'INVITATION_DELIVERY_UNAVAILABLE',
    });

    expect(emailDelivery.sendInvitation).toHaveBeenCalledOnce();
    expect(repository.createInvitation).toHaveBeenCalledOnce();
    expect(repository.revokeInvitation).toHaveBeenCalledWith(
      context.organizationId,
      'parent@example.edu',
    );
  });

  it('creates WhatsApp share links only for public HTTPS invitation URLs', () => {
    expect(
      buildWhatsAppShareUrl('https://portal.example.edu', 'Join InstituteOS'),
    ).toBe('https://wa.me/?text=Join%20InstituteOS');
    expect(
      buildWhatsAppShareUrl('http://127.0.0.1:5173', 'Join InstituteOS'),
    ).toBeNull();
    expect(
      buildWhatsAppShareUrl('https://localhost:5173', 'Join InstituteOS'),
    ).toBeNull();
  });

  it('does not send email when a duplicate pending invitation already exists', async () => {
    const { service, repository, emailDelivery } = setup();
    repository.createInvitation.mockRejectedValue({ code: 11000 });

    await expect(
      service.invite(context, {
        email: 'teacher@example.edu',
        role: 'teacher',
        campusIds: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVITATION_PENDING',
    });

    expect(emailDelivery.sendInvitation).not.toHaveBeenCalled();
  });
});
