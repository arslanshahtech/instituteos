import { describe, expect, it } from 'vitest';
import { buildFinanceLedgerRows } from './finance-ledger.js';
import type { FinanceExpense, FinancePayment } from './finance-api.js';

const payment = (overrides: Partial<FinancePayment> = {}): FinancePayment => ({
  id: 'payment-1',
  organizationId: 'org-1',
  receiptNumber: 'RCP-001',
  invoiceId: 'invoice-1',
  invoiceNumber: 'INV-001',
  studentId: 'student-1',
  studentName: 'Ayesha Khan',
  campusId: 'campus-1',
  classId: 'class-1',
  amountPaid: 5000,
  paymentMethod: 'cash',
  paymentDate: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

const expense = (overrides: Partial<FinanceExpense> = {}): FinanceExpense => ({
  id: 'expense-1',
  organizationId: 'org-1',
  description: 'Electricity bill',
  category: 'utilities',
  amount: 1200,
  paymentMethod: 'cash',
  expenseDate: '2026-11-02T10:00:00.000Z',
  recordedBy: 'user-1',
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  ...overrides,
});

describe('buildFinanceLedgerRows', () => {
  it('sorts transactions chronologically and calculates cumulative net movement', () => {
    const rows = buildFinanceLedgerRows(
      [payment()],
      [expense()],
      'All Transactions',
    );

    expect(rows.map((row) => row.id)).toEqual([
      'expense-expense-1',
      'payment-payment-1',
    ]);
    expect(rows[0]?.balance).toBe(3800);
    expect(rows[1]?.balance).toBe(5000);
  });

  it('includes payroll payments as outgoing salary movements', () => {
    const rows = buildFinanceLedgerRows(
      [],
      [expense({ source: 'payroll', description: 'Salary payment — Ali' })],
      'All Transactions',
    );

    expect(rows[0]?.type).toBe('Salary payment');
    expect(rows[0]?.credit).toBe(1200);
    expect(rows[0]?.balance).toBe(-1200);
  });

  it('shows the full staff name without salary period metadata', () => {
    const rows = buildFinanceLedgerRows(
      [],
      [
        expense({
          source: 'payroll',
          description: 'Salary payment — Arslan Chishti — 2026-11',
        }),
      ],
      'All Transactions',
    );

    expect(rows[0]?.type).toBe('Salary payment');
    expect(rows[0]?.description).toBe('Arslan Chishti');
  });

  it('recognizes legacy salary expenses and removes their month suffix', () => {
    const rows = buildFinanceLedgerRows(
      [],
      [
        expense({
          category: 'salaries',
          description: 'Salary payment — Sana Ahmed — 2026-10',
        }),
      ],
      'All Transactions',
    );

    expect(rows[0]?.type).toBe('Salary payment');
    expect(rows[0]?.description).toBe('Sana Ahmed');
  });

  it('shows fee collection as the type and only the student name as its particular', () => {
    const rows = buildFinanceLedgerRows(
      [payment({ studentName: 'Ayesha Noor Khan' })],
      [],
      'All Transactions',
    );

    expect(rows[0]?.type).toBe('Fee collection');
    expect(rows[0]?.description).toBe('Ayesha Noor Khan');
  });

  it('groups card and online payments as non-cash instead of inventing a bank account', () => {
    const rows = buildFinanceLedgerRows(
      [payment({ paymentMethod: 'card' })],
      [],
      'Non-cash payments',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.paymentChannel).toBe('Non-cash payments');
  });

  it('filters cash entries without including non-cash transactions', () => {
    const rows = buildFinanceLedgerRows(
      [payment(), payment({ id: 'payment-2', paymentMethod: 'bank_transfer' })],
      [],
      'Cash payments',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('payment-payment-1');
  });
  it('keeps the overall running balance when a transaction filter is active', () => {
    const rows = buildFinanceLedgerRows([payment()], [expense()], 'Expenses');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.balance).toBe(3800);
  });
});
