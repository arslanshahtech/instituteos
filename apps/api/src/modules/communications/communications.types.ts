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

// ==========================================
// Phase D: Privacy-Preserving Messaging Types
// ==========================================

export type ThreadStatus = 'active' | 'closed' | 'archived';
export type MessageSenderRole = 'parent_guardian' | 'teacher' | 'admin';

export interface ConversationParticipant {
  userId: string;
  role: MessageSenderRole;
  displayName: string; // E.g., "Math Teacher (Grade 5)" to protect teacher's personal identity
}

export interface ConversationThread {
  id: string;
  organizationId: string;
  campusId?: string;
  studentId: string;
  teacherUserId: string;
  guardianUserId: string;
  subjectTitle: string; // e.g., "Mathematics Query"
  status: ThreadStatus;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  organizationId: string;
  threadId: string;
  senderUserId: string;
  senderRole: MessageSenderRole;
  content: string;
  readAt?: string;
  createdAt: string;
}

export interface CreateThreadInput {
  studentId: string;
  teacherUserId: string;
  subjectTitle: string;
  initialMessage: string;
}

export interface SendMessageInput {
  content: string;
}

export interface MessagingRepository {
  createThread(
    organizationId: string,
    guardianUserId: string,
    input: CreateThreadInput,
    campusId?: string,
  ): Promise<ConversationThread>;
  findThreadById(
    organizationId: string,
    threadId: string,
  ): Promise<ConversationThread | null>;
  listThreadsForUser(
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<ConversationThread[]>;
  addMessage(
    organizationId: string,
    threadId: string,
    senderUserId: string,
    senderRole: MessageSenderRole,
    content: string,
  ): Promise<DirectMessage>;
  listMessages(
    organizationId: string,
    threadId: string,
    limit?: number,
  ): Promise<DirectMessage[]>;
  markMessagesRead(
    organizationId: string,
    threadId: string,
    readerUserId: string,
  ): Promise<void>;
}