import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStaff, getStaff, listStaff, updateStaff } from './staff-api.js';
import type { StaffInput, StaffStatus } from './staff-api.js';

export const staffQueryKey = (organizationId: string) =>
  ['staff', organizationId] as const;

export function useStaffList(
  organizationId: string,
  input: {
    search: string;
    department: string;
    status?: StaffStatus;
    campusId?: string;
    page: number;
    pageSize: number;
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...staffQueryKey(organizationId), input],
    queryFn: () => listStaff(organizationId, input),
    enabled,
  });
}

export function useStaff(
  organizationId: string,
  staffId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...staffQueryKey(organizationId), staffId],
    queryFn: () => getStaff(organizationId, staffId),
    enabled,
  });
}

export function useCreateStaff(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInput) => createStaff(organizationId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: staffQueryKey(organizationId),
      }),
  });
}

export function useUpdateStaff(organizationId: string, staffId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInput) =>
      updateStaff(organizationId, staffId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: staffQueryKey(organizationId),
      });
      await queryClient.invalidateQueries({
        queryKey: [...staffQueryKey(organizationId), staffId],
      });
    },
  });
}
