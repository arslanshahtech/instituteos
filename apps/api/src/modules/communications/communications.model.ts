import mongoose, { Schema } from 'mongoose';
import type {
  AnnouncementAudience,
  AnnouncementStatus,
  MessageSenderRole,
  ThreadStatus,
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

// ==========================================
// Phase D: Thread Schema & Model
// ==========================================

const conversationThreadSchema = new Schema(
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
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    teacherUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    guardianUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subjectTitle: {
      type: String,
      required: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'archived'] satisfies ThreadStatus[],
      default: 'active',
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

// Indexes for parent and teacher inbox lookups
conversationThreadSchema.index({
  organizationId: 1,
  guardianUserId: 1,
  lastMessageAt: -1,
});

conversationThreadSchema.index({
  organizationId: 1,
  teacherUserId: 1,
  lastMessageAt: -1,
});

export const ConversationThreadModel =
  mongoose.models.ConversationThread ??
  mongoose.model('ConversationThread', conversationThreadSchema);

// ==========================================
// Phase D: Direct Message Schema & Model
// ==========================================

const directMessageSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    threadId: {
      type: Schema.Types.ObjectId,
      ref: 'ConversationThread',
      required: true,
      index: true,
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['parent_guardian', 'teacher', 'admin'] satisfies MessageSenderRole[],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

// Index for chronological chat message rendering
directMessageSchema.index({
  organizationId: 1,
  threadId: 1,
  createdAt: 1,
});

export const DirectMessageModel =
  mongoose.models.DirectMessage ??
  mongoose.model('DirectMessage', directMessageSchema);