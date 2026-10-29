import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessagingService,
  type VerificationAdapters,
} from './communications.service.js';
import type {
  MessagingRepository,
  ConversationThread,
  DirectMessage,
} from './communications.types.js';

describe('MessagingService (Parent-Teacher Scoped Messaging)', () => {
  let mockRepo: Partial<MessagingRepository>;
  let mockVerifier: VerificationAdapters;
  let service: MessagingService;

  const validOrgId = '650000000000000000000001';
  const guardianId = '650000000000000000000010';
  const studentId = '650000000000000000000020';
  const teacherId = '650000000000000000000030';
  const threadId = '650000000000000000000040';

  const mockThread: ConversationThread = {
    id: threadId,
    organizationId: validOrgId,
    studentId,
    teacherUserId: teacherId,
    guardianUserId: guardianId,
    subjectTitle: 'Math Progress Query',
    status: 'active',
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockMessage: DirectMessage = {
    id: '650000000000000000000050',
    organizationId: validOrgId,
    threadId,
    senderUserId: guardianId,
    senderRole: 'parent_guardian',
    content: 'Hello teacher, I wanted to discuss the homework.',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockRepo = {
      createThread: vi.fn(),
      findThreadById: vi.fn(),
      listThreadsForUser: vi.fn(),
      addMessage: vi.fn(),
      listMessages: vi.fn(),
      markMessagesRead: vi.fn(),
    };

    mockVerifier = {
      isGuardianLinkedToStudent: vi.fn(),
      isTeacherAssignedToStudent: vi.fn(),
    };

    service = new MessagingService(
      mockRepo as MessagingRepository,
      mockVerifier,
    );
  });

  it('successfully starts a conversation when guardian and teacher links are verified', async () => {
    vi.mocked(mockVerifier.isGuardianLinkedToStudent).mockResolvedValue(true);
    vi.mocked(mockVerifier.isTeacherAssignedToStudent).mockResolvedValue(true);
    vi.mocked(mockRepo.createThread!).mockResolvedValue(mockThread);
    vi.mocked(mockRepo.addMessage!).mockResolvedValue(mockMessage);

    const result = await service.startConversation(validOrgId, guardianId, {
      studentId,
      teacherUserId: teacherId,
      subjectTitle: 'Math Progress Query',
      initialMessage: 'Hello teacher, I wanted to discuss the homework.',
    });

    expect(result.thread.id).toBe(threadId);
    expect(result.message.content).toBe(
      'Hello teacher, I wanted to discuss the homework.',
    );
    expect(mockRepo.createThread).toHaveBeenCalledTimes(1);
    expect(mockRepo.addMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects conversation creation if guardian is not linked to student (Anti-BOLA)', async () => {
    vi.mocked(mockVerifier.isGuardianLinkedToStudent).mockResolvedValue(false);

    await expect(
      service.startConversation(validOrgId, guardianId, {
        studentId,
        teacherUserId: teacherId,
        subjectTitle: 'Math Progress Query',
        initialMessage: 'Hello teacher',
      }),
    ).rejects.toThrow(
      'You can only initiate conversations regarding your linked children.',
    );

    expect(mockRepo.createThread).not.toHaveBeenCalled();
  });

  it('rejects conversation creation if teacher does not teach this student (Anti-BOLA)', async () => {
    vi.mocked(mockVerifier.isGuardianLinkedToStudent).mockResolvedValue(true);
    vi.mocked(mockVerifier.isTeacherAssignedToStudent).mockResolvedValue(false);

    await expect(
      service.startConversation(validOrgId, guardianId, {
        studentId,
        teacherUserId: teacherId,
        subjectTitle: 'Math Progress Query',
        initialMessage: 'Hello teacher',
      }),
    ).rejects.toThrow('Selected teacher is not assigned to this student.');

    expect(mockRepo.createThread).not.toHaveBeenCalled();
  });

  it('prevents non-participants from viewing thread messages', async () => {
    const unassociatedUserId = '650000000000000000000099';
    vi.mocked(mockRepo.findThreadById!).mockResolvedValue(mockThread);

    await expect(
      service.getThreadMessages(
        validOrgId,
        unassociatedUserId,
        'teacher',
        threadId,
      ),
    ).rejects.toThrow('Access to this conversation is denied.');

    expect(mockRepo.listMessages).not.toHaveBeenCalled();
  });

  it('allows verified participant to send replies', async () => {
    vi.mocked(mockRepo.findThreadById!).mockResolvedValue(mockThread);
    vi.mocked(mockRepo.addMessage!).mockResolvedValue({
      ...mockMessage,
      senderUserId: teacherId,
      senderRole: 'teacher',
      content: 'Understood, we can meet tomorrow.',
    });

    const reply = await service.replyToThread(
      validOrgId,
      teacherId,
      'teacher',
      threadId,
      { content: 'Understood, we can meet tomorrow.' },
    );

    expect(reply.content).toBe('Understood, we can meet tomorrow.');
    expect(mockRepo.addMessage).toHaveBeenCalledWith(
      validOrgId,
      threadId,
      teacherId,
      'teacher',
      'Understood, we can meet tomorrow.',
    );
  });
});
