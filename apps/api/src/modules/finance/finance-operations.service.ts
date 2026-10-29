import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type { PaymentMethod } from './finance.types.js';
import type { ExpenseCategory } from './finance-operations.model.js';
import type {
  FinanceDateFilters,
  FinanceOperationsContext,
  FinanceOperationsRepository,
} from './finance-operations.types.js';

const categories: ExpenseCategory[] = [
  'salaries',
  'utilities',
  'stationery',
  'maintenance',
  'transport',
  'supplies',
  'other',
];
const methods: PaymentMethod[] = ['cash', 'bank_transfer', 'card', 'online'];

function validDate(value: string | undefined, field: string) {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value;
}

function validFilters(
  context: FinanceOperationsContext,
  raw: Record<string, unknown>,
): FinanceDateFilters & {
  paymentMethod?: PaymentMethod;
  category?: ExpenseCategory;
} {
  const dateFrom = validDate(
    typeof raw.dateFrom === 'string' ? raw.dateFrom : undefined,
    'start date',
  );
  const dateTo = validDate(
    typeof raw.dateTo === 'string' ? raw.dateTo : undefined,
    'end date',
  );
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Start date must be before end date.',
    );
  }
  const campusId =
    typeof raw.campusId === 'string' && raw.campusId ? raw.campusId : undefined;
  const classId =
    typeof raw.classId === 'string' && raw.classId ? raw.classId : undefined;
  for (const [value, field] of [
    [campusId, 'campus'],
    [classId, 'class'],
  ] as const) {
    if (value && !mongoose.isValidObjectId(value)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
    }
  }
  if (
    campusId &&
    context.campusIds.length &&
    !context.campusIds.includes(campusId)
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have access to this campus.',
    );
  }
  const paymentMethod =
    typeof raw.paymentMethod === 'string' && raw.paymentMethod
      ? (raw.paymentMethod as PaymentMethod)
      : undefined;
  if (paymentMethod && !methods.includes(paymentMethod)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid payment method.',
    );
  }
  const category =
    typeof raw.category === 'string' && raw.category
      ? (raw.category as ExpenseCategory)
      : undefined;
  if (category && !categories.includes(category)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid expense category.',
    );
  }
  return { dateFrom, dateTo, campusId, classId, paymentMethod, category };
}

export class FinanceOperationsService {
  constructor(private readonly repository: FinanceOperationsRepository) {}

  listPayments(
    context: FinanceOperationsContext,
    raw: Record<string, unknown>,
  ) {
    const filters = validFilters(context, raw);
    return this.repository.listPayments(context, filters);
  }

  listExpenses(
    context: FinanceOperationsContext,
    raw: Record<string, unknown>,
  ) {
    const filters = validFilters(context, raw);
    return this.repository.listExpenses(context, filters);
  }

  listConcessions(
    context: FinanceOperationsContext,
    raw: Record<string, unknown>,
  ) {
    const campusId =
      typeof raw.campusId === 'string' && raw.campusId
        ? raw.campusId
        : undefined;
    const academicYearId =
      typeof raw.academicYearId === 'string' && raw.academicYearId
        ? raw.academicYearId
        : undefined;
    for (const [value, field] of [
      [campusId, 'campus'],
      [academicYearId, 'academic year'],
    ] as const) {
      if (value && !mongoose.isValidObjectId(value)) {
        throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
      }
    }
    if (
      campusId &&
      context.campusIds.length &&
      !context.campusIds.includes(campusId)
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have access to this campus.',
      );
    }
    return this.repository.listConcessions(context, {
      campusId,
      academicYearId,
    });
  }

  async createExpense(
    context: FinanceOperationsContext,
    raw: Record<string, unknown>,
  ) {
    const description =
      typeof raw.description === 'string' ? raw.description.trim() : '';
    if (!description || description.length > 180) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter an expense description (max 180 characters).',
      );
    }
    const category = raw.category as ExpenseCategory;
    if (!categories.includes(category)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid expense category.',
      );
    }
    if (
      typeof raw.amount !== 'number' ||
      !Number.isFinite(raw.amount) ||
      raw.amount <= 0 ||
      raw.amount > 100000000000
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter an expense amount greater than zero.',
      );
    }
    if (Math.round(raw.amount * 100) !== raw.amount * 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Expense amount can have at most two decimal places.',
      );
    }
    if (
      typeof raw.paymentMethod !== 'string' ||
      !methods.includes(raw.paymentMethod as PaymentMethod)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid payment method.',
      );
    }
    if (typeof raw.expenseDate !== 'string') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter a valid expense date.',
      );
    }
    const expenseDate = validDate(raw.expenseDate, 'expense date');
    const campusId =
      typeof raw.campusId === 'string' && raw.campusId
        ? raw.campusId
        : undefined;
    if (campusId && !mongoose.isValidObjectId(campusId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid campus.');
    }
    if (
      context.campusIds.length &&
      (!campusId || !context.campusIds.includes(campusId))
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Select a campus you have access to.',
      );
    }
    const reference =
      typeof raw.reference === 'string' ? raw.reference.trim() : '';
    if (reference.length > 160) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Reference must be 160 characters or fewer.',
      );
    }
    return this.repository.createExpense(context, {
      description,
      category,
      amount: raw.amount,
      paymentMethod: raw.paymentMethod as PaymentMethod,
      expenseDate: expenseDate!,
      campusId,
      ...(reference ? { reference } : {}),
    });
  }

  listExpenseBudgets(
    context: FinanceOperationsContext,
    raw: Record<string, unknown>,
  ) {
    const month = typeof raw.month === 'string' ? raw.month : '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid budget month.',
      );
    }
    const campusId =
      typeof raw.campusId === 'string' && raw.campusId
        ? raw.campusId
        : undefined;
    if (campusId && !mongoose.isValidObjectId(campusId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid campus.');
    }
    if (
      campusId &&
      context.campusIds.length &&
      !context.campusIds.includes(campusId)
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have access to this campus.',
      );
    }
    return this.repository.listExpenseBudgets(context, { month, campusId });
  }

  async saveExpenseBudget(
    context: FinanceOperationsContext,
    raw: Record<string, unknown>,
  ) {
    const category = raw.category as ExpenseCategory;
    if (!categories.includes(category)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid expense category.',
      );
    }
    const month = typeof raw.month === 'string' ? raw.month : '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid budget month.',
      );
    }
    if (
      typeof raw.budgetAmount !== 'number' ||
      !Number.isFinite(raw.budgetAmount) ||
      raw.budgetAmount <= 0 ||
      raw.budgetAmount > 100000000000
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter a budget amount greater than zero.',
      );
    }
    if (Math.round(raw.budgetAmount * 100) !== raw.budgetAmount * 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Budget amount can have at most two decimal places.',
      );
    }
    const campusId =
      typeof raw.campusId === 'string' && raw.campusId
        ? raw.campusId
        : undefined;
    if (campusId && !mongoose.isValidObjectId(campusId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid campus.');
    }
    if (
      context.campusIds.length &&
      (!campusId || !context.campusIds.includes(campusId))
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Select a campus you have access to.',
      );
    }
    return this.repository.saveExpenseBudget(context, {
      category,
      month,
      budgetAmount: raw.budgetAmount,
      campusId,
    });
  }

  async deleteExpense(context: FinanceOperationsContext, rawId: string) {
    if (!mongoose.isValidObjectId(rawId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid expense.');
    }
    const deleted = await this.repository.deleteExpense(context, rawId);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Expense not found.');
  }
}
