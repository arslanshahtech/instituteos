import mongoose, { Schema } from 'mongoose';

const attendanceSettingsSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: 'Asia/Karachi',
      maxlength: 80,
    },
    schoolStartTime: {
      type: String,
      required: true,
      default: '08:00',
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    gracePeriodMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
      max: 120,
    },
    markingCutoffTime: {
      type: String,
      required: true,
      default: '09:00',
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    autoMarkUnmarkedAbsent: { type: Boolean, required: true, default: false },
    allowAdminOverride: { type: Boolean, required: true, default: true },
    workingDays: {
      type: [String],
      enum: [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ],
      default: [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ],
    },
  },
  { timestamps: true, versionKey: false },
);

export const AttendanceSettingsModel =
  mongoose.models.AttendanceSettings ??
  mongoose.model('AttendanceSettings', attendanceSettingsSchema);

const attendanceJobLockSchema = new Schema(
  {
    _id: { type: String, required: true },
    ownerId: { type: String, required: true },
    leaseUntil: { type: Date, required: true },
  },
  { versionKey: false },
);

export const AttendanceJobLockModel =
  mongoose.models.AttendanceJobLock ??
  mongoose.model('AttendanceJobLock', attendanceJobLockSchema);
