import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApplication,
  createInquiry,
  getApplication,
  listApplications,
  listInquiries,
  reviewApplication,
  updateInquiryStatus,
} from './admissions-api.js';
import { studentsQueryKey } from '../students/student-queries.js';
import type {
  AdmissionsQuery,
  ApplicationInput,
  ApplicationStatus,
  InquiryInput,
  InquiryStatus,
} from './admissions-api.js';

export const admissionsQueryKey = (organizationId: string) =>
  ['admissions', organizationId] as const;

export function useInquiries(
  organizationId: string,
  input: AdmissionsQuery,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...admissionsQueryKey(organizationId), 'inquiries', input],
    queryFn: () => listInquiries(organizationId, input),
    enabled,
  });
}

export function useApplications(
  organizationId: string,
  input: AdmissionsQuery,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...admissionsQueryKey(organizationId), 'applications', input],
    queryFn: () => listApplications(organizationId, input),
    enabled,
  });
}

export function useApplication(
  organizationId: string,
  applicationId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...admissionsQueryKey(organizationId),
      'application',
      applicationId,
    ],
    queryFn: () => getApplication(organizationId, applicationId),
    enabled,
  });
}

function invalidateAdmissions(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: admissionsQueryKey(organizationId),
  });
}

export function useCreateInquiry(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InquiryInput) => createInquiry(organizationId, input),
    onSuccess: () => invalidateAdmissions(queryClient, organizationId),
  });
}

export function useUpdateInquiryStatus(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { inquiryId: string; status: InquiryStatus }) =>
      updateInquiryStatus(organizationId, input.inquiryId, input.status),
    onSuccess: () => invalidateAdmissions(queryClient, organizationId),
  });
}

export function useCreateApplication(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      createApplication(organizationId, input),
    onSuccess: () => invalidateAdmissions(queryClient, organizationId),
  });
}

export function useReviewApplication(
  organizationId: string,
  applicationId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      status: ApplicationStatus;
      decisionReason?: string;
      campusId?: string;
    }) => reviewApplication(organizationId, applicationId, input),
    onSuccess: async () => {
      await invalidateAdmissions(queryClient, organizationId);
      await queryClient.invalidateQueries({
        queryKey: [
          ...admissionsQueryKey(organizationId),
          'application',
          applicationId,
        ],
      });
      // Approval creates (or repairs) the student record, so refresh any
      // open Students list/detail queries immediately.
      await queryClient.invalidateQueries({
        queryKey: studentsQueryKey(organizationId),
      });
    },
  });
}
