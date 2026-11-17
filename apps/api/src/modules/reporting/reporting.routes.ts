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
import { MongoReportingRepository } from './reporting.repository.js';
import { ReportingService } from './reporting.service.js';
import {
  DataTransferHistoryModel,
  DATA_TRANSFER_TYPES,
} from './data-transfer.model.js';
import type { DataTransferType } from './data-transfer.model.js';
import type { AuditLogQuery, ReportType } from './reporting.types.js';
import type { OrganizationPermission } from '../tenancy/authorization.js';

interface ReportingContext {
  organizationId: string;
  campusIds: string[];
  role: string;
  userId?: string;
  permissions?: readonly string[];
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
  const transferHistoryBase = '/:organizationId/reports/transfer-history';

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
      const summary = await service.getOrganizationSummary(
        context.organizationId,
        campusId ? [campusId] : campusIds,
      );
      if (!context.permissions?.includes('finance.read')) {
        summary.finance = {
          totalInvoiced: '0.00',
          totalCollected: '0.00',
          totalPending: '0.00',
          totalOverdue: '0.00',
        };
      }
      response.status(200).json({ summary });
    }),
  );

  router.get(
    transferHistoryBase,
    ...readReporting,
    asyncHandler(async (_request, response) => {
      const context = reportingContext(response);
      const campusIds = allowedCampuses(context);
      const readPermissions: Record<DataTransferType, string[]> = {
        students: ['student.read', 'student.create'],
        staff: ['staff.read', 'staff.create'],
        classes: ['academics.read', 'academics.write'],
        sections: ['academics.read', 'academics.write'],
        subjects: ['academics.read', 'academics.write'],
        attendance: ['attendance.read'],
        finance: ['finance.read'],
        payments: ['finance.read'],
        expenses: ['finance.read'],
        payroll: ['finance.read'],
        advances: ['finance.read'],
        exams: ['academics.read'],
        results: ['academics.read'],
        admissions: ['admission.read'],
        'admission-inquiries': ['admission.read'],
        organization: ['organization.read'],
        audit: ['audit.read'],
      };
      const visibleTypes = DATA_TRANSFER_TYPES.filter((type) =>
        readPermissions[type].some((permission) =>
          context.permissions?.includes(permission),
        ),
      );
      const items = await DataTransferHistoryModel.find({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        dataType: { $in: visibleTypes },
        ...(campusIds
          ? {
              campusId: {
                $in: campusIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            }
          : {}),
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(50)
        .lean();
      response.status(200).json({
        items: items.map((item) => ({
          id: String(item._id),
          direction: item.direction,
          dataType: item.dataType,
          format: item.format,
          fileName: item.fileName,
          status: item.status,
          totalRows: item.totalRows,
          createdRows: item.createdRows,
          skippedRows: item.skippedRows,
          failedRows: item.failedRows,
          ...(item.campusId ? { campusId: String(item.campusId) } : {}),
          createdAt: item.createdAt.toISOString(),
        })),
      });
    }),
  );

  router.post(
    transferHistoryBase,
    authenticate,
    resolveOrganization,
    csrfProtection,
    (request, response, next) => {
      const body = request.body as Record<string, unknown> | null;
      const direction = body?.direction;
      const dataType = body?.dataType;
      if (
        (direction !== 'import' && direction !== 'export') ||
        typeof dataType !== 'string' ||
        !DATA_TRANSFER_TYPES.includes(dataType as DataTransferType)
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid import or export type.',
        );
      }
      const importPermissions: Partial<
        Record<DataTransferType, OrganizationPermission>
      > = {
        students: 'student.create',
        staff: 'staff.create',
        classes: 'academics.write',
        sections: 'academics.write',
        subjects: 'academics.write',
      };
      const exportPermissions: Record<
        DataTransferType,
        OrganizationPermission
      > = {
        students: 'student.read',
        staff: 'staff.read',
        classes: 'academics.read',
        sections: 'academics.read',
        subjects: 'academics.read',
        attendance: 'attendance.read',
        finance: 'finance.read',
        payments: 'finance.read',
        expenses: 'finance.read',
        payroll: 'finance.read',
        advances: 'finance.read',
        exams: 'academics.read',
        results: 'academics.read',
        admissions: 'admission.read',
        'admission-inquiries': 'admission.read',
        organization: 'organization.read',
        audit: 'audit.read',
      };
      const permission =
        direction === 'import'
          ? importPermissions[dataType as DataTransferType]
          : exportPermissions[dataType as DataTransferType];
      if (!permission)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'This data type cannot be imported.',
        );
      return requireOrganizationPermission(permission)(request, response, next);
    },
    asyncHandler(async (request, response) => {
      const context = reportingContext(response);
      if (!context.userId)
        throw new AppError(
          401,
          'UNAUTHENTICATED',
          'Your session could not be verified.',
        );
      const body = request.body as Record<string, unknown>;
      const dataType = body.dataType as DataTransferType;
      const direction = body.direction as 'import' | 'export';
      const format = body.format;
      if (!['xlsx', 'csv', 'pdf', 'json'].includes(String(format))) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid file format.',
        );
      }
      const rawName =
        typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const fileName = rawName
        .replaceAll(String.fromCharCode(92), '_')
        .replaceAll('/', '_')
        // eslint-disable-next-line no-control-regex -- Remove control characters from user-supplied filenames.
        .replace(/[\u0000-\u001f]/g, '')
        .slice(0, 255);
      if (!fileName)
        throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid file name.');
      const count = (value: unknown, field: string) => {
        if (
          !Number.isInteger(value) ||
          Number(value) < 0 ||
          Number(value) > 1000000
        ) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Enter a valid ' + field + '.',
          );
        }
        return Number(value);
      };
      const totalRows = count(body.totalRows, 'total row count');
      const createdRows = count(body.createdRows ?? 0, 'successful row count');
      const skippedRows = count(body.skippedRows ?? 0, 'skipped row count');
      const failedRows = count(body.failedRows ?? 0, 'failed row count');
      if (createdRows + skippedRows + failedRows > totalRows) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Transfer result counts cannot exceed the total rows.',
        );
      }
      const campusId = queryCampusId(body.campusId);
      const campusIds = allowedCampuses(context);
      if (campusId && campusIds && !campusIds.includes(campusId)) {
        throw new AppError(
          403,
          'CAMPUS_FORBIDDEN',
          'You are not authorized for this campus.',
        );
      }
      const status =
        failedRows > 0
          ? createdRows > 0
            ? 'partial'
            : 'failed'
          : skippedRows > 0
            ? 'partial'
            : 'completed';
      const item = await DataTransferHistoryModel.create({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        campusId: campusId ? new mongoose.Types.ObjectId(campusId) : null,
        actorId: new mongoose.Types.ObjectId(context.userId),
        direction,
        dataType,
        format,
        fileName,
        status,
        totalRows,
        createdRows,
        skippedRows,
        failedRows,
      });
      response.status(201).json({
        item: {
          id: String(item._id),
          direction: item.direction,
          dataType: item.dataType,
          format: item.format,
          fileName: item.fileName,
          status: item.status,
          totalRows: item.totalRows,
          createdRows: item.createdRows,
          skippedRows: item.skippedRows,
          failedRows: item.failedRows,
          createdAt: item.createdAt.toISOString(),
        },
      });
    }),
  );

  router.get(
    `${reportsBase}/:reportType/export`,
    ...readReporting,
    (request, response, next) => {
      const type = String(request.params.reportType ?? '');
      const permissionByType: Partial<
        Record<ReportType, OrganizationPermission>
      > = {
        students: 'student.read',
        staff: 'staff.read',
        attendance: 'attendance.read',
        finance: 'finance.read',
        payments: 'finance.read',
        expenses: 'finance.read',
        payroll: 'finance.read',
        advances: 'finance.read',
        classes: 'academics.read',
        sections: 'academics.read',
        subjects: 'academics.read',
        exams: 'academics.read',
        results: 'academics.read',
        admissions: 'admission.read',
        'admission-inquiries': 'admission.read',
        organization: 'organization.read',
        audit: 'audit.read',
      };
      const permission = permissionByType[type as ReportType];
      return permission
        ? requireOrganizationPermission(permission)(request, response, next)
        : next();
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
      const dateFrom = queryText(request.query.dateFrom, 'start date');
      const dateTo = queryText(request.query.dateTo, 'end date');
      const rows = await service.exportReportData(
        context.organizationId,
        reportType,
        campusIds,
        { campusId, dateFrom, dateTo },
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
