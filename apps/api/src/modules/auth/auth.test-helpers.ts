import type {
  AuthEmailDelivery,
  AuthRepository,
  AuthSession,
  AuthUser,
} from './auth.types.js';

export class MemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, AuthUser>();
  readonly sessions = new Map<string, AuthSession>();
  private sequence = 0;

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return (
      [...this.users.values()].find((user) => user.email === email) ?? null
    );
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(
    input: Omit<AuthUser, 'id' | 'createdAt'>,
  ): Promise<AuthUser> {
    if (await this.findUserByEmail(input.email))
      throw Object.assign(new Error('duplicate'), { code: 11000 });
    const user = {
      ...input,
      id: String(++this.sequence),
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(
    id: string,
    changes: Partial<AuthUser>,
  ): Promise<AuthUser | null> {
    const user = this.users.get(id);
    if (!user) return null;
    Object.assign(user, changes);
    return user;
  }

  async verifyUser(tokenHash: string, now: Date): Promise<AuthUser | null> {
    const user = [...this.users.values()].find(
      (candidate) =>
        candidate.verificationTokenHash === tokenHash &&
        candidate.verificationExpiresAt! > now,
    );
    if (!user) return null;
    user.status = 'active';
    user.emailVerifiedAt = now;
    user.verificationTokenHash = null;
    user.verificationExpiresAt = null;
    return user;
  }

  async consumePasswordReset(
    tokenHash: string,
    now: Date,
    passwordHash: string,
  ): Promise<AuthUser | null> {
    const user = [...this.users.values()].find(
      (candidate) =>
        candidate.passwordResetTokenHash === tokenHash &&
        candidate.passwordResetExpiresAt! > now &&
        candidate.status === 'active',
    );
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    return user;
  }

  async createSession(
    input: Omit<AuthSession, 'id' | 'createdAt'>,
  ): Promise<AuthSession> {
    const session = {
      ...input,
      id: String(++this.sequence),
      createdAt: new Date(),
    };
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  async findSession(tokenHash: string, now: Date): Promise<AuthSession | null> {
    const session = this.sessions.get(tokenHash);
    return session && session.expiresAt > now ? session : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    for (const [tokenHash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(tokenHash);
    }
  }
}

export class MemoryAuthEmailDelivery implements AuthEmailDelivery {
  readonly verificationTokens: string[] = [];
  readonly resetTokens: string[] = [];

  async sendVerification(_email: string, token: string): Promise<boolean> {
    this.verificationTokens.push(token);
    return true;
  }

  async sendPasswordReset(_email: string, token: string): Promise<boolean> {
    this.resetTokens.push(token);
    return true;
  }
}
