import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPayrollAdvance,
  generatePayroll,
  listPayroll,
  listPayrollAdvances,
  listPayrollSalaries,
  recordPayrollPayment,
  savePayrollSalary,
} from './payroll-api.js';

const key = (organizationId: string) => ['payroll', organizationId] as const;

export function usePayrollWorkspace(
  organizationId: string,
  month: string,
  enabled: boolean,
) {
  return {
    salaries: useQuery({
      queryKey: [...key(organizationId), 'salaries'],
      queryFn: () => listPayrollSalaries(organizationId),
      enabled,
      retry: false,
    }),
    payroll: useQuery({
      queryKey: [...key(organizationId), 'month', month],
      queryFn: () => listPayroll(organizationId, month),
      enabled,
      retry: false,
    }),
    advances: useQuery({
      queryKey: [...key(organizationId), 'advances'],
      queryFn: () => listPayrollAdvances(organizationId),
      enabled,
      retry: false,
    }),
  };
}

function useInvalidate(organizationId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: key(organizationId) });
}

export function useSavePayrollSalary(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: (input: {
      staffId: string;
      monthlySalary: number;
      effectiveFrom: string;
      isActive?: boolean;
    }) => savePayrollSalary(organizationId, input.staffId, input),
    onSuccess: invalidate,
  });
}
export function useGeneratePayroll(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: (month: string) => generatePayroll(organizationId, month),
    onSuccess: invalidate,
  });
}
export function useRecordPayrollPayment(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: (input: {
      payrollId: string;
      amount: number;
      paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'online';
      paymentDate: string;
      reference?: string;
    }) => recordPayrollPayment(organizationId, input.payrollId, input),
    onSuccess: invalidate,
  });
}
export function useCreatePayrollAdvance(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: (input: {
      staffId: string;
      amount: number;
      paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'online';
      advanceDate: string;
      reference?: string;
    }) => createPayrollAdvance(organizationId, input),
    onSuccess: invalidate,
  });
}
