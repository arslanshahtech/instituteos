import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { createAuthenticationMiddleware } from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationPermission,
} from '../tenancy/tenant-context.middleware.js';
import { MongoReportingRepository } from './reporting.repository.js';
import { ReportingService } from './reporting.service.js';
import type { AuditLogQuery, ReportType } from './reporting.types.js';

interface ReportingContext {
  organizationId: string;
  campusIds: string[];
  role: string;
}

function reportingContext(response: {
  locals?: { organizationContext?: ReportingContext };
}): ReportingContext {
  const context = response.locals?.organizationContext;
  if (!context) {
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  }
  return context;
}

function queryText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function queryCampusId(value: unknown): string | undefined {
  const id = queryText(value, 'campus');
  if (id && !mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid campus.');
  }
  return id;
}

function queryInteger(
  value: unknown,
  field: string,
  defaultValue: number,
  max: number,
): number {
  if (value === undefined) return defaultValue;
  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > max
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return Number(value);
}

function allowedCampuses(context: ReportingContext): string[] | undefined {
  return context.role === 'campus_admin' || context.campusIds.length > 0
    ? context.campusIds
    : undefined;
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

export function createReportingRouter(
  service = new ReportingService(new MongoReportingRepository()),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const readReporting = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('reporting.read'),
  ] as const;
  const readAudit = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('audit.read'),
  ] as const;
  const reportsBase = '/:organizationId/reports';
  const auditBase = '/:organizationId/audit-logs';

  router.get(
    `${reportsBase}/summary`,
    ...readReporting,
    asyncHandler(async (request, response) => {
      const context = reportingContext(response);
      const campusId = queryCampusId(request.query.campusId);
      const campusIds = allowedCampuses(context);
      if (campusId && campusIds && !campusIds.includes(campusId)) {
        throw new AppError(
          403,
          'CAMPUS_FORBIDDEN',
          'You are not authorized for this campus.',
        );
      }
      response.status(200).json({
        summary: await service.getOrganizationSummary(
          context.organizationId,
          campusId ? [campusId] : campusIds,
        ),
      });
    }),
  );

  router.get(
    `${reportsBase}/:reportType/export`,
    ...readReporting,
    (request, response, next) => {
      if (request.params.reportType !== 'finance') return next();
      return requireOrganizationPermission('finance.read')(
        request,
        response,
        next,
      );
    },
    asyncHandler(async (request, response) => {
      const context = reportingContext(response);
      const reportType = request.params.reportType as ReportType;
      const campusId = queryCampusId(request.query.campusId);
      const campusIds = allowedCampuses(context);
      if (campusId && campusIds && !campusIds.includes(campusId)) {
        throw new AppError(
          403,
          'CAMPUS_FORBIDDEN',
          'You are not authorized for this campus.',
        );
      }
      const rows = await service.exportReportData(
        context.organizationId,
        reportType,
        campusIds,
        campusId,
      );
      response.status(200).json({ reportType, rows });
    }),
  );

  router.get(
    auditBase,
    ...readAudit,
    asyncHandler(async (request, response) => {
      const context = reportingContext(response);
      const query: AuditLogQuery = {
        page: queryInteger(
          request.query.page,
          'page',
          1,
          Number.MAX_SAFE_INTEGER,
        ),
        pageSize: queryInteger(request.query.pageSize, 'page size', 20, 100),
        action: queryText(request.query.action, 'action'),
        entityType: queryText(request.query.entityType, 'entity type'),
        dateFrom: queryText(request.query.dateFrom, 'start date'),
        dateTo: queryText(request.query.dateTo, 'end date'),
        campusId: queryCampusId(request.query.campusId),
        campusIds: allowedCampuses(context),
      };
      const result = await service.listAuditLogs(context.organizationId, query);
      response.status(200).json({
        items: result.items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / query.pageSize!),
        },
      });
    }),
  );

  return router;
}

export const reportingRouter = createReportingRouter();
