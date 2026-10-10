import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createGuardian,
  getGuardian,
  linkGuardian,
  listGuardians,
  listStudentGuardians,
  unlinkGuardian,
  updateGuardian,
} from './guardians-api.js';
import type { GuardianInput, GuardianRelationship } from './guardians-api.js';

export const guardiansQueryKey = (organizationId: string) =>
  ['guardians', organizationId] as const;

export const studentGuardiansQueryKey = (
  organizationId: string,
  studentId: string,
) => ['student-guardians', organizationId, studentId] as const;

export function useGuardians(
  organizationId: string,
  input: { search: string; page: number; pageSize: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...guardiansQueryKey(organizationId), input],
    queryFn: () => listGuardians(organizationId, input),
    enabled,
  });
}

export function useGuardian(
  organizationId: string,
  guardianId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...guardiansQueryKey(organizationId), guardianId],
    queryFn: () => getGuardian(organizationId, guardianId),
    enabled,
  });
}

export function useStudentGuardians(
  organizationId: string,
  studentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: studentGuardiansQueryKey(organizationId, studentId),
    queryFn: () => listStudentGuardians(organizationId, studentId),
    enabled,
  });
}

function invalidateGuardianViews(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  studentId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: guardiansQueryKey(organizationId),
  });
  if (studentId) {
    void queryClient.invalidateQueries({
      queryKey: studentGuardiansQueryKey(organizationId, studentId),
    });
  }
}

export function useCreateGuardian(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GuardianInput & { studentId?: string }) =>
      createGuardian(organizationId, input),
    onSuccess: (_result, input) =>
      invalidateGuardianViews(queryClient, organizationId, input.studentId),
  });
}

export function useUpdateGuardian(organizationId: string, guardianId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GuardianInput) =>
      updateGuardian(organizationId, guardianId, input),
    onSuccess: () => invalidateGuardianViews(queryClient, organizationId),
  });
}

export function useLinkGuardian(organizationId: string, studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      guardianId: string;
      relationship: GuardianRelationship;
      isPrimary: boolean;
    }) =>
      linkGuardian(organizationId, studentId, input.guardianId, {
        relationship: input.relationship,
        isPrimary: input.isPrimary,
      }),
    onSuccess: () =>
      invalidateGuardianViews(queryClient, organizationId, studentId),
  });
}

export function useUnlinkGuardian(organizationId: string, studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guardianId: string) =>
      unlinkGuardian(organizationId, studentId, guardianId),
    onSuccess: () =>
      invalidateGuardianViews(queryClient, organizationId, studentId),
  });
}
