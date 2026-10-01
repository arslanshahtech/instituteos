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
  },
  { timestamps: true, versionKey: false },
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
  },
  { timestamps: true, versionKey: false },
);

membershipSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true, name: 'uniq_membership_organization_user' },
);

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
