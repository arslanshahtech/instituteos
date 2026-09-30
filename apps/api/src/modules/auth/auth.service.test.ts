import { describe, expect, it, vi } from 'vitest';
import { AuthService, hashOpaqueToken } from './auth.service.js';
import {
  MemoryAuthEmailDelivery,
  MemoryAuthRepository,
} from './auth.test-helpers.js';

function makeService(
  requireEmailVerification = false,
  emailDelivery = new MemoryAuthEmailDelivery(),
  now: () => Date = () => new Date(),
) {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(
    repository,
    emailDelivery,
    {
      sessionTtlDays: 7,
      requireEmailVerification,
      webAppUrl: 'http://localhost:5173',
    },
    now,
  );
  return { service, repository, emailDelivery };
}

describe('authentication service', () => {
  it('registers with a password hash and creates a session that survives a fresh authentication lookup', async () => {
    const { service, repository } = makeService();
    const registration = await service.register({
      email: '  Person@Example.test ',
      displayName: 'Institute User',
      password: 'a long test password',
    });

    expect(registration.verificationRequired).toBe(false);
    const storedUser = await repository.findUserByEmail('person@example.test');
    expect(storedUser?.passwordHash).not.toBe('a long test password');
    expect(registration).not.toHaveProperty('user');

    const signedIn = await service.login(
      'PERSON@example.test',
      'a long test password',
    );
    expect((await service.authenticate(signedIn.sessionToken))?.user.id).toBe(
      storedUser!.id,
    );
  });

  it('rejects incorrect credentials without distinguishing the account lookup', async () => {
    const { service } = makeService();
    await service.register({
      email: 'person@example.test',
      displayName: 'User',
      password: 'a long test password',
    });
    await expect(
      service.login('person@example.test', 'incorrect password'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
    await expect(
      service.login('unknown@example.test', 'incorrect password'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('verifies an email using a one-time token and activates the account', async () => {
    const { service, repository, emailDelivery } = makeService(true);
    const registration = await service.register({
      email: 'person@example.test',
      displayName: 'User',
      password: 'a long test password',
    });
    expect(registration.verificationRequired).toBe(true);
    expect(registration).not.toHaveProperty('session');
    await expect(
      service.login('person@example.test', 'a long test password'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const verified = await service.verifyEmail(
      emailDelivery.verificationTokens[0]!,
    );
    expect(verified.user.status).toBe('active');
    await expect(
      service.verifyEmail(emailDelivery.verificationTokens[0]!),
    ).rejects.toMatchObject({ code: 'VERIFICATION_TOKEN_INVALID' });
    expect(
      repository.users.get(verified.user.id)?.verificationTokenHash,
    ).toBeNull();
  });

  it('resets a password once and invalidates earlier sessions', async () => {
    const { service, emailDelivery } = makeService();
    await service.register({
      email: 'person@example.test',
      displayName: 'User',
      password: 'a long test password',
    });
    const oldSession = await service.login(
      'person@example.test',
      'a long test password',
    );
    await service.requestPasswordReset('person@example.test');
    const resetToken = emailDelivery.resetTokens[0]!;
    await service.resetPassword(resetToken, 'a different new password');

    expect(await service.authenticate(oldSession.sessionToken)).toBeNull();
    await expect(
      service.resetPassword(resetToken, 'another new password'),
    ).rejects.toMatchObject({ code: 'RESET_TOKEN_INVALID' });
    await expect(
      service.login('person@example.test', 'a long test password'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      service.login('person@example.test', 'a different new password'),
    ).resolves.toMatchObject({ user: { email: 'person@example.test' } });
  });

  it('persists only a reset-token hash and rejects an expired token', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const { service, repository, emailDelivery } = makeService(
      false,
      new MemoryAuthEmailDelivery(),
      () => now,
    );
    await service.register({
      email: 'person@example.test',
      displayName: 'User',
      password: 'a long test password',
    });

    await service.requestPasswordReset('person@example.test');
    const resetToken = emailDelivery.resetTokens[0]!;
    const storedUser = await repository.findUserByEmail('person@example.test');
    expect(storedUser?.passwordResetTokenHash).toBe(
      hashOpaqueToken(resetToken),
    );
    expect(storedUser?.passwordResetTokenHash).not.toBe(resetToken);
    expect(storedUser?.passwordResetExpiresAt?.getTime()).toBe(
      now.getTime() + 30 * 60 * 1000,
    );

    now = new Date(now.getTime() + 30 * 60 * 1000 + 1);
    await expect(
      service.resetPassword(resetToken, 'a different new password'),
    ).rejects.toMatchObject({ code: 'RESET_TOKEN_INVALID' });
    await expect(
      service.login('person@example.test', 'a long test password'),
    ).resolves.toMatchObject({ user: { email: 'person@example.test' } });
  });

  it('does not log reset credentials when the email delivery abstraction is unavailable', async () => {
    let attemptedToken = '';
    const emailDelivery = new MemoryAuthEmailDelivery();
    emailDelivery.sendPasswordReset = async (_email, token) => {
      attemptedToken = token;
      return false;
    };
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { service, repository } = makeService(false, emailDelivery);
    await service.register({
      email: 'person@example.test',
      displayName: 'User',
      password: 'a long test password',
    });

    await expect(
      service.requestPasswordReset('person@example.test'),
    ).resolves.toBeUndefined();
    const log = String(warning.mock.calls[0]?.[0]);
    const storedUser = await repository.findUserByEmail('person@example.test');
    expect(warning).toHaveBeenCalledOnce();
    expect(log).toContain('auth.email.delivery.unavailable');
    expect(log).toContain('password_reset');
    expect(log).not.toContain(attemptedToken);
    expect(log).not.toContain('person@example.test');
    expect(storedUser?.passwordResetTokenHash).toBe(
      hashOpaqueToken(attemptedToken),
    );
    warning.mockRestore();
  });

  it('changes passwords only after checking the current password and rotates all sessions', async () => {
    const { service, repository } = makeService();
    await service.register({
      email: 'person@example.test',
      displayName: 'User',
      password: 'a long test password',
    });
    const earlier = await service.login(
      'person@example.test',
      'a long test password',
    );
    const changed = await service.changePassword(
      (await repository.findUserByEmail('person@example.test'))!.id,
      'a long test password',
      'a different new password',
    );
    expect(await service.authenticate(earlier.sessionToken)).toBeNull();
    expect(await service.authenticate(changed.sessionToken)).not.toBeNull();
  });
});
