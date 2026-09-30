import mongoose from 'mongoose';
import { AuthSessionModel, AuthUserModel } from './auth.model.js';
import type { AuthRepository, AuthSession, AuthUser } from './auth.types.js';

function asUser(value: Record<string, unknown> | null): AuthUser | null {
  if (!value) return null;
  return {
    id: String(value._id),
    email: String(value.email),
    displayName: String(value.displayName),
    passwordHash: String(value.passwordHash),
    status: value.status as AuthUser['status'],
    emailVerifiedAt: value.emailVerifiedAt as Date | null,
    verificationTokenHash: value.verificationTokenHash as string | null,
    verificationExpiresAt: value.verificationExpiresAt as Date | null,
    passwordResetTokenHash: value.passwordResetTokenHash as string | null,
    passwordResetExpiresAt: value.passwordResetExpiresAt as Date | null,
    createdAt: value.createdAt as Date,
  };
}

function asSession(value: Record<string, unknown> | null): AuthSession | null {
  if (!value) return null;
  return {
    id: String(value._id),
    userId: String(value.userId),
    tokenHash: String(value.tokenHash),
    csrfTokenHash: String(value.csrfTokenHash),
    expiresAt: value.expiresAt as Date,
    createdAt: value.createdAt as Date,
  };
}

const secretFields =
  '+passwordHash +verificationTokenHash +verificationExpiresAt +passwordResetTokenHash +passwordResetExpiresAt';

export class MongoAuthRepository implements AuthRepository {
  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return asUser(
      (await AuthUserModel.findOne({ email })
        .select(secretFields)
        .lean()) as Record<string, unknown> | null,
    );
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return asUser(
      (await AuthUserModel.findById(id).select(secretFields).lean()) as Record<
        string,
        unknown
      > | null,
    );
  }

  async createUser(
    input: Omit<AuthUser, 'id' | 'createdAt'>,
  ): Promise<AuthUser> {
    const created = await AuthUserModel.create(input);
    const value = (await AuthUserModel.findById(created._id)
      .select(secretFields)
      .lean()) as Record<string, unknown> | null;
    if (!value)
      throw new Error('Created authentication user could not be loaded.');
    return asUser(value)!;
  }

  async updateUser(
    id: string,
    changes: Partial<AuthUser>,
  ): Promise<AuthUser | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    const { id: _id, ...safeChanges } = changes;
    void _id;
    return asUser(
      (await AuthUserModel.findByIdAndUpdate(id, safeChanges, {
        new: true,
        runValidators: true,
      })
        .select(secretFields)
        .lean()) as Record<string, unknown> | null,
    );
  }

  async verifyUser(tokenHash: string, now: Date): Promise<AuthUser | null> {
    return asUser(
      (await AuthUserModel.findOneAndUpdate(
        {
          verificationTokenHash: tokenHash,
          verificationExpiresAt: { $gt: now },
          status: 'pending_verification',
        },
        {
          $set: { status: 'active', emailVerifiedAt: now },
          $unset: { verificationTokenHash: 1, verificationExpiresAt: 1 },
        },
        { new: true },
      )
        .select(secretFields)
        .lean()) as Record<string, unknown> | null,
    );
  }

  async consumePasswordReset(
    tokenHash: string,
    now: Date,
    passwordHash: string,
  ): Promise<AuthUser | null> {
    return asUser(
      (await AuthUserModel.findOneAndUpdate(
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { $gt: now },
          status: 'active',
        },
        {
          $set: { passwordHash },
          $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        },
        { new: true },
      )
        .select(secretFields)
        .lean()) as Record<string, unknown> | null,
    );
  }

  async createSession(
    input: Omit<AuthSession, 'id' | 'createdAt'>,
  ): Promise<AuthSession> {
    return asSession(
      (await AuthSessionModel.create(input)).toObject() as Record<
        string,
        unknown
      >,
    )!;
  }

  async findSession(tokenHash: string, now: Date): Promise<AuthSession | null> {
    return asSession(
      (await AuthSessionModel.findOne({ tokenHash, expiresAt: { $gt: now } })
        .select('+tokenHash +csrfTokenHash')
        .lean()) as Record<string, unknown> | null,
    );
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await AuthSessionModel.deleteOne({ tokenHash });
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await AuthSessionModel.deleteMany({ userId });
  }
}
