import { Router } from 'express';
import mongoose from 'mongoose';
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
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationPermission,
} from '../tenancy/tenant-context.middleware.js';
import { FinanceService } from './finance.service.js';
import { MongoFinanceRepository } from './finance.repository.js';
import type {
  FeeStructureInput,
  FinanceContext,
  InvoiceQuery,
  InvoiceStatus,
  PaymentInput,
  PaymentMethod,
  FeeConcessionInput,
  ConcessionType,
  DiscountType,
} from './finance.types.js';

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid JSON object is required.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, max = 160) {
  if (value === undefined || value === '') return undefined;
  return text(value, field, max);
}

function objectId(value: unknown, field: string): string {
  const id = text(value, field, 24);
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return id;
}

function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field} amount.`);
  }
  return value;
}

function date(value: unknown, field: string): string {
  return text(value, field, 10);
}

function feeStructureInput(body: Record<string, unknown>): FeeStructureInput {
  if (!Array.isArray(body.feeHeads)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter valid fee heads.');
  }
  return {
    name: text(body.name, 'fee structure name', 120),
    academicYearId: objectId(body.academicYearId, 'academic year'),
    classId: objectId(body.classId, 'class'),
    campusId: objectId(body.campusId, 'campus'),
    feeHeads: body.feeHeads.map((value) => {
      const head = bodyObject(value);
      if (typeof head.isOptional !== 'boolean') {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Each fee head must be marked required or optional.',
        );
      }
      return {
        title: text(head.title, 'fee head title', 100),
        amount: amount(head.amount, 'fee head'),
        isOptional: head.isOptional,
      };
    }),
  };
}

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
      userId: string;
    };
  };
}): FinanceContext {
  const context = response.locals?.organizationContext;
  if (!context) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }
  return {
    organizationId: context.organizationId,
    campusIds: context.campusIds ?? [],
    role: context.role ?? '',
    userId: context.userId,
  };
}

function queryId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  return objectId(value, field);
}

function invoiceQuery(query: Record<string, unknown>): InvoiceQuery {
  const status = query.status;
  if (
    status !== undefined &&
    status !== 'unpaid' &&
    status !== 'partial' &&
    status !== 'paid' &&
    status !== 'overdue'
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid invoice status.');
  }
  return {
    campusId: queryId(query.campusId, 'campus'),
    classId: queryId(query.classId, 'class'),
    studentId: queryId(query.studentId, 'student'),
    status: status as InvoiceStatus | undefined,
    dateFrom:
      query.dateFrom === undefined
        ? undefined
        : date(query.dateFrom, 'start date'),
    dateTo:
      query.dateTo === undefined ? undefined : date(query.dateTo, 'end date'),
  };
}

function paymentInput(body: Record<string, unknown>): PaymentInput {
  const method = body.paymentMethod;
  if (
    method !== 'cash' &&
    method !== 'bank_transfer' &&
    method !== 'card' &&
    method !== 'online'
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid payment method.');
  }
  return {
    amountPaid: amount(body.amountPaid, 'payment'),
    paymentMethod: method as PaymentMethod,
    paymentDate: date(body.paymentDate, 'payment date'),
    ...(optionalText(body.transactionReference, 'transaction reference')
      ? { transactionReference: text(body.transactionReference, 'transaction reference') }
      : {}),
  };
}

function feeConcessionInput(body: Record<string, unknown>): FeeConcessionInput {
  const concessionType = text(body.concessionType, 'concession type', 40);
  const discountType = text(body.discountType, 'discount type', 20);

  if (
    concessionType !== 'sibling' &&
    concessionType !== 'staff_child' &&
    concessionType !== 'scholarship' &&
    concessionType !== 'need_based' &&
    concessionType !== 'special'
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid concession type.');
  }

  if (discountType !== 'percentage' && discountType !== 'fixed') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid discount type.');
  }

  return {
    studentId: objectId(body.studentId, 'student'),
    academicYearId: body.academicYearId ? objectId(body.academicYearId, 'academic year') : undefined,
    concessionType: concessionType as ConcessionType,
    discountType: discountType as DiscountType,
    discountValue: amount(body.discountValue, 'discount value'),
    reason: optionalText(body.reason, 'reason', 160),
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
  };
}

function defaultAuthenticate() {
  const authService = new AuthService(
    new MongoAuthRepository(),
    authEmailDelivery,
    {
      sessionTtlDays: env.authSessionTtlDays,
      requireEmailVerification: env.authRequireEmailVerification,
      webAppUrl: env.authWebAppUrl,
    },
  );
  return createAuthenticationMiddleware(authService);
}

export function createFinanceRouter(
  service = new FinanceService(new MongoFinanceRepository()),
  accessRepository: OrganizationAccessRepository =
    new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const base = '/:organizationId/finance';
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const read = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('finance.read'),
  ] as const;
  const write = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('finance.write'),
  ] as const;

  router.get(
    `${base}/fee-structures`,
    ...read,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        items: await service.listFeeStructures(organizationContext(response)),
      });
    }),
  );
  router.post(
    `${base}/fee-structures`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(201).json({
        feeStructure: await service.createFeeStructure(
          organizationContext(response),
          feeStructureInput(bodyObject(request.body)),
        ),
      });
    }),
  );
  router.put(
    `${base}/fee-structures/:feeStructureId`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const id = objectId(request.params.feeStructureId, 'fee structure');
      response.status(200).json({
        feeStructure: await service.updateFeeStructure(
          organizationContext(response),
          id,
          feeStructureInput(bodyObject(request.body)),
        ),
      });
    }),
  );
  router.delete(
    `${base}/fee-structures/:feeStructureId`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const id = objectId(request.params.feeStructureId, 'fee structure');
      await service.deleteFeeStructure(organizationContext(response), id);
      response.status(204).end();
    }),
  );
  router.get(
    `${base}/invoices`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listInvoices(
          organizationContext(response),
          invoiceQuery(request.query as Record<string, unknown>),
        ),
      });
    }),
  );
  router.post(
    `${base}/invoices/generate`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      response.status(201).json(
        await service.generateInvoices(organizationContext(response), {
          classId: objectId(body.classId, 'class'),
          academicYearId: objectId(body.academicYearId, 'academic year'),
          feeStructureId: objectId(body.feeStructureId, 'fee structure'),
          dueDate: date(body.dueDate, 'due date'),
          billingCycle: text(body.billingCycle, 'billing cycle', 60),
        }),
      );
    }),
  );
  router.post(
    `${base}/invoices/:invoiceId/payments`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const invoiceId = objectId(request.params.invoiceId, 'invoice');
      response.status(201).json(
        await service.recordPayment(
          organizationContext(response),
          invoiceId,
          paymentInput(bodyObject(request.body)),
        ),
      );
    }),
  );

  router.get(
    `${base}/students/:studentId/ledger`,
    ...read,
    asyncHandler(async (request, response) => {
      const studentId = objectId(request.params.studentId, 'student');
      response.status(200).json(
        await service.getStudentFeeLedger(
          organizationContext(response),
          studentId,
        ),
      );
    }),
  );
  
  router.get(
    `${base}/students/:studentId/concessions`,
    ...read,
    asyncHandler(async (request, response) => {
      const studentId = objectId(request.params.studentId, 'student');
      const academicYearId = queryId(request.query.academicYearId, 'academic year');
      response.status(200).json({
        items: await service.listStudentConcessions(
          organizationContext(response),
          studentId,
          academicYearId,
        ),
      });
    }),
  );

  router.post(
    `${base}/concessions`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const input = feeConcessionInput(bodyObject(request.body));
      const concessionId = request.body && typeof request.body === 'object' && 'id' in request.body
        ? optionalText((request.body as Record<string, unknown>).id, 'concession id', 24)
        : undefined;

      response.status(201).json({
        concession: await service.saveFeeConcession(
          organizationContext(response),
          input,
          concessionId,
        ),
      });
    }),
  );

  router.delete(
    `${base}/concessions/:concessionId`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const concessionId = objectId(request.params.concessionId, 'concession');
      await service.deleteFeeConcession(organizationContext(response), concessionId);
      response.status(204).end();
    }),
  );

  router.post(
    `${base}/invoices/:invoiceId/delete-otp`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const invoiceId = objectId(request.params.invoiceId, 'invoice');
      response.status(200).json(
        await service.requestInvoiceDeleteOtp(
          organizationContext(response),
          invoiceId,
        ),
      );
    }),
  );

  router.delete(
    `${base}/invoices/:invoiceId`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const invoiceId = objectId(request.params.invoiceId, 'invoice');
      const otpCode = optionalText(request.query.otp, 'OTP code', 12);
      await service.deleteInvoice(
        organizationContext(response),
        invoiceId,
        otpCode,
      );
      response.status(204).end();
    }),
  );

  router.patch(
    `${base}/invoices/:invoiceId/discount`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const invoiceId = objectId(request.params.invoiceId, 'invoice');
      const body = bodyObject(request.body);
      if (typeof body.applyDiscount !== 'boolean') {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Specify whether to apply or remove the discount.',
        );
      }
      response.status(200).json({
        invoice: await service.setInvoiceDiscount(
          organizationContext(response),
          invoiceId,
          body.applyDiscount,
        ),
      });
    }),
  );

  return router;
}

export const financeRouter = createFinanceRouter();
