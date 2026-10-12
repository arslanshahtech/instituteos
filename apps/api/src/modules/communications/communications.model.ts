import mongoose, { Schema } from 'mongoose';
import type {
  AnnouncementAudience,
  AnnouncementStatus,
} from './communications.types.js';

const announcementSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      index: true,
    },
    title: { type: String, required: true, maxlength: 160 },
    content: { type: String, required: true, maxlength: 5000 },
    targetAudience: {
      type: String,
      enum: ['all', 'staff', 'students', 'guardians'] satisfies AnnouncementAudience[],
      default: 'all',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'] satisfies AnnouncementStatus[],
      default: 'published',
      required: true,
    },
    publishDate: { type: Date, default: Date.now, required: true },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPinned: { type: Boolean, default: false, required: true },
  },
  { timestamps: true, versionKey: false },
);

announcementSchema.index({
  organizationId: 1,
  isPinned: -1,
  publishDate: -1,
});

export const AnnouncementModel =
  mongoose.models.Announcement ??
  mongoose.model('Announcement', announcementSchema);
