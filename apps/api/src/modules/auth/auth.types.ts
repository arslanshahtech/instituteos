export type AccountStatus = 'pending_verification' | 'active' | 'disabled';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  verificationTokenHash: string | null;
  verificationExpiresAt: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetExpiresAt: Date | null;
  createdAt: Date;
}

export type PublicUser = Pick<
  AuthUser,
  'id' | 'email' | 'displayName' | 'status' | 'emailVerifiedAt' | 'createdAt'
>;

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createUser(input: Omit<AuthUser, 'id' | 'createdAt'>): Promise<AuthUser>;
  updateUser(id: string, changes: Partial<AuthUser>): Promise<AuthUser | null>;
  verifyUser(tokenHash: string, now: Date): Promise<AuthUser | null>;
  consumePasswordReset(
    tokenHash: string,
    now: Date,
    passwordHash: string,
  ): Promise<AuthUser | null>;
  createSession(
    input: Omit<AuthSession, 'id' | 'createdAt'>,
  ): Promise<AuthSession>;
  findSession(tokenHash: string, now: Date): Promise<AuthSession | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
}

export interface AuthEmailDelivery {
  sendVerification(email: string, token: string): Promise<boolean>;
  sendPasswordReset(email: string, token: string): Promise<boolean>;
  sendInvitation(
    email: string,
    token: string,
    organizationName: string,
  ): Promise<boolean>;
}

export interface AuthConfig {
  sessionTtlDays: number;
  requireEmailVerification: boolean;
  webAppUrl: string;
}

export interface IssuedSession {
  user: PublicUser;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}
