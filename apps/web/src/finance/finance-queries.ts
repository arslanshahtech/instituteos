import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deleteFeeStructure,
  generateInvoices,
  getStudentFeeLedger,
  listFeeStructures,
  listInvoices,
  recordInvoicePayment,
  saveFeeStructure,
  listStudentConcessions,
  saveFeeConcession,
  deleteFeeConcession,
  requestInvoiceDeleteOtp,
  deleteInvoice,
  setInvoiceDiscount,
} from './finance-api.js';
import type { InvoiceFilters, FeeConcessionInput } from './finance-api.js';

export const financeQueryKey = (organizationId: string) =>
  ['finance', organizationId] as const;

export function useFinanceWorkspace(
  organizationId: string,
  enabled: boolean,
  filters: InvoiceFilters,
) {
  const key = financeQueryKey(organizationId);
  return {
    feeStructures: useQuery({
      queryKey: [...key, 'fee-structures'],
      queryFn: () => listFeeStructures(organizationId),
      enabled,
      retry: false,
    }),
    invoices: useQuery({
      queryKey: [...key, 'invoices', filters],
      queryFn: () => listInvoices(organizationId, filters),
      enabled,
      retry: false,
      placeholderData: keepPreviousData,
    }),
  };
}

export function useStudentFeeLedger(
  organizationId: string,
  studentId: string,
  enabled = true,
) {
  const key = financeQueryKey(organizationId);
  return useQuery({
    queryKey: [...key, 'ledger', studentId],
    queryFn: () => getStudentFeeLedger(organizationId, studentId),
    enabled: Boolean(organizationId && studentId && enabled),
    retry: false,
  });
}

function useInvalidateFinance(organizationId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: financeQueryKey(organizationId) });
}

export function useSaveFeeStructure(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (input: {
      data: Parameters<typeof saveFeeStructure>[1];
      id?: string;
    }) => saveFeeStructure(organizationId, input.data, input.id),
    onSuccess: invalidate,
  });
}

export function useDeleteFeeStructure(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (id: string) => deleteFeeStructure(organizationId, id),
    onSuccess: invalidate,
  });
}

export function useGenerateInvoices(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (input: Parameters<typeof generateInvoices>[1]) =>
      generateInvoices(organizationId, input),
    onSuccess: invalidate,
  });
}

export function useRecordInvoicePayment(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (input: {
      invoiceId: string;
      data: Parameters<typeof recordInvoicePayment>[2];
    }) => recordInvoicePayment(organizationId, input.invoiceId, input.data),
    onSuccess: invalidate,
  });
}

export function useStudentConcessions(
  organizationId: string,
  studentId: string,
  academicYearId?: string,
  enabled = true,
) {
  const key = financeQueryKey(organizationId);
  return useQuery({
    queryKey: [...key, 'concessions', studentId, academicYearId],
    queryFn: () => listStudentConcessions(organizationId, studentId, academicYearId),
    enabled: Boolean(organizationId && studentId && enabled),
    retry: false,
  });
}

export function useSaveFeeConcession(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (input: { data: FeeConcessionInput; id?: string }) =>
      saveFeeConcession(organizationId, input.data, input.id),
    onSuccess: invalidate,
  });
}

export function useDeleteFeeConcession(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (concessionId: string) =>
      deleteFeeConcession(organizationId, concessionId),
    onSuccess: invalidate,
  });
}

export function useRequestInvoiceDeleteOtp(organizationId: string) {
  return useMutation({
    mutationFn: (invoiceId: string) =>
      requestInvoiceDeleteOtp(organizationId, invoiceId),
  });
}

export function useDeleteInvoice(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (input: { invoiceId: string; otpCode?: string }) =>
      deleteInvoice(organizationId, input.invoiceId, input.otpCode),
    onSuccess: invalidate,
  });
}

export function useSetInvoiceDiscount(organizationId: string) {
  const invalidate = useInvalidateFinance(organizationId);
  return useMutation({
    mutationFn: (input: { invoiceId: string; applyDiscount: boolean }) =>
      setInvoiceDiscount(organizationId, input.invoiceId, input.applyDiscount),
    onSuccess: invalidate,
  });
}