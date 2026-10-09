import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStudent,
  getStudent,
  listStudents,
  updateStudent,
} from './students-api.js';
import type { StudentInput, StudentStatus } from './students-api.js';

export const studentsQueryKey = (organizationId: string) =>
  ['students', organizationId] as const;

export function useStudents(
  organizationId: string,
  input: {
    search: string;
    status?: StudentStatus;
    page: number;
    pageSize: number;
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...studentsQueryKey(organizationId), input],
    queryFn: () => listStudents(organizationId, input),
    enabled,
  });
}

export function useStudent(
  organizationId: string,
  studentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...studentsQueryKey(organizationId), studentId],
    queryFn: () => getStudent(organizationId, studentId),
    enabled,
  });
}

export function useCreateStudent(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) => createStudent(organizationId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: studentsQueryKey(organizationId),
      }),
  });
}

export function useUpdateStudent(organizationId: string, studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) =>
      updateStudent(organizationId, studentId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: studentsQueryKey(organizationId),
      });
      await queryClient.invalidateQueries({
        queryKey: [...studentsQueryKey(organizationId), studentId],
      });
    },
  });
}
