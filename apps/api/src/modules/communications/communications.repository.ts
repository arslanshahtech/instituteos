import { Types } from 'mongoose';
import { AnnouncementModel } from './communications.model.js';
import type {
  AnnouncementQuery,
  AnnouncementRecord,
  AnnouncementRepository,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
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
