import type { PaymentMethod } from './finance.types.js';
import type { ExpenseCategory } from './finance-operations.model.js';

export interface FinanceOperationsContext {
  organizationId: string;
  campusIds: string[];
  userId: string;
}

export interface FinanceDateFilters {
  dateFrom?: string;
  dateTo?: string;
  campusId?: string;
  classId?: string;
}

export interface FinanceExpenseInput {
  description: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: string;
  campusId?: string;
  reference?: string;
}

export interface FinanceExpenseRecord extends FinanceExpenseInput {
  id: string;
  organizationId: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancePaymentRecord {
  id: string;
  organizationId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  campusId: string;
  classId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference?: string;
}

export interface FinanceExpenseBudgetInput {
  category: ExpenseCategory;
  month: string;
  budgetAmount: number;
  campusId?: string;
}

export interface FinanceExpenseBudgetRecord extends FinanceExpenseBudgetInput {
  id: string;
  organizationId: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceConcessionRecord {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  campusId?: string;
  academicYearId?: string;
  concessionType:
    'sibling' | 'staff_child' | 'scholarship' | 'need_based' | 'special';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  reason?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceOperationsRepository {
  listPayments(
    context: FinanceOperationsContext,
    filters: FinanceDateFilters & { paymentMethod?: PaymentMethod },
  ): Promise<FinancePaymentRecord[]>;
  listExpenses(
    context: FinanceOperationsContext,
    filters: FinanceDateFilters & {
      category?: ExpenseCategory;
      paymentMethod?: PaymentMethod;
    },
  ): Promise<FinanceExpenseRecord[]>;
  createExpense(
    context: FinanceOperationsContext,
    input: FinanceExpenseInput,
  ): Promise<FinanceExpenseRecord>;
  deleteExpense(
    context: FinanceOperationsContext,
    expenseId: string,
  ): Promise<boolean>;
  listExpenseBudgets(
    context: FinanceOperationsContext,
    filters: { month: string; campusId?: string },
  ): Promise<FinanceExpenseBudgetRecord[]>;
  saveExpenseBudget(
    context: FinanceOperationsContext,
    input: FinanceExpenseBudgetInput,
  ): Promise<FinanceExpenseBudgetRecord>;
  listConcessions(
    context: FinanceOperationsContext,
    filters: { campusId?: string; academicYearId?: string },
  ): Promise<FinanceConcessionRecord[]>;
}
