import mongoose, { Schema } from 'mongoose';
import type { AccountStatus } from './auth.types.js';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: [
        'pending_verification',
        'active',
        'disabled',
      ] satisfies AccountStatus[],
      default: 'pending_verification',
      required: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationExpiresAt: { type: Date, default: null, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: true }, versionKey: false },
);

const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    csrfTokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthUserModel =
  mongoose.models.AuthUser ?? mongoose.model('AuthUser', userSchema);
export const AuthSessionModel =
  mongoose.models.AuthSession ?? mongoose.model('AuthSession', sessionSchema);
