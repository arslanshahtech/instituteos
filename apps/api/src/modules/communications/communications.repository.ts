import { Types } from 'mongoose';
import {
  AnnouncementModel,
  ConversationThreadModel,
  DirectMessageModel,
} from './communications.model.js';
import type {
  AnnouncementQuery,
  AnnouncementRecord,
  AnnouncementRepository,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  ConversationThread,
  DirectMessage,
  CreateThreadInput,
  MessageSenderRole,
  MessagingRepository,
} from './communications.types.js';

const oid = (id: string) => new Types.ObjectId(id);
const iso = (value: Date) => new Date(value).toISOString();

function announcementRecord(
  record: Record<string, unknown>,
): AnnouncementRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    ...(record.campusId ? { campusId: String(record.campusId) } : {}),
    title: String(record.title),
    content: String(record.content),
    targetAudience: record.targetAudience as AnnouncementRecord['targetAudience'],
    status: record.status as AnnouncementRecord['status'],
    publishDate: iso(record.publishDate as Date),
    authorId: String(record.authorId),
    isPinned: Boolean(record.isPinned),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function threadRecord(record: Record<string, unknown>): ConversationThread {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    ...(record.campusId ? { campusId: String(record.campusId) } : {}),
    studentId: String(record.studentId),
    teacherUserId: String(record.teacherUserId),
    guardianUserId: String(record.guardianUserId),
    subjectTitle: String(record.subjectTitle),
    status: record.status as ConversationThread['status'],
    lastMessageAt: iso(record.lastMessageAt as Date),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function directMessageRecord(record: Record<string, unknown>): DirectMessage {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    threadId: String(record.threadId),
    senderUserId: String(record.senderUserId),
    senderRole: record.senderRole as DirectMessage['senderRole'],
    content: String(record.content),
    ...(record.readAt ? { readAt: iso(record.readAt as Date) } : {}),
    createdAt: iso(record.createdAt as Date),
  };
}

function dateRange(query: AnnouncementQuery): Record<string, Date> | undefined {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    ...(query.dateFrom
      ? { $gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
      : {}),
    ...(query.dateTo
      ? {
          $lte: new Date(
            new Date(`${query.dateTo}T00:00:00.000Z`).getTime() +
              86_399_999,
          ),
        }
      : {}),
  };
}

export class MongoAnnouncementRepository implements AnnouncementRepository {
  async listAnnouncements(
    organizationId: string,
    query: AnnouncementQuery,
    campusIds?: string[],
  ): Promise<AnnouncementRecord[]> {
    const publishDate = dateRange(query);
    const filter: Record<string, unknown> = {
      organizationId: oid(organizationId),
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetAudience ? { targetAudience: query.targetAudience } : {}),
      ...(query.campusId ? { campusId: oid(query.campusId) } : {}),
      ...(publishDate ? { publishDate } : {}),
    };
    if (campusIds !== undefined && query.campusId === undefined) {
      filter.$or = [
        { campusId: { $in: campusIds.map(oid) } },
        { campusId: { $exists: false } },
      ];
    }
    const records = await AnnouncementModel.find(filter)
      .sort({ isPinned: -1, publishDate: -1 })
      .lean();
    return records.map((record) =>
      announcementRecord(record as unknown as Record<string, unknown>),
    );
  }

  async getAnnouncement(
    organizationId: string,
    announcementId: string,
  ): Promise<AnnouncementRecord | null> {
    const record = await AnnouncementModel.findOne({
      _id: oid(announcementId),
      organizationId: oid(organizationId),
    }).lean();
    return record
      ? announcementRecord(record as unknown as Record<string, unknown>)
      : null;
  }

  async createAnnouncement(
    organizationId: string,
    authorId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementRecord> {
    const record = await AnnouncementModel.create({
      organizationId: oid(organizationId),
      authorId: oid(authorId),
      ...input,
      ...(input.campusId ? { campusId: oid(input.campusId) } : {}),
      ...(input.publishDate ? { publishDate: new Date(input.publishDate) } : {}),
    });
    return announcementRecord(
      record.toObject() as unknown as Record<string, unknown>,
    );
  }

  async updateAnnouncement(
    organizationId: string,
    announcementId: string,
    input: UpdateAnnouncementInput,
  ): Promise<AnnouncementRecord | null> {
    const changes = {
      ...input,
      ...(input.campusId ? { campusId: oid(input.campusId) } : {}),
      ...(input.publishDate ? { publishDate: new Date(input.publishDate) } : {}),
    };
    const record = await AnnouncementModel.findOneAndUpdate(
      { _id: oid(announcementId), organizationId: oid(organizationId) },
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();
    return record
      ? announcementRecord(record as unknown as Record<string, unknown>)
      : null;
  }

  async deleteAnnouncement(
    organizationId: string,
    announcementId: string,
  ): Promise<boolean> {
    const result = await AnnouncementModel.deleteOne({
      _id: oid(announcementId),
      organizationId: oid(organizationId),
    });
    return result.deletedCount > 0;
  }
}

// ==========================================
// Phase D: Mongo Messaging Repository
// ==========================================

export class MongoMessagingRepository implements MessagingRepository {
  async createThread(
    organizationId: string,
    guardianUserId: string,
    input: CreateThreadInput,
    campusId?: string,
  ): Promise<ConversationThread> {
    const doc = await ConversationThreadModel.create({
      organizationId: oid(organizationId),
      ...(campusId ? { campusId: oid(campusId) } : {}),
      studentId: oid(input.studentId),
      teacherUserId: oid(input.teacherUserId),
      guardianUserId: oid(guardianUserId),
      subjectTitle: input.subjectTitle,
      status: 'active',
      lastMessageAt: new Date(),
    });
    return threadRecord(doc.toObject() as unknown as Record<string, unknown>);
  }

  async findThreadById(
    organizationId: string,
    threadId: string,
  ): Promise<ConversationThread | null> {
    const doc = await ConversationThreadModel.findOne({
      _id: oid(threadId),
      organizationId: oid(organizationId),
    }).lean();
    return doc ? threadRecord(doc as unknown as Record<string, unknown>) : null;
  }

  async listThreadsForUser(
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<ConversationThread[]> {
    const query: Record<string, unknown> = {
      organizationId: oid(organizationId),
    };

    if (role === 'teacher') {
      query.teacherUserId = oid(userId);
    } else if (role === 'parent_guardian') {
      query.guardianUserId = oid(userId);
    }

    const docs = await ConversationThreadModel.find(query)
      .sort({ lastMessageAt: -1 })
      .lean();

    return docs.map((d) => threadRecord(d as unknown as Record<string, unknown>));
  }

  async addMessage(
    organizationId: string,
    threadId: string,
    senderUserId: string,
    senderRole: MessageSenderRole,
    content: string,
  ): Promise<DirectMessage> {
    const now = new Date();
    const doc = await DirectMessageModel.create({
      organizationId: oid(organizationId),
      threadId: oid(threadId),
      senderUserId: oid(senderUserId),
      senderRole,
      content,
    });

    await ConversationThreadModel.updateOne(
      { _id: oid(threadId), organizationId: oid(organizationId) },
      { $set: { lastMessageAt: now, updatedAt: now } },
    );

    return directMessageRecord(doc.toObject() as unknown as Record<string, unknown>);
  }

  async listMessages(
    organizationId: string,
    threadId: string,
    limit = 50,
  ): Promise<DirectMessage[]> {
    const docs = await DirectMessageModel.find({
      organizationId: oid(organizationId),
      threadId: oid(threadId),
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return docs.map((d) => directMessageRecord(d as unknown as Record<string, unknown>));
  }

  async markMessagesRead(
    organizationId: string,
    threadId: string,
    readerUserId: string,
  ): Promise<void> {
    await DirectMessageModel.updateMany(
      {
        organizationId: oid(organizationId),
        threadId: oid(threadId),
        senderUserId: { $ne: oid(readerUserId) },
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
    );
  }
}