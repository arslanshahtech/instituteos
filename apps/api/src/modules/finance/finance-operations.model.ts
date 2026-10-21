import mongoose, { Schema } from 'mongoose';
import type { PaymentMethod } from './finance.types.js';

export type ExpenseCategory =
  | 'salaries'
  | 'utilities'
  | 'stationery'
  | 'maintenance'
  | 'transport'
  | 'supplies'
  | 'other';

const financeExpenseSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', default: null },
    description: { type: String, required: true, trim: true, maxlength: 180 },
    category: {
      type: String,
      enum: [
        'salaries',
        'utilities',
        'stationery',
        'maintenance',
        'transport',
        'supplies',
        'other',
      ],
      required: true,
    },
    amount: { type: Schema.Types.Decimal128, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'online'] satisfies PaymentMethod[],
      required: true,
    },
    expenseDate: { type: Date, required: true },
    reference: { type: String, trim: true, maxlength: 160 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

financeExpenseSchema.index({
  organizationId: 1,
  campusId: 1,
  expenseDate: -1,
});

export const FinanceExpenseModel =
  mongoose.models.FinanceExpense ??
  mongoose.model('FinanceExpense', financeExpenseSchema);


const financeExpenseBudgetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', default: null },
    category: {
      type: String,
      enum: [
        'salaries',
        'utilities',
        'stationery',
        'maintenance',
        'transport',
        'supplies',
        'other',
      ],
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
    },
    budgetAmount: { type: Schema.Types.Decimal128, required: true, min: 0.01 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

financeExpenseBudgetSchema.index(
  { organizationId: 1, campusId: 1, category: 1, month: 1 },
  { unique: true },
);

export const FinanceExpenseBudgetModel =
  mongoose.models.FinanceExpenseBudget ??
  mongoose.model('FinanceExpenseBudget', financeExpenseBudgetSchema);
