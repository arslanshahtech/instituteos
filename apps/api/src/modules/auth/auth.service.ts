import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import type {
  AuthConfig,
  AuthEmailDelivery,
  AuthRepository,
  AuthSession,
  AuthUser,
  IssuedSession,
  PublicUser,
} from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

export function hashOpaqueToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function publicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly emailDelivery: AuthEmailDelivery,
    private readonly config: AuthConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(input: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<{ verificationRequired: boolean }> {
    const email = input.email.trim().toLowerCase();
    if (await this.repository.findUserByEmail(email))
      return { verificationRequired: this.config.requireEmailVerification };

    const requireVerification = this.config.requireEmailVerification;
    const verificationToken = requireVerification ? createOpaqueToken() : null;
    const now = this.now();
    try {
      await this.repository.createUser({
        email,
        displayName: input.displayName.trim(),
        passwordHash: await hashPassword(input.password),
        status: requireVerification ? 'pending_verification' : 'active',
        emailVerifiedAt: requireVerification ? null : now,
        verificationTokenHash: verificationToken
          ? hashOpaqueToken(verificationToken)
          : null,
        verificationExpiresAt: verificationToken
          ? new Date(now.getTime() + VERIFICATION_TTL_MS)
          : null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return { verificationRequired: this.config.requireEmailVerification };
      }
      throw error;
    }

    if (verificationToken) {
      const delivered = await this.emailDelivery.sendVerification(
        email,
        verificationToken,
      );
      if (!delivered) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'auth.email.delivery.unavailable',
            purpose: 'verification',
          }),
        );
      }
      return { verificationRequired: true };
    }

    return { verificationRequired: false };
  }

  async login(emailInput: string, password: string): Promise<IssuedSession> {
    const user = await this.repository.findUserByEmail(
      emailInput.trim().toLowerCase(),
    );
    const hashToCheck = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, hashToCheck);
    if (!user || !passwordMatches || user.status !== 'active') {
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'Email or password is incorrect.',
      );
    }
    return this.issueSession(user);
  }

  async authenticate(
    token: string,
  ): Promise<{ user: PublicUser; session: AuthSession } | null> {
    const session = await this.repository.findSession(
      hashOpaqueToken(token),
      this.now(),
    );
    if (!session) return null;
    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== 'active') return null;
    return { user: publicUser(user), session };
  }

  async logout(token: string): Promise<void> {
    await this.repository.deleteSession(hashOpaqueToken(token));
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<IssuedSession> {
    const user = await this.repository.findUserById(userId);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new AppError(
        400,
        'CURRENT_PASSWORD_INVALID',
        'The current password is incorrect.',
      );
    }
    const updated = await this.repository.updateUser(user.id, {
      passwordHash: await hashPassword(newPassword),
    });
    if (!updated)
      throw new AppError(
        404,
        'ACCOUNT_NOT_FOUND',
        'The account is unavailable.',
      );
    await this.repository.deleteSessionsForUser(user.id);
    return this.issueSession(updated);
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const user = await this.repository.findUserByEmail(
      emailInput.trim().toLowerCase(),
    );
    if (!user || user.status !== 'active') return;
    const token = createOpaqueToken();
    const now = this.now();
    await this.repository.updateUser(user.id, {
      passwordResetTokenHash: hashOpaqueToken(token),
      passwordResetExpiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });
    if (!(await this.emailDelivery.sendPasswordReset(user.email, token))) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'auth.email.delivery.unavailable',
          purpose: 'password_reset',
        }),
      );
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const updated = await this.repository.consumePasswordReset(
      hashOpaqueToken(token),
      this.now(),
      await hashPassword(password),
    );
    if (!updated)
      throw new AppError(
        400,
        'RESET_TOKEN_INVALID',
        'The reset link is invalid or has expired.',
      );
    await this.repository.deleteSessionsForUser(updated.id);
  }

  async verifyEmail(token: string): Promise<IssuedSession> {
    const user = await this.repository.verifyUser(
      hashOpaqueToken(token),
      this.now(),
    );
    if (!user)
      throw new AppError(
        400,
        'VERIFICATION_TOKEN_INVALID',
        'The verification link is invalid or has expired.',
      );
    return this.issueSession(user);
  }

  async resendVerification(emailInput: string): Promise<void> {
    const user = await this.repository.findUserByEmail(
      emailInput.trim().toLowerCase(),
    );
    if (!user || user.status !== 'pending_verification') return;
    const token = createOpaqueToken();
    const now = this.now();
    await this.repository.updateUser(user.id, {
      verificationTokenHash: hashOpaqueToken(token),
      verificationExpiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    });
    if (!(await this.emailDelivery.sendVerification(user.email, token))) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'auth.email.delivery.unavailable',
          purpose: 'verification',
        }),
      );
    }
  }

  private async issueSession(user: AuthUser): Promise<IssuedSession> {
    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const expiresAt = new Date(
      this.now().getTime() + this.config.sessionTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashOpaqueToken(sessionToken),
      csrfTokenHash: hashOpaqueToken(csrfToken),
      expiresAt,
    });
    return { user: publicUser(user), sessionToken, csrfToken, expiresAt };
  }
}

const DUMMY_PASSWORD_HASH =
  'scrypt$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
