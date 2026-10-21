import mongoose, { Schema } from 'mongoose';
import {
  ORGANIZATION_ROLES,
  type MembershipStatus,
  type OrganizationStatus,
  type PlatformGrantStatus,
} from './tenancy.types.js';
import { PLATFORM_ROLES } from './authorization.js';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    adminName: { type: String, trim: true, maxlength: 120 },
    shortCode: { type: String, trim: true, uppercase: true, maxlength: 24 },
    tagline: { type: String, trim: true, maxlength: 180 },
    logoDataUrl: { type: String, maxlength: 500000 },
    subdomain: { type: String, lowercase: true, trim: true, maxlength: 63 },
    plan: { type: String, enum: ['Starter', 'Growth', 'Enterprise'] },
    trialEndsAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'suspended', 'archived'] satisfies OrganizationStatus[],
      default: 'active',
      required: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
    },
    contactEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: {
      line1: { type: String, trim: true, maxlength: 160 },
      line2: { type: String, trim: true, maxlength: 160 },
      city: { type: String, trim: true, maxlength: 100 },
      region: { type: String, trim: true, maxlength: 100 },
      postalCode: { type: String, trim: true, maxlength: 30 },
      country: { type: String, trim: true, maxlength: 100 },
    },
    timezone: { type: String, trim: true, maxlength: 80, default: 'UTC' },
    ownerMutationRevision: { type: Number, default: 0, select: false },
  },
  { timestamps: true, versionKey: false },
);

organizationSchema.index(
  { subdomain: 1 },
  {
    unique: true,
    name: 'uniq_organization_subdomain',
    partialFilterExpression: { subdomain: { $type: 'string' } },
  },
);

const membershipSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
    },
    role: { type: String, enum: ORGANIZATION_ROLES, required: true },
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'] satisfies MembershipStatus[],
      default: 'active',
      required: true,
    },
    campusIds: [{ type: Schema.Types.ObjectId, ref: 'Campus', default: [] }],
  },
  { timestamps: true, versionKey: false },
);

membershipSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true, name: 'uniq_membership_organization_user' },
);
membershipSchema.index({ organizationId: 1, campusIds: 1 });

const platformRoleGrantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
    },
    role: {
      type: String,
      enum: [...PLATFORM_ROLES],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'] satisfies PlatformGrantStatus[],
      default: 'active',
      required: true,
    },
    grantedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

platformRoleGrantSchema.index(
  { userId: 1, role: 1 },
  { unique: true, name: 'uniq_platform_grant_user_role' },
);

export const OrganizationModel =
  mongoose.models.Organization ??
  mongoose.model('Organization', organizationSchema);
export const MembershipModel =
  mongoose.models.OrganizationMembership ??
  mongoose.model('OrganizationMembership', membershipSchema);
export const PlatformRoleGrantModel =
  mongoose.models.PlatformRoleGrant ??
  mongoose.model('PlatformRoleGrant', platformRoleGrantSchema);

const campusSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    address: {
      line1: { type: String, trim: true, maxlength: 160 },
      line2: { type: String, trim: true, maxlength: 160 },
      city: { type: String, trim: true, maxlength: 100 },
      region: { type: String, trim: true, maxlength: 100 },
      postalCode: { type: String, trim: true, maxlength: 30 },
      country: { type: String, trim: true, maxlength: 100 },
    },
  },
  { timestamps: true, versionKey: false },
);
campusSchema.index({ organizationId: 1, status: 1, name: 1 });

const invitationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ORGANIZATION_ROLES, required: true },
    campusIds: [{ type: Schema.Types.ObjectId, ref: 'Campus', default: [] }],
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
    },
    tokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked'],
      default: 'pending',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
invitationSchema.index({ tokenHash: 1 }, { unique: true });
invitationSchema.index(
  { organizationId: 1, email: 1 },
  {
    unique: true,
    name: 'uniq_pending_invitation_organization_email',
    partialFilterExpression: { status: 'pending' },
  },
);
invitationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const CampusModel =
  mongoose.models.Campus ?? mongoose.model('Campus', campusSchema);
export const OrganizationInvitationModel =
  mongoose.models.OrganizationInvitation ??
  mongoose.model('OrganizationInvitation', invitationSchema);

const organizationAuditEventSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      required: true,
    },
    action: { type: String, required: true, maxlength: 80 },
    targetId: { type: Schema.Types.ObjectId, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
organizationAuditEventSchema.index({ organizationId: 1, createdAt: -1 });

export const OrganizationAuditEventModel =
  mongoose.models.OrganizationAuditEvent ??
  mongoose.model('OrganizationAuditEvent', organizationAuditEventSchema);
