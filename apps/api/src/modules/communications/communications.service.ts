import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  AnnouncementContext,
  AnnouncementQuery,
  AnnouncementRecord,
  AnnouncementRepository,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  ConversationThread,
  DirectMessage,
  CreateThreadInput,
  SendMessageInput,
  MessageSenderRole,
  MessagingRepository,
} from './communications.types.js';

const audiences = ['all', 'staff', 'students', 'guardians'] as const;
const statuses = ['draft', 'published', 'archived'] as const;

function objectId(value: string, field: string): string {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return value.toLowerCase();
}

function validateDate(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    Number.isNaN(new Date(value).getTime()) ||
    !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  const parsedDay = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (parsedDay.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.slice(0, 10);
}

function validatePublishDate(value: string): string {
  validateDate(value, 'publish date');
  return new Date(value).toISOString();
}

function campusRestricted(context: AnnouncementContext): boolean {
  return context.role === 'campus_admin' || context.campusIds.length > 0;
}

function assertCampus(context: AnnouncementContext, campusId: string): void {
  if (campusRestricted(context) && !context.campusIds.includes(campusId)) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
  }
}

function validateCreateInput(
  context: AnnouncementContext,
  input: CreateAnnouncementInput,
): CreateAnnouncementInput {
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    input.title.trim().length > 160
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid title.');
  }
  if (
    typeof input.content !== 'string' ||
    !input.content.trim() ||
    input.content.trim().length > 5000
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter valid announcement content.',
    );
  }
  if (
    input.targetAudience !== undefined &&
    !audiences.includes(input.targetAudience)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid target audience.',
    );
  }
  if (input.status !== undefined && !statuses.includes(input.status)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid announcement status.',
    );
  }
  if (input.isPinned !== undefined && typeof input.isPinned !== 'boolean') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid pinned value.');
  }
  if (campusRestricted(context) && !input.campusId) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'Select an announcement campus you are authorized to manage.',
    );
  }
  const campusId = input.campusId
    ? objectId(input.campusId, 'campus')
    : undefined;
  if (campusId) assertCampus(context, campusId);
  return {
    ...input,
    ...(campusId ? { campusId } : {}),
    title: input.title.trim(),
    content: input.content.trim(),
    ...(input.publishDate
      ? { publishDate: validatePublishDate(input.publishDate) }
      : {}),
  };
}

function validateUpdateInput(
  context: AnnouncementContext,
  input: UpdateAnnouncementInput,
): UpdateAnnouncementInput {
  const output: UpdateAnnouncementInput = {};
  if (input.title !== undefined) {
    if (
      typeof input.title !== 'string' ||
      !input.title.trim() ||
      input.title.trim().length > 160
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid title.');
    }
    output.title = input.title.trim();
  }
  if (input.content !== undefined) {
    if (
      typeof input.content !== 'string' ||
      !input.content.trim() ||
      input.content.trim().length > 5000
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter valid announcement content.',
      );
    }
    output.content = input.content.trim();
  }
  if (input.targetAudience !== undefined) {
    if (!audiences.includes(input.targetAudience)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid target audience.',
      );
    }
    output.targetAudience = input.targetAudience;
  }
  if (input.status !== undefined) {
    if (!statuses.includes(input.status)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid announcement status.',
      );
    }
    output.status = input.status;
  }
  if (input.isPinned !== undefined) {
    if (typeof input.isPinned !== 'boolean') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid pinned value.',
      );
    }
    output.isPinned = input.isPinned;
  }
  if (input.publishDate !== undefined) {
    output.publishDate = validatePublishDate(input.publishDate);
  }
  if (input.campusId !== undefined) {
    const campusId = objectId(input.campusId, 'campus');
    assertCampus(context, campusId);
    output.campusId = campusId;
  }
  if (Object.keys(output).length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Provide at least one announcement field to update.',
    );
  }
  return output;
}

function assertRecordCampus(
  context: AnnouncementContext,
  record: AnnouncementRecord | null,
): asserts record is AnnouncementRecord {
  if (!record) {
    throw new AppError(
      404,
      'ANNOUNCEMENT_NOT_FOUND',
      'Announcement not found.',
    );
  }
  if (record.campusId) assertCampus(context, record.campusId);
}

function validatedQuery(
  context: AnnouncementContext,
  query: AnnouncementQuery,
): { query: AnnouncementQuery; campusIds?: string[] } {
  if (query.status !== undefined && !statuses.includes(query.status)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid announcement status.',
    );
  }
  if (
    query.targetAudience !== undefined &&
    !audiences.includes(query.targetAudience)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid target audience.',
    );
  }
  const campusId = query.campusId
    ? objectId(query.campusId, 'campus')
    : undefined;
  if (campusId) assertCampus(context, campusId);
  const dateFrom = query.dateFrom
    ? validateDate(query.dateFrom, 'start date')
    : undefined;
  const dateTo = query.dateTo
    ? validateDate(query.dateTo, 'end date')
    : undefined;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Start date must not be after end date.',
    );
  }
  const normalized = {
    ...query,
    ...(campusId ? { campusId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };
  return campusRestricted(context)
    ? { query: normalized, campusIds: context.campusIds }
    : { query: normalized };
}

export class CommunicationsService {
  constructor(private readonly repository: AnnouncementRepository) {}

  listAnnouncements(
    context: AnnouncementContext,
    query: AnnouncementQuery = {},
  ) {
    const normalized = validatedQuery(context, query);
    return this.repository.listAnnouncements(
      context.organizationId,
      normalized.query,
      normalized.campusIds,
    );
  }

  async getAnnouncement(context: AnnouncementContext, announcementId: string) {
    const id = objectId(announcementId, 'announcement');
    const announcement = await this.repository.getAnnouncement(
      context.organizationId,
      id,
    );
    assertRecordCampus(context, announcement);
    return announcement;
  }

  async createAnnouncement(
    context: AnnouncementContext,
    input: CreateAnnouncementInput,
  ) {
    const normalized = validateCreateInput(context, input);
    return this.repository.createAnnouncement(
      context.organizationId,
      objectId(context.userId, 'author'),
      normalized,
    );
  }

  async updateAnnouncement(
    context: AnnouncementContext,
    announcementId: string,
    input: UpdateAnnouncementInput,
  ) {
    const id = objectId(announcementId, 'announcement');
    const current = await this.repository.getAnnouncement(
      context.organizationId,
      id,
    );
    assertRecordCampus(context, current);
    const normalized = validateUpdateInput(context, input);
    const updated = await this.repository.updateAnnouncement(
      context.organizationId,
      id,
      normalized,
    );
    if (!updated) {
      throw new AppError(
        404,
        'ANNOUNCEMENT_NOT_FOUND',
        'Announcement not found.',
      );
    }
    assertRecordCampus(context, updated);
    return updated;
  }

  async deleteAnnouncement(
    context: AnnouncementContext,
    announcementId: string,
  ) {
    const id = objectId(announcementId, 'announcement');
    const current = await this.repository.getAnnouncement(
      context.organizationId,
      id,
    );
    assertRecordCampus(context, current);
    if (
      !(await this.repository.deleteAnnouncement(context.organizationId, id))
    ) {
      throw new AppError(
        404,
        'ANNOUNCEMENT_NOT_FOUND',
        'Announcement not found.',
      );
    }
  }
}

// ==========================================
// Phase D: Messaging Verification Service
// ==========================================

export interface VerificationAdapters {
  isGuardianLinkedToStudent: (
    organizationId: string,
    guardianUserId: string,
    studentId: string,
  ) => Promise<boolean>;
  isTeacherAssignedToStudent: (
    organizationId: string,
    teacherUserId: string,
    studentId: string,
  ) => Promise<boolean>;
}

export class MessagingService {
  constructor(
    private readonly repository: MessagingRepository,
    private readonly verifier: VerificationAdapters,
  ) {}

  async startConversation(
    organizationId: string,
    guardianUserId: string,
    input: CreateThreadInput,
    campusId?: string,
  ): Promise<{ thread: ConversationThread; message: DirectMessage }> {
    const studentId = objectId(input.studentId, 'student');
    const teacherUserId = objectId(input.teacherUserId, 'teacher');

    if (!input.subjectTitle?.trim() || input.subjectTitle.trim().length > 120) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter a valid conversation subject.',
      );
    }
    if (
      !input.initialMessage?.trim() ||
      input.initialMessage.trim().length > 2000
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid message.');
    }

    // 1. Anti-BOLA check: Verify guardian is linked to this student
    const isGuardianLinked = await this.verifier.isGuardianLinkedToStudent(
      organizationId,
      guardianUserId,
      studentId,
    );
    if (!isGuardianLinked) {
      throw new AppError(
        403,
        'GUARDIAN_NOT_LINKED',
        'You can only initiate conversations regarding your linked children.',
      );
    }

    // 2. Anti-BOLA check: Verify teacher teaches this student's class/section
    const isTeacherAssigned = await this.verifier.isTeacherAssignedToStudent(
      organizationId,
      teacherUserId,
      studentId,
    );
    if (!isTeacherAssigned) {
      throw new AppError(
        403,
        'TEACHER_NOT_ASSIGNED',
        'Selected teacher is not assigned to this student.',
      );
    }

    // 3. Create conversation thread
    const thread = await this.repository.createThread(
      organizationId,
      guardianUserId,
      {
        studentId,
        teacherUserId,
        subjectTitle: input.subjectTitle.trim(),
        initialMessage: input.initialMessage.trim(),
      },
      campusId,
    );

    // 4. Create initial direct message
    const message = await this.repository.addMessage(
      organizationId,
      thread.id,
      guardianUserId,
      'parent_guardian',
      input.initialMessage.trim(),
    );

    return { thread, message };
  }

  async listThreads(
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<ConversationThread[]> {
    return this.repository.listThreadsForUser(organizationId, userId, role);
  }

  async getThreadMessages(
    organizationId: string,
    userId: string,
    role: string,
    threadId: string,
  ): Promise<{ thread: ConversationThread; messages: DirectMessage[] }> {
    const thread = await this.repository.findThreadById(
      organizationId,
      threadId,
    );
    if (!thread) {
      throw new AppError(
        404,
        'THREAD_NOT_FOUND',
        'Conversation thread not found.',
      );
    }

    // Tenant and participation scoping check
    const isParticipant =
      thread.guardianUserId === userId ||
      thread.teacherUserId === userId ||
      [
        'organization_owner',
        'organization_admin',
        'principal_director',
      ].includes(role);

    if (!isParticipant) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Access to this conversation is denied.',
      );
    }

    const messages = await this.repository.listMessages(
      organizationId,
      threadId,
    );

    // Mark as read for this participant
    await this.repository.markMessagesRead(organizationId, threadId, userId);

    return { thread, messages };
  }

  async replyToThread(
    organizationId: string,
    userId: string,
    role: MessageSenderRole,
    threadId: string,
    input: SendMessageInput,
  ): Promise<DirectMessage> {
    if (!input.content?.trim() || input.content.trim().length > 2000) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid message.');
    }

    const thread = await this.repository.findThreadById(
      organizationId,
      threadId,
    );
    if (!thread) {
      throw new AppError(
        404,
        'THREAD_NOT_FOUND',
        'Conversation thread not found.',
      );
    }

    if (thread.status !== 'active') {
      throw new AppError(
        400,
        'THREAD_CLOSED',
        'This conversation thread is closed.',
      );
    }

    const isParticipant =
      thread.guardianUserId === userId ||
      thread.teacherUserId === userId ||
      ['organization_owner', 'organization_admin'].includes(role);

    if (!isParticipant) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You cannot send messages to this thread.',
      );
    }

    return this.repository.addMessage(
      organizationId,
      threadId,
      userId,
      role,
      input.content.trim(),
    );
  }
}
