export type AnnouncementAudience =
  | 'all'
  | 'staff'
  | 'students'
  | 'guardians';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface AnnouncementContext {
  organizationId: string;
  userId: string;
  campusIds: string[];
  role: string;
}

export interface CreateAnnouncementInput {
  campusId?: string;
  title: string;
  content: string;
  targetAudience?: AnnouncementAudience;
  status?: AnnouncementStatus;
  publishDate?: string;
  isPinned?: boolean;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export interface AnnouncementQuery {
  status?: AnnouncementStatus;
  targetAudience?: AnnouncementAudience;
  campusId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AnnouncementRecord {
  id: string;
  organizationId: string;
  campusId?: string;
  title: string;
  content: string;
  targetAudience: AnnouncementAudience;
  status: AnnouncementStatus;
  publishDate: string;
  authorId: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementRepository {
  listAnnouncements(
    organizationId: string,
    query: AnnouncementQuery,
    campusIds?: string[],
  ): Promise<AnnouncementRecord[]>;
  getAnnouncement(
    organizationId: string,
    announcementId: string,
  ): Promise<AnnouncementRecord | null>;
  createAnnouncement(
    organizationId: string,
    authorId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementRecord>;
  updateAnnouncement(
    organizationId: string,
    announcementId: string,
    input: UpdateAnnouncementInput,
  ): Promise<AnnouncementRecord | null>;
  deleteAnnouncement(
    organizationId: string,
    announcementId: string,
  ): Promise<boolean>;
}
