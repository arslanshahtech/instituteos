import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';

export type AnnouncementAudience =
  | 'all'
  | 'staff'
  | 'students'
  | 'guardians';
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
    Object.entries(filters).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
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
