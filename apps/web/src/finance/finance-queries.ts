import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deleteFeeStructure,
  generateInvoices,
  listFeeStructures,
  listInvoices,
  recordInvoicePayment,
  saveFeeStructure,
} from './finance-api.js';
import type { InvoiceFilters } from './finance-api.js';

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
