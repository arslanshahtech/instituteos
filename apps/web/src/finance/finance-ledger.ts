import type { FinanceExpense, FinancePayment } from './finance-api.js';

export type FinanceLedgerAccountFilter =
  | 'All Transactions'
  | 'Fee Collections'
  | 'Expenses'
  | 'Cash payments'
  | 'Non-cash payments';

export interface FinanceLedgerRow {
  id: string;
  date: string;
  type: 'Fee collection' | 'Expense payment' | 'Salary payment';
  description: string;
  reference: string;
  debit: number;
  credit: number;
  paymentChannel: 'Cash payments' | 'Non-cash payments';
  balance: number;
}

export function isPayrollLedgerExpense(expense: FinanceExpense) {
  return (
    expense.source === 'payroll' ||
    (expense.source === undefined &&
      expense.category === 'salaries' &&
      /^Salary (?:payment|advance)\s*[—-]\s/i.test(expense.description))
  );
}

export function getLedgerExpenseName(expense: FinanceExpense) {
  if (!isPayrollLedgerExpense(expense)) return expense.description;

  const salaryPayment = expense.description.match(
    /^Salary payment\s*[—-]\s(.+?)\s*[—-]\s\d{4}-\d{2}$/i,
  );
  if (salaryPayment?.[1]) return salaryPayment[1].trim();

  const salaryAdvance = expense.description.match(
    /^Salary advance\s*[—-]\s(.+?)(?:\s*[—-]\s\d{4}-\d{2})?$/i,
  );
  return salaryAdvance?.[1]?.trim() || expense.description;
}

export function buildFinanceLedgerRows(
  payments: FinancePayment[],
  expenses: FinanceExpense[],
  accountFilter: FinanceLedgerAccountFilter,
): FinanceLedgerRow[] {
  const entries = [
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paymentDate,
      type: 'Fee collection' as const,
      description: payment.studentName,
      reference: payment.receiptNumber,
      debit: payment.amountPaid,
      credit: 0,
      paymentChannel:
        payment.paymentMethod === 'cash'
          ? ('Cash payments' as const)
          : ('Non-cash payments' as const),
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.expenseDate,
      type: isPayrollLedgerExpense(expense)
        ? ('Salary payment' as const)
        : ('Expense payment' as const),
      description: getLedgerExpenseName(expense),
      reference: expense.reference ?? 'Expense',
      debit: 0,
      credit: expense.amount,
      paymentChannel:
        expense.paymentMethod === 'cash'
          ? ('Cash payments' as const)
          : ('Non-cash payments' as const),
    })),
  ].sort((a, b) => {
    const dateDifference =
      new Date(a.date).getTime() - new Date(b.date).getTime();
    return dateDifference || a.id.localeCompare(b.id);
  });

  let runningBalance = 0;
  const balancedEntries = entries.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return { ...entry, balance: runningBalance };
  });

  return balancedEntries
    .filter((entry) => {
      if (accountFilter === 'All Transactions') return true;
      if (accountFilter === 'Fee Collections') return entry.debit > 0;
      if (accountFilter === 'Expenses') return entry.credit > 0;
      return entry.paymentChannel === accountFilter;
    })
    .reverse();
}
