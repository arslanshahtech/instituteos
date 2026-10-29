import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteExam,
  deleteExamSchedule,
  deleteGradingScale,
  getExamMarkSheet,
  getStudentExamReport,
  listExamSchedules,
  listExams,
  listGradingScales,
  saveExam,
  setExamResultsPublication,
  saveExamMarks,
  saveExamSchedule,
  saveGradingScale,
} from './examinations-api.js';

export const examinationsQueryKey = (organizationId: string) =>
  ['examinations', organizationId] as const;

export function useExaminationWorkspace(
  organizationId: string,
  enabled: boolean,
) {
  const key = examinationsQueryKey(organizationId);
  return {
    exams: useQuery({
      queryKey: [...key, 'exams'],
      queryFn: () => listExams(organizationId),
      enabled,
      retry: false,
    }),
    scales: useQuery({
      queryKey: [...key, 'grading-scales'],
      queryFn: () => listGradingScales(organizationId),
      enabled,
      retry: false,
    }),
  };
}

export function useExamSchedules(
  organizationId: string,
  examId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...examinationsQueryKey(organizationId), 'schedules', examId],
    queryFn: () => listExamSchedules(organizationId, examId),
    enabled: enabled && Boolean(examId),
    retry: false,
  });
}

export function useExamMarkSheet(
  organizationId: string,
  scheduleId: string,
  sectionId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...examinationsQueryKey(organizationId),
      'marks',
      scheduleId,
      sectionId,
    ],
    queryFn: () => getExamMarkSheet(organizationId, scheduleId, sectionId),
    enabled: enabled && Boolean(scheduleId && sectionId),
    retry: false,
  });
}

export function useStudentExamReport(
  organizationId: string,
  examId: string,
  studentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...examinationsQueryKey(organizationId),
      'report',
      examId,
      studentId,
    ],
    queryFn: () => getStudentExamReport(organizationId, examId, studentId),
    enabled: enabled && Boolean(examId && studentId),
    retry: false,
  });
}

function useInvalidateExaminations(organizationId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: examinationsQueryKey(organizationId),
    });
}

export function useSaveExam(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (input: {
      data: Parameters<typeof saveExam>[1];
      id?: string;
    }) => saveExam(organizationId, input.data, input.id),
    onSuccess: invalidate,
  });
}

export function useDeleteExam(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (id: string) => deleteExam(organizationId, id),
    onSuccess: invalidate,
  });
}

export function useSetExamResultsPublication(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (input: { examId: string; published: boolean }) =>
      setExamResultsPublication(organizationId, input.examId, input.published),
    onSuccess: invalidate,
  });
}

export function useSaveExamSchedule(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (input: {
      examId: string;
      data: Parameters<typeof saveExamSchedule>[2];
      id?: string;
    }) => saveExamSchedule(organizationId, input.examId, input.data, input.id),
    onSuccess: invalidate,
  });
}

export function useDeleteExamSchedule(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (id: string) => deleteExamSchedule(organizationId, id),
    onSuccess: invalidate,
  });
}

export function useSaveGradingScale(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (input: {
      data: Parameters<typeof saveGradingScale>[1];
      id?: string;
    }) => saveGradingScale(organizationId, input.data, input.id),
    onSuccess: invalidate,
  });
}

export function useDeleteGradingScale(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (id: string) => deleteGradingScale(organizationId, id),
    onSuccess: invalidate,
  });
}

export function useSaveExamMarks(organizationId: string) {
  const invalidate = useInvalidateExaminations(organizationId);
  return useMutation({
    mutationFn: (input: {
      scheduleId: string;
      records: Parameters<typeof saveExamMarks>[2];
    }) => saveExamMarks(organizationId, input.scheduleId, input.records),
    onSuccess: invalidate,
  });
}
