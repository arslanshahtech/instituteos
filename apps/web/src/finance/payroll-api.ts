import { apiRequest } from '../api/client.js';
import type { PaymentMethod } from './finance-api.js';

const path = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/finance/payroll`;

export interface PayrollSalaryProfile {
  id: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  staffType: 'teacher' | 'other_staff';
  staffStatus: string;
  campusId?: string;
  monthlySalary: number;
  effectiveFrom: string;
  isActive: boolean;
}

export interface PayrollPayment {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  reference: string;
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  campusId?: string;
  month: string;
  grossSalary: number;
  advanceAdjusted: number;
  payable: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'pending' | 'partial' | 'paid';
  payments: PayrollPayment[];
}

export interface PayrollAdvance {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  adjustedAmount: number;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
  advanceDate: string;
  reference: string;
}

export function listPayrollSalaries(organizationId: string) {
  return apiRequest<{ items: PayrollSalaryProfile[] }>(
    `${path(organizationId)}/salaries`,
  );
}

export function savePayrollSalary(
  organizationId: string,
  staffId: string,
  input: { monthlySalary: number; effectiveFrom: string; isActive?: boolean },
) {
  return apiRequest<{
    profile: {
      id: string;
      staffId: string;
      monthlySalary: number;
      effectiveFrom: string;
      isActive: boolean;
    };
  }>(`${path(organizationId)}/salaries/${encodeURIComponent(staffId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function listPayroll(organizationId: string, month: string) {
  return apiRequest<{ items: PayrollRecord[] }>(
    `${path(organizationId)}?month=${encodeURIComponent(month)}`,
  );
}

export function generatePayroll(organizationId: string, month: string) {
  return apiRequest<{ created: number; skipped: number }>(
    `${path(organizationId)}/generate`,
    { method: 'POST', body: JSON.stringify({ month }) },
  );
}

export function recordPayrollPayment(
  organizationId: string,
  payrollId: string,
  input: {
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    reference?: string;
  },
) {
  return apiRequest<{
    payrollId: string;
    paidAmount: number;
    pendingAmount: number;
    status: string;
  }>(`${path(organizationId)}/${encodeURIComponent(payrollId)}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listPayrollAdvances(organizationId: string) {
  return apiRequest<{ items: PayrollAdvance[] }>(
    `${path(organizationId)}/advances`,
  );
}

export function createPayrollAdvance(
  organizationId: string,
  input: {
    staffId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    advanceDate: string;
    reference?: string;
  },
) {
  return apiRequest<{
    id: string;
    staffId: string;
    staffName: string;
    amount: number;
    remainingAmount: number;
  }>(`${path(organizationId)}/advances`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
