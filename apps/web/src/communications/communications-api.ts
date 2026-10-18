import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';

export type AnnouncementAudience = 'all' | 'staff' | 'students' | 'guardians';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface Announcement {
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

export interface AnnouncementInput {
  title: string;
  content: string;
  targetAudience: AnnouncementAudience;
  campusId?: string;
  status: 'draft' | 'published';
  isPinned: boolean;
}

export interface AnnouncementFilters {
  targetAudience?: AnnouncementAudience;
  status?: AnnouncementStatus;
  campusId?: string;
}

const communicationsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/announcements`;

export function listAnnouncements(
  organizationId: string,
  filters: AnnouncementFilters = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
  return apiRequest<{ items: Announcement[] }>(
    `${communicationsPath(organizationId)}${query.size ? `?${query}` : ''}`,
  );
}

export function createAnnouncement(
  organizationId: string,
  input: AnnouncementInput,
) {
  return apiRequest<{ announcement: Announcement }>(
    communicationsPath(organizationId),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateAnnouncement(
  organizationId: string,
  announcementId: string,
  input: AnnouncementInput,
) {
  return apiRequest<{ announcement: Announcement }>(
    `${communicationsPath(organizationId)}/${encodeURIComponent(announcementId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteAnnouncement(
  organizationId: string,
  announcementId: string,
) {
  return apiRequest<void>(
    `${communicationsPath(organizationId)}/${encodeURIComponent(announcementId)}`,
    { method: 'DELETE' },
  );
}

export const communicationsQueryKey = (organizationId: string) =>
  ['communications', organizationId] as const;

export function useAnnouncements(
  organizationId: string,
  enabled: boolean,
  filters: AnnouncementFilters,
) {
  return useQuery({
    queryKey: [...communicationsQueryKey(organizationId), filters],
    queryFn: () => listAnnouncements(organizationId, filters),
    enabled,
    retry: false,
  });
}

function useInvalidateAnnouncements(organizationId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: communicationsQueryKey(organizationId),
    });
}

export function useCreateAnnouncement(organizationId: string) {
  const invalidate = useInvalidateAnnouncements(organizationId);
  return useMutation({
    mutationFn: (input: AnnouncementInput) =>
      createAnnouncement(organizationId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateAnnouncement(organizationId: string) {
  const invalidate = useInvalidateAnnouncements(organizationId);
  return useMutation({
    mutationFn: (input: { id: string; data: AnnouncementInput }) =>
      updateAnnouncement(organizationId, input.id, input.data),
    onSuccess: invalidate,
  });
}

export function useDeleteAnnouncement(organizationId: string) {
  const invalidate = useInvalidateAnnouncements(organizationId);
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(organizationId, id),
    onSuccess: invalidate,
  });
}

// ==========================================
// Phase D: Direct Messaging Types & Hooks
// ==========================================

export type ThreadStatus = 'active' | 'closed' | 'archived';
export type MessageSenderRole = 'parent_guardian' | 'teacher' | 'admin';

export interface ConversationThread {
  id: string;
  organizationId: string;
  campusId?: string;
  studentId: string;
  teacherUserId: string;
  guardianUserId: string;
  subjectTitle: string;
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

export interface StartConversationInput {
  studentId: string;
  teacherUserId: string;
  subjectTitle: string;
  initialMessage: string;
}

export interface ParentMessagingContact {
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string;
  teachers: Array<{ userId: string; displayName: string }>;
}

const messagingThreadsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/communications/threads`;

const messagingContactsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/communications/contacts`;

export function listParentMessagingContacts(organizationId: string) {
  return apiRequest<{ items: ParentMessagingContact[] }>(
    messagingContactsPath(organizationId),
  );
}

export function listThreads(organizationId: string) {
  return apiRequest<{ items: ConversationThread[] }>(
    messagingThreadsPath(organizationId),
  );
}

export function getThreadMessages(organizationId: string, threadId: string) {
  return apiRequest<{ thread: ConversationThread; messages: DirectMessage[] }>(
    `${messagingThreadsPath(organizationId)}/${encodeURIComponent(threadId)}`,
  );
}

export function startConversation(
  organizationId: string,
  input: StartConversationInput,
) {
  return apiRequest<{ thread: ConversationThread; message: DirectMessage }>(
    messagingThreadsPath(organizationId),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function sendReply(
  organizationId: string,
  threadId: string,
  content: string,
) {
  return apiRequest<{ message: DirectMessage }>(
    `${messagingThreadsPath(organizationId)}/${encodeURIComponent(threadId)}/messages`,
    { method: 'POST', body: JSON.stringify({ content }) },
  );
}

export const messagingQueryKey = (organizationId: string) =>
  ['messaging-threads', organizationId] as const;

export const threadDetailQueryKey = (
  organizationId: string,
  threadId: string,
) => ['messaging-thread', organizationId, threadId] as const;

export const messagingContactsQueryKey = (organizationId: string) =>
  ['messaging-contacts', organizationId] as const;

export function useMessagingContacts(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: messagingContactsQueryKey(organizationId),
    queryFn: () => listParentMessagingContacts(organizationId),
    enabled: Boolean(organizationId) && enabled,
    retry: false,
  });
}

export function useThreads(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: messagingQueryKey(organizationId),
    queryFn: () => listThreads(organizationId),
    enabled: Boolean(organizationId) && enabled,
    retry: false,
  });
}

export function useThreadDetail(
  organizationId: string,
  threadId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: threadDetailQueryKey(organizationId, threadId ?? ''),
    queryFn: () => getThreadMessages(organizationId, threadId as string),
    enabled: Boolean(organizationId && threadId) && enabled,
    retry: false,
  });
}

export function useStartConversation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartConversationInput) =>
      startConversation(organizationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messagingQueryKey(organizationId),
      });
    },
  });
}

export function useSendReply(organizationId: string, threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      sendReply(organizationId, threadId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: threadDetailQueryKey(organizationId, threadId),
      });
      queryClient.invalidateQueries({
        queryKey: messagingQueryKey(organizationId),
      });
    },
  });
}
