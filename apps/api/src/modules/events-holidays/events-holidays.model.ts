import mongoose, { Schema } from 'mongoose';

const eventHolidaySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['holiday', 'event'], required: true },
    noClasses: { type: Boolean, default: false, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    remarks: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AuthUser' },
  },
  { timestamps: true, versionKey: false },
);
eventHolidaySchema.index({ organizationId: 1, startDate: 1, endDate: 1 });

export const EventHolidayModel =
  mongoose.models.EventHoliday ??
  mongoose.model('EventHoliday', eventHolidaySchema);
