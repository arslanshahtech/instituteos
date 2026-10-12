import mongoose, { Schema } from 'mongoose';

const brandingSchema = new Schema(
  {
    logoUrl: { type: String, trim: true },
    primaryColor: { type: String, default: '#0f766e', trim: true },
    tagLine: { type: String, maxlength: 160, trim: true },
  },
  { _id: false },
);

const contactSchema = new Schema(
  {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    website: { type: String, trim: true },
  },
  { _id: false },
);

const localizationSchema = new Schema(
  {
    timezone: { type: String, default: 'Asia/Karachi', trim: true },
    currency: { type: String, default: 'PKR', trim: true },
    dateFormat: { type: String, default: 'YYYY-MM-DD', trim: true },
  },
  { _id: false },
);

const notificationsSchema = new Schema(
  {
    emailAlerts: { type: Boolean, default: true },
    smsAlerts: { type: Boolean, default: false },
    autoAttendanceAlerts: { type: Boolean, default: false },
  },
  { _id: false },
);

export const organizationSettingsSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    branding: { type: brandingSchema, default: () => ({}) },
    contact: { type: contactSchema, default: () => ({}) },
    localization: { type: localizationSchema, default: () => ({}) },
    notifications: { type: notificationsSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false },
);

export const OrganizationSettingsModel =
  mongoose.models.OrganizationSettings ??
  mongoose.model('OrganizationSettings', organizationSettingsSchema);
