import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getEligibleStudents,
  getStudentRoster,
  listStaffAttendance,
  listStudentAttendance,
  placeStudent,
  saveStaffAttendance,
  saveStudentAttendance,
} from './attendance-api.js';

export const attendanceQueryKey = (organizationId: string) =>
  ['attendance', organizationId] as const;

export function useAttendanceRoster(
  organizationId: string,
  input: {
    classId: string;
    sectionId: string;
    academicYearId: string;
    campusId: string;
    date: string;
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...attendanceQueryKey(organizationId), 'student-roster', input],
    queryFn: () => getStudentRoster(organizationId, input),
    enabled: enabled && Object.values(input).every(Boolean),
    retry: false,
  });
}

export function useEligibleStudents(
  organizationId: string,
  campusId: string,
  academicYearId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...attendanceQueryKey(organizationId),
      'eligible-students',
      campusId,
      academicYearId,
    ],
    queryFn: () =>
      getEligibleStudents(organizationId, campusId, academicYearId),
    enabled: enabled && Boolean(campusId && academicYearId),
    retry: false,
  });
}

export function useStudentAttendanceHistory(
  organizationId: string,
  sectionId: string,
  date: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...attendanceQueryKey(organizationId),
      'student-history',
      sectionId,
      date,
    ],
    queryFn: () =>
      listStudentAttendance(organizationId, {
        sectionId,
        dateFrom: date,
        dateTo: date,
      }),
    enabled: enabled && Boolean(sectionId && date),
    retry: false,
  });
}

export function useStaffAttendance(
  organizationId: string,
  campusId: string,
  date: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...attendanceQueryKey(organizationId), 'staff', campusId, date],
    queryFn: () =>
      listStaffAttendance(organizationId, {
        campusId: campusId || undefined,
        dateFrom: date,
        dateTo: date,
      }),
    enabled: enabled && Boolean(date),
    retry: false,
  });
}

export function usePlaceStudent(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      studentId: string;
      classId: string;
      sectionId: string;
      academicYearId: string;
      campusId: string;
    }) => placeStudent(organizationId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attendanceQueryKey(organizationId),
      }),
  });
}

export function useSaveStudentAttendance(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveStudentAttendance>[1]) =>
      saveStudentAttendance(organizationId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attendanceQueryKey(organizationId),
      }),
  });
}

export function useSaveStaffAttendance(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveStaffAttendance>[1]) =>
      saveStaffAttendance(organizationId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attendanceQueryKey(organizationId),
      }),
  });
}
