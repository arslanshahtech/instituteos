import { describe, expect, it, vi } from 'vitest';
import { FinanceOperationsService } from './finance-operations.service.js';
import type {
  FinanceOperationsContext,
  FinanceOperationsRepository,
} from './finance-operations.types.js';

const organizationId = '111111111111111111111111';
const campusId = '222222222222222222222222';
const userId = '333333333333333333333333';
const context: FinanceOperationsContext = {
  organizationId,
  campusIds: [campusId],
  userId,
};

function makeRepository() {
  return {
    listPayments: vi.fn().mockResolvedValue([]),
    listExpenses: vi.fn().mockResolvedValue([]),
    createExpense: vi.fn().mockImplementation(async (_context, input) => ({
      ...input,
      id: '444444444444444444444444',
      organizationId,
      recordedBy: userId,
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    })),
    deleteExpense: vi.fn().mockResolvedValue(true),
    listExpenseBudgets: vi.fn().mockResolvedValue([]),
    saveExpenseBudget: vi.fn().mockImplementation(async (_context, input) => ({
      ...input,
      id: '666666666666666666666666',
      organizationId,
      recordedBy: userId,
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    })),
    listConcessions: vi.fn().mockResolvedValue([]),
  } as unknown as FinanceOperationsRepository;
}

describe('FinanceOperationsService', () => {
  it('creates a validated campus-scoped expense', async () => {
    const repository = makeRepository();
    const service = new FinanceOperationsService(repository);

    const expense = await service.createExpense(context, {
      description: 'Electricity bill',
      category: 'utilities',
      amount: 12500.5,
      paymentMethod: 'bank_transfer',
      expenseDate: '2026-10-20',
      campusId,
      reference: 'BILL-1020',
    });

    expect(expense).toMatchObject({
      description: 'Electricity bill',
      amount: 12500.5,
      category: 'utilities',
      campusId,
    });
    expect(repository.createExpense).toHaveBeenCalledOnce();
  });

  it('rejects invalid calendar dates', async () => {
    const service = new FinanceOperationsService(makeRepository());
    await expect(
      service.createExpense(context, {
        description: 'Utilities',
        category: 'utilities',
        amount: 100,
        paymentMethod: 'cash',
        expenseDate: '2026-02-30',
        campusId,
      }),
    ).rejects.toThrow('Enter a valid expense date.');
  });

  it('rejects expenses outside the caller campus scope', async () => {
    const service = new FinanceOperationsService(makeRepository());
    await expect(
      service.createExpense(context, {
        description: 'Office supplies',
        category: 'supplies',
        amount: 100,
        paymentMethod: 'cash',
        expenseDate: '2026-10-20',
        campusId: '555555555555555555555555',
      }),
    ).rejects.toThrow('Select a campus you have access to.');
  });

  it('rejects amounts with more than two decimal places', async () => {
    const service = new FinanceOperationsService(makeRepository());
    await expect(
      service.createExpense(context, {
        description: 'Office supplies',
        category: 'supplies',
        amount: 100.123,
        paymentMethod: 'cash',
        expenseDate: '2026-10-20',
        campusId,
      }),
    ).rejects.toThrow('Expense amount can have at most two decimal places.');
  });

  it('saves a validated monthly expense budget', async () => {
    const repository = makeRepository();
    const service = new FinanceOperationsService(repository);
    const budget = await service.saveExpenseBudget(context, {
      category: 'utilities',
      month: '2026-10',
      budgetAmount: 50000,
      campusId,
    });
    expect(budget).toMatchObject({
      category: 'utilities',
      month: '2026-10',
      budgetAmount: 50000,
    });
    expect(repository.saveExpenseBudget).toHaveBeenCalledOnce();
  });

  it('rejects invalid budget months', async () => {
    const service = new FinanceOperationsService(makeRepository());
    await expect(
      service.saveExpenseBudget(context, {
        category: 'utilities',
        month: '2026-13',
        budgetAmount: 50000,
        campusId,
      }),
    ).rejects.toThrow('Select a valid budget month.');
  });
});
