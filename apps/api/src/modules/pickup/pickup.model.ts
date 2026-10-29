import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type {
  AuthorizedPickupPerson,
  PickupPass,
  PickupLog,
} from './pickup.types.js';

// 1. Authorized Pickup Person Schema
export interface AuthorizedPickupPersonDocument
  extends Omit<AuthorizedPickupPerson, 'id'>, Document {}

const authorizedPickupPersonSchema = new Schema<AuthorizedPickupPersonDocument>(
  {
    organizationId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    relationship: {
      type: String,
      required: true,
      enum: [
        'father',
        'mother',
        'brother',
        'sister',
        'grandparent',
        'driver',
        'other',
      ],
    },
    cnic: { type: String, trim: true, maxlength: 20 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    photoUrl: { type: String, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

authorizedPickupPersonSchema.index({
  organizationId: 1,
  studentId: 1,
  status: 1,
});

// 2. Pickup Pass (Temporary / Expiring Gate-Pass) Schema
export interface PickupPassDocument extends Omit<PickupPass, 'id'>, Document {}

const pickupPassSchema = new Schema<PickupPassDocument>(
  {
    organizationId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    pickupPersonId: { type: String, required: true, index: true },
    passCode: { type: String, required: true, trim: true },
    validFrom: { type: String, required: true },
    validUntil: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['active', 'used', 'expired', 'revoked'],
      default: 'active',
      index: true,
    },
    generatedByUserId: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

pickupPassSchema.index({
  organizationId: 1,
  passCode: 1,
  status: 1,
});

// 3. Pickup Log (Immutable Handover Trail) Schema
export interface PickupLogDocument extends Omit<PickupLog, 'id'>, Document {}

const pickupLogSchema = new Schema<PickupLogDocument>(
  {
    organizationId: { type: String, required: true, index: true },
    campusId: { type: String, index: true },
    studentId: { type: String, required: true, index: true },
    pickupPersonId: { type: String },
    passId: { type: String },
    releasedByStaffId: { type: String, required: true, index: true },
    releasedAt: { type: String, required: true },
    method: {
      type: String,
      required: true,
      enum: ['digital_pass', 'manual_override'],
    },
    overrideReason: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

pickupLogSchema.index({
  organizationId: 1,
  studentId: 1,
  releasedAt: -1,
});

export const AuthorizedPickupPersonModel: Model<AuthorizedPickupPersonDocument> =
  mongoose.models.AuthorizedPickupPerson ||
  mongoose.model<AuthorizedPickupPersonDocument>(
    'AuthorizedPickupPerson',
    authorizedPickupPersonSchema,
  );

export const PickupPassModel: Model<PickupPassDocument> =
  mongoose.models.PickupPass ||
  mongoose.model<PickupPassDocument>('PickupPass', pickupPassSchema);

export const PickupLogModel: Model<PickupLogDocument> =
  mongoose.models.PickupLog ||
  mongoose.model<PickupLogDocument>('PickupLog', pickupLogSchema);
