import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAcademicsResource,
  listAcademicCampuses,
  listAcademicClasses,
  listAcademicSections,
  listAcademicSubjects,
  listAcademicYears,
  listTeacherAssignments,
  listTerms,
  saveAcademicsResource,
} from './academics-api.js';
import type {
  AcademicsFormPayload,
  AcademicsResource,
} from './academics-api.js';

export const academicsQueryKey = (organizationId: string) =>
  ['academics', organizationId] as const;

export function useAcademicsWorkspace(
  organizationId: string,
  enabled: boolean,
) {
  const key = academicsQueryKey(organizationId);
  const queryOptions = { enabled, retry: false } as const;
  return {
    years: useQuery({
      queryKey: [...key, 'academic-years'],
      queryFn: () => listAcademicYears(organizationId),
      ...queryOptions,
    }),
    terms: useQuery({
      queryKey: [...key, 'terms'],
      queryFn: () => listTerms(organizationId),
      ...queryOptions,
    }),
    classes: useQuery({
      queryKey: [...key, 'classes'],
      queryFn: () => listAcademicClasses(organizationId),
      ...queryOptions,
    }),
    sections: useQuery({
      queryKey: [...key, 'sections'],
      queryFn: () => listAcademicSections(organizationId),
      ...queryOptions,
    }),
    subjects: useQuery({
      queryKey: [...key, 'subjects'],
      queryFn: () => listAcademicSubjects(organizationId),
      ...queryOptions,
    }),
    assignments: useQuery({
      queryKey: [...key, 'teacher-assignments'],
      queryFn: () => listTeacherAssignments(organizationId),
      ...queryOptions,
    }),
    campuses: useQuery({
      queryKey: [...key, 'campuses'],
      queryFn: () => listAcademicCampuses(organizationId),
      ...queryOptions,
    }),
  };
}

export function useSaveAcademicsResource(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      resource: AcademicsResource;
      id?: string;
      data: AcademicsFormPayload;
    }) =>
      saveAcademicsResource(
        organizationId,
        input.resource,
        input.id,
        input.data,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: academicsQueryKey(organizationId),
      }),
  });
}

export function useDeleteAcademicsResource(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { resource: AcademicsResource; id: string }) =>
      deleteAcademicsResource(organizationId, input.resource, input.id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: academicsQueryKey(organizationId),
      }),
  });
}
