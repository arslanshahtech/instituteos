import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFamilyContact,
  getFamilyContact,
  linkFamilyContact,
  listFamilyContacts,
  listStudentFamilyContacts,
  unlinkFamilyContact,
  updateFamilyContact,
} from './family-contacts-api.js';
import type {
  FamilyContactInput,
  FamilyContactRelationship,
} from './family-contacts-api.js';

export const familyContactsQueryKey = (organizationId: string) =>
  ['family-contacts', organizationId] as const;

export const studentFamilyContactsQueryKey = (
  organizationId: string,
  studentId: string,
) => ['student-family-contacts', organizationId, studentId] as const;

export function useFamilyContacts(
  organizationId: string,
  input: { search: string; page: number; pageSize: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...familyContactsQueryKey(organizationId), input],
    queryFn: () => listFamilyContacts(organizationId, input),
    enabled,
  });
}

export function useFamilyContact(
  organizationId: string,
  guardianId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...familyContactsQueryKey(organizationId), guardianId],
    queryFn: () => getFamilyContact(organizationId, guardianId),
    enabled,
  });
}

export function useStudentFamilyContacts(
  organizationId: string,
  studentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: studentFamilyContactsQueryKey(organizationId, studentId),
    queryFn: () => listStudentFamilyContacts(organizationId, studentId),
    enabled,
  });
}

function invalidateFamilyContactViews(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  studentId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: familyContactsQueryKey(organizationId),
  });
  if (studentId) {
    void queryClient.invalidateQueries({
      queryKey: studentFamilyContactsQueryKey(organizationId, studentId),
    });
  }
}

export function useCreateFamilyContact(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FamilyContactInput & { studentId?: string }) =>
      createFamilyContact(organizationId, input),
    onSuccess: (_result, input) =>
      invalidateFamilyContactViews(
        queryClient,
        organizationId,
        input.studentId,
      ),
  });
}

export function useUpdateFamilyContact(
  organizationId: string,
  guardianId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FamilyContactInput) =>
      updateFamilyContact(organizationId, guardianId, input),
    onSuccess: () => invalidateFamilyContactViews(queryClient, organizationId),
  });
}

export function useLinkFamilyContact(
  organizationId: string,
  studentId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      guardianId: string;
      relationship: FamilyContactRelationship;
      isPrimary: boolean;
    }) =>
      linkFamilyContact(organizationId, studentId, input.guardianId, {
        relationship: input.relationship,
        isPrimary: input.isPrimary,
      }),
    onSuccess: () =>
      invalidateFamilyContactViews(queryClient, organizationId, studentId),
  });
}

export function useUnlinkFamilyContact(
  organizationId: string,
  studentId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guardianId: string) =>
      unlinkFamilyContact(organizationId, studentId, guardianId),
    onSuccess: () =>
      invalidateFamilyContactViews(queryClient, organizationId, studentId),
  });
}
