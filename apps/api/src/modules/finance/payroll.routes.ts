import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationPermission,
} from '../tenancy/tenant-context.middleware.js';
import { StaffMemberModel } from '../people/people.model.js';
import { FinanceExpenseModel } from './finance-operations.model.js';
import {
  PayrollAdvanceModel,
  PayrollMonthModel,
  PayrollSalaryProfileModel,
} from './payroll.model.js';

const oid = (value: string) => new Types.ObjectId(value);
const money = (value: unknown) =>
  Number((value as { toString?: () => string })?.toString?.() ?? 0);
const methods = ['cash', 'bank_transfer', 'card', 'online'] as const;

function authenticate() {
  const service = new AuthService(
    new MongoAuthRepository(),
    authEmailDelivery,
    {
      sessionTtlDays: env.authSessionTtlDays,
      requireEmailVerification: env.authRequireEmailVerification,
      webAppUrl: env.authWebAppUrl,
    },
  );
  return createAuthenticationMiddleware(service);
}

function context(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      userId: string;
    };
  };
}) {
  const value = response.locals?.organizationContext;
  if (!value)
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  return {
    organizationId: value.organizationId,
    campusIds: value.campusIds ?? [],
    userId: value.userId,
  };
}

function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  return value as Record<string, unknown>;
}

function validAmount(value: unknown, label: string) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 100000000000 ||
    Math.round(value * 100) !== value * 100
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Enter a valid ${label} greater than zero (up to two decimals).`,
    );
  }
  return value;
}

function validMonth(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid payroll month.',
    );
  return value;
}

function validDate(value: unknown, label: string) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${label}.`);
  }
  return value;
}

export function createPayrollRouter() {
  const router = Router();
  const resolve = createOrganizationContextMiddleware(
    new MongoOrganizationAccessRepository(),
  );
  const read = [
    authenticate(),
    resolve,
    requireOrganizationPermission('finance.read'),
  ];
  const write = [
    authenticate(),
    resolve,
    requireOrganizationPermission('finance.write'),
  ];

  router.get(
    '/:organizationId/finance/payroll/salaries',
    ...read,
    asyncHandler(async (_req, res) => {
      const ctx = context(res);
      const query: Record<string, unknown> = {
        organizationId: oid(ctx.organizationId),
      };
      if (ctx.campusIds.length)
        query.campusId = { $in: ctx.campusIds.map(oid) };
      const profiles = await PayrollSalaryProfileModel.find(query)
        .sort({ updatedAt: -1 })
        .lean()
        .exec();
      const staffIds = profiles.map((item) => item.staffId);
      const staff = await StaffMemberModel.find({
        organizationId: oid(ctx.organizationId),
        _id: { $in: staffIds },
      })
        .select('_id firstName lastName employeeCode staffType status campusId')
        .lean()
        .exec();
      const staffMap = new Map(staff.map((item) => [String(item._id), item]));
      res.json({
        items: profiles.flatMap((item) => {
          const person = staffMap.get(String(item.staffId));
          if (!person) return [];
          return [
            {
              id: String(item._id),
              staffId: String(item.staffId),
              staffName: [person.firstName, person.lastName]
                .filter(Boolean)
                .join(' '),
              employeeCode: person.employeeCode ?? '',
              staffType: person.staffType,
              staffStatus: person.status,
              campusId: item.campusId ? String(item.campusId) : undefined,
              monthlySalary: money(item.monthlySalary),
              effectiveFrom: new Date(item.effectiveFrom)
                .toISOString()
                .slice(0, 10),
              isActive: Boolean(item.isActive),
            },
          ];
        }),
      });
    }),
  );

  router.put(
    '/:organizationId/finance/payroll/salaries/:staffId',
    ...write,
    csrfProtection,
    asyncHandler(async (req, res) => {
      const ctx = context(res);
      const staffId = String(req.params.staffId ?? '');
      if (!mongoose.isValidObjectId(staffId))
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid staff member.',
        );
      const input = body(req.body);
      const monthlySalary = validAmount(input.monthlySalary, 'monthly salary');
      const effectiveFrom = validDate(input.effectiveFrom, 'effective date');
      const staff = await StaffMemberModel.findOne({
        _id: oid(staffId),
        organizationId: oid(ctx.organizationId),
      })
        .select('_id campusId')
        .lean()
        .exec();
      if (!staff)
        throw new AppError(404, 'NOT_FOUND', 'Staff member not found.');
      if (
        ctx.campusIds.length &&
        (!staff.campusId || !ctx.campusIds.includes(String(staff.campusId)))
      )
        throw new AppError(
          403,
          'FORBIDDEN',
          'You do not have access to this staff member.',
        );
      const effectiveDate = new Date(effectiveFrom + 'T00:00:00.000Z');
      const isActive = input.isActive !== false;
      let profile = await PayrollSalaryProfileModel.findOne({
        organizationId: oid(ctx.organizationId),
        staffId: oid(staffId),
      }).exec();
      if (!profile) {
        profile = await PayrollSalaryProfileModel.create({
          organizationId: oid(ctx.organizationId),
          staffId: oid(staffId),
          campusId: staff.campusId ?? null,
          monthlySalary: mongoose.Types.Decimal128.fromString(
            monthlySalary.toFixed(2),
          ),
          effectiveFrom: effectiveDate,
          isActive,
          recordedBy: oid(ctx.userId),
        });
      } else {
        const currentSalary = money(profile.monthlySalary);
        const currentEffectiveFrom = new Date(profile.effectiveFrom)
          .toISOString()
          .slice(0, 10);
        if (effectiveFrom < currentEffectiveFrom) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A salary change cannot be backdated before the current effective date. Use the current effective date or a future date.',
          );
        }
        if (
          currentSalary !== monthlySalary ||
          currentEffectiveFrom !== effectiveFrom ||
          Boolean(profile.isActive) !== isActive
        ) {
          profile.salaryHistory.push({
            monthlySalary: profile.monthlySalary,
            effectiveFrom: profile.effectiveFrom,
            isActive: profile.isActive,
            recordedBy: profile.recordedBy,
            recordedAt: new Date(),
          });
        }
        profile.campusId = staff.campusId ?? null;
        profile.monthlySalary = mongoose.Types.Decimal128.fromString(
          monthlySalary.toFixed(2),
        );
        profile.effectiveFrom = effectiveDate;
        profile.isActive = isActive;
        profile.recordedBy = oid(ctx.userId);
        await profile.save();
      }
      res.json({
        profile: {
          id: String(profile?._id),
          staffId,
          monthlySalary,
          effectiveFrom,
          isActive: Boolean(profile?.isActive),
        },
      });
    }),
  );

  router.get(
    '/:organizationId/finance/payroll',
    ...read,
    asyncHandler(async (req, res) => {
      const ctx = context(res);
      const month = validMonth(req.query.month);
      const query: Record<string, unknown> = {
        organizationId: oid(ctx.organizationId),
        month,
      };
      if (ctx.campusIds.length)
        query.campusId = { $in: ctx.campusIds.map(oid) };
      const records = await PayrollMonthModel.find(query)
        .sort({ staffName: 1 })
        .lean()
        .exec();
      res.json({
        items: records.map((item) => {
          const grossSalary = money(item.grossSalary);
          const advanceAdjusted = money(item.advanceAdjusted);
          const paidAmount = money(item.paidAmount);
          const payable = Math.max(0, grossSalary - advanceAdjusted);
          return {
            id: String(item._id),
            staffId: String(item.staffId),
            staffName: item.staffName,
            employeeCode: item.employeeCode ?? '',
            campusId: item.campusId ? String(item.campusId) : undefined,
            month: item.month,
            grossSalary,
            advanceAdjusted,
            payable,
            paidAmount,
            pendingAmount: Math.max(0, payable - paidAmount),
            status: item.status,
            payments: (item.payments ?? []).map(
              (payment: Record<string, unknown>) => ({
                amount: money(payment.amount),
                paymentMethod: payment.paymentMethod,
                paymentDate: new Date(payment.paymentDate as string | Date)
                  .toISOString()
                  .slice(0, 10),
                reference: payment.reference ?? '',
              }),
            ),
          };
        }),
      });
    }),
  );

  router.post(
    '/:organizationId/finance/payroll/generate',
    ...write,
    csrfProtection,
    asyncHandler(async (req, res) => {
      const ctx = context(res);
      const month = validMonth(body(req.body).month);
      const start = new Date(month + '-01T00:00:00.000Z');
      const end = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );
      const profileQuery: Record<string, unknown> = {
        organizationId: oid(ctx.organizationId),
      };
      if (ctx.campusIds.length)
        profileQuery.campusId = { $in: ctx.campusIds.map(oid) };
      const profiles = await PayrollSalaryProfileModel.find(profileQuery)
        .lean()
        .exec();
      const eligibleProfiles = profiles.flatMap((profile) => {
        const versions = [
          ...(profile.salaryHistory ?? []),
          {
            monthlySalary: profile.monthlySalary,
            effectiveFrom: profile.effectiveFrom,
            isActive: profile.isActive,
          },
        ]
          .filter((version) => new Date(version.effectiveFrom) <= end)
          .sort(
            (left, right) =>
              new Date(left.effectiveFrom).getTime() -
              new Date(right.effectiveFrom).getTime(),
          );
        const applicable = versions[versions.length - 1];
        return applicable?.isActive
          ? [{ profile, salary: money(applicable.monthlySalary) }]
          : [];
      });
      if (!eligibleProfiles.length)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'No active staff salary setup was found for this month.',
        );
      const staff = await StaffMemberModel.find({
        organizationId: oid(ctx.organizationId),
        _id: { $in: eligibleProfiles.map((item) => item.profile.staffId) },
        status: 'active',
      })
        .select('_id firstName lastName employeeCode campusId')
        .lean()
        .exec();
      if (!staff.length)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'No active staff members with salary setup were found for this month.',
        );
      const staffMap = new Map(staff.map((item) => [String(item._id), item]));
      let created: string[] = [];
      let skipped = 0;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const createdInTransaction: string[] = [];
          const existing = await PayrollMonthModel.find({
            organizationId: oid(ctx.organizationId),
            month,
            staffId: {
              $in: eligibleProfiles.map((item) => item.profile.staffId),
            },
          })
            .select('staffId')
            .session(session)
            .lean()
            .exec();
          const existingIds = new Set(
            existing.map((item) => String(item.staffId)),
          );
          skipped = existingIds.size;
          for (const { profile, salary } of eligibleProfiles) {
            const staffMember = staffMap.get(String(profile.staffId));
            if (!staffMember || existingIds.has(String(profile.staffId)))
              continue;
            const advances = await PayrollAdvanceModel.find({
              organizationId: oid(ctx.organizationId),
              staffId: profile.staffId,
              advanceDate: { $lte: end },
            })
              .sort({ advanceDate: 1, _id: 1 })
              .session(session)
              .lean()
              .exec();
            const outstanding = advances.reduce(
              (sum, item) =>
                sum +
                Math.max(0, money(item.amount) - money(item.adjustedAmount)),
              0,
            );
            const adjustment = Math.min(salary, outstanding);
            let remainingAdjustment = adjustment;
            for (const advance of advances) {
              const balance = Math.max(
                0,
                money(advance.amount) - money(advance.adjustedAmount),
              );
              const apply = Math.min(balance, remainingAdjustment);
              if (apply > 0) {
                await PayrollAdvanceModel.updateOne(
                  {
                    _id: advance._id,
                    organizationId: oid(ctx.organizationId),
                  },
                  {
                    $inc: {
                      adjustedAmount: mongoose.Types.Decimal128.fromString(
                        apply.toFixed(2),
                      ),
                    },
                  },
                  { session },
                ).exec();
                remainingAdjustment -= apply;
              }
              if (remainingAdjustment <= 0) break;
            }
            const [record] = await PayrollMonthModel.create(
              [
                {
                  organizationId: oid(ctx.organizationId),
                  staffId: profile.staffId,
                  campusId: staffMember.campusId ?? null,
                  month,
                  staffName: [staffMember.firstName, staffMember.lastName]
                    .filter(Boolean)
                    .join(' '),
                  employeeCode: staffMember.employeeCode,
                  grossSalary: mongoose.Types.Decimal128.fromString(
                    salary.toFixed(2),
                  ),
                  advanceAdjusted: mongoose.Types.Decimal128.fromString(
                    adjustment.toFixed(2),
                  ),
                  recordedBy: oid(ctx.userId),
                },
              ],
              { session },
            );
            createdInTransaction.push(String(record._id));
          }
          created = createdInTransaction;
        });
      } finally {
        await session.endSession();
      }
      res.status(201).json({ created: created.length, skipped });
    }),
  );

  router.post(
    '/:organizationId/finance/payroll/:payrollId/payments',
    ...write,
    csrfProtection,
    asyncHandler(async (req, res) => {
      const ctx = context(res);
      const payrollId = String(req.params.payrollId ?? '');
      if (!mongoose.isValidObjectId(payrollId))
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid payroll record.',
        );
      const input = body(req.body);
      const amount = validAmount(input.amount, 'payment amount');
      if (
        typeof input.paymentMethod !== 'string' ||
        !methods.includes(input.paymentMethod as (typeof methods)[number])
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid payment method.',
        );
      const paymentDate = validDate(input.paymentDate, 'payment date');
      const reference =
        typeof input.reference === 'string' ? input.reference.trim() : '';
      if (reference.length > 160)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Reference must be 160 characters or fewer.',
        );
      let result: {
        payrollId: string;
        paidAmount: number;
        pendingAmount: number;
        status: string;
      } | null = null;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const payroll = await PayrollMonthModel.findOne({
            _id: oid(payrollId),
            organizationId: oid(ctx.organizationId),
            ...(ctx.campusIds.length
              ? { campusId: { $in: ctx.campusIds.map(oid) } }
              : {}),
          })
            .session(session)
            .exec();
          if (!payroll)
            throw new AppError(404, 'NOT_FOUND', 'Payroll record not found.');
          const payable =
            money(payroll.grossSalary) - money(payroll.advanceAdjusted);
          const paid = money(payroll.paidAmount);
          if (amount > payable - paid + 0.0001)
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              'Payment cannot exceed the remaining salary balance.',
            );
          payroll.payments.push({
            amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
            paymentMethod: input.paymentMethod as (typeof methods)[number],
            paymentDate: new Date(paymentDate + 'T00:00:00.000Z'),
            reference,
            recordedBy: oid(ctx.userId),
          } as never);
          payroll.paidAmount = mongoose.Types.Decimal128.fromString(
            (paid + amount).toFixed(2),
          ) as never;
          payroll.status = paid + amount >= payable ? 'paid' : 'partial';
          await payroll.save({ session });
          await FinanceExpenseModel.create(
            [
              {
                organizationId: oid(ctx.organizationId),
                campusId: payroll.campusId ?? null,
                description: `Salary payment — ${payroll.staffName} — ${payroll.month}`,
                source: 'payroll',
                category: 'salaries',
                amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
                paymentMethod: input.paymentMethod,
                expenseDate: new Date(paymentDate + 'T00:00:00.000Z'),
                reference: reference || `Payroll ${payroll.month}`,
                recordedBy: oid(ctx.userId),
              },
            ],
            { session },
          );
          result = {
            payrollId,
            paidAmount: money(payroll.paidAmount),
            pendingAmount: Math.max(0, payable - money(payroll.paidAmount)),
            status: payroll.status,
          };
        });
      } finally {
        await session.endSession();
      }
      if (!result)
        throw new AppError(
          500,
          'PAYROLL_PAYMENT_FAILED',
          'Payment could not be saved.',
        );
      res.status(201).json(result);
    }),
  );

  router.get(
    '/:organizationId/finance/payroll/advances',
    ...read,
    asyncHandler(async (_req, res) => {
      const ctx = context(res);
      const query: Record<string, unknown> = {
        organizationId: oid(ctx.organizationId),
      };
      if (ctx.campusIds.length)
        query.campusId = { $in: ctx.campusIds.map(oid) };
      const records = await PayrollAdvanceModel.find(query)
        .sort({ advanceDate: -1 })
        .lean()
        .exec();
      res.json({
        items: records.map((item) => ({
          id: String(item._id),
          staffId: String(item.staffId),
          staffName: item.staffName,
          amount: money(item.amount),
          adjustedAmount: money(item.adjustedAmount),
          remainingAmount: Math.max(
            0,
            money(item.amount) - money(item.adjustedAmount),
          ),
          paymentMethod: item.paymentMethod,
          advanceDate: new Date(item.advanceDate).toISOString().slice(0, 10),
          reference: item.reference ?? '',
        })),
      });
    }),
  );

  router.post(
    '/:organizationId/finance/payroll/advances',
    ...write,
    csrfProtection,
    asyncHandler(async (req, res) => {
      const ctx = context(res);
      const input = body(req.body);
      const staffId = typeof input.staffId === 'string' ? input.staffId : '';
      if (!mongoose.isValidObjectId(staffId))
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid staff member.',
        );
      const amount = validAmount(input.amount, 'advance amount');
      if (
        typeof input.paymentMethod !== 'string' ||
        !methods.includes(input.paymentMethod as (typeof methods)[number])
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid payment method.',
        );
      const advanceDate = validDate(input.advanceDate, 'advance date');
      const reference =
        typeof input.reference === 'string' ? input.reference.trim() : '';
      if (reference.length > 160)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Reference must be 160 characters or fewer.',
        );
      const staff = await StaffMemberModel.findOne({
        _id: oid(staffId),
        organizationId: oid(ctx.organizationId),
        status: 'active',
      })
        .select('_id firstName lastName campusId')
        .lean()
        .exec();
      if (!staff)
        throw new AppError(404, 'NOT_FOUND', 'Active staff member not found.');
      if (
        ctx.campusIds.length &&
        (!staff.campusId || !ctx.campusIds.includes(String(staff.campusId)))
      )
        throw new AppError(
          403,
          'FORBIDDEN',
          'You do not have access to this staff member.',
        );
      const staffName = [staff.firstName, staff.lastName]
        .filter(Boolean)
        .join(' ');
      let advanceId = '';
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const [advance] = await PayrollAdvanceModel.create(
            [
              {
                organizationId: oid(ctx.organizationId),
                staffId: oid(staffId),
                campusId: staff.campusId ?? null,
                staffName,
                amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
                paymentMethod: input.paymentMethod,
                advanceDate: new Date(advanceDate + 'T00:00:00.000Z'),
                reference,
                recordedBy: oid(ctx.userId),
              },
            ],
            { session },
          );
          await FinanceExpenseModel.create(
            [
              {
                organizationId: oid(ctx.organizationId),
                campusId: staff.campusId ?? null,
                description: `Salary advance — ${staffName}`,
                source: 'payroll',
                category: 'salaries',
                amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
                paymentMethod: input.paymentMethod,
                expenseDate: new Date(advanceDate + 'T00:00:00.000Z'),
                reference: reference || `Advance ${String(advance._id)}`,
                recordedBy: oid(ctx.userId),
              },
            ],
            { session },
          );
          advanceId = String(advance._id);
        });
      } finally {
        await session.endSession();
      }
      if (!advanceId)
        throw new AppError(
          500,
          'PAYROLL_ADVANCE_FAILED',
          'Advance could not be saved.',
        );
      res.status(201).json({
        id: advanceId,
        staffId,
        staffName,
        amount,
        remainingAmount: amount,
      });
    }),
  );

  return router;
}

export const payrollRouter = createPayrollRouter();
