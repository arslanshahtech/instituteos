import { Router } from 'express';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { env } from '../../config/env.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireAssignedCampusScope,
  requireOrganizationPermission,
} from '../tenancy/tenant-context.middleware.js';
import { MongoPeopleRepository } from './people.repository.js';
import { PeopleService } from './people.service.js';

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  }
  return value as Record<string, unknown>;
}

function requiredString(
  body: Record<string, unknown>,
  field: string,
  min = 1,
  max = 160,
): string {
  const value = body[field];
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function optionalString(
  body: Record<string, unknown>,
  field: string,
  max = 160,
): string | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value !== 'string' ||
    value.trim().length < 1 ||
    value.trim().length > max
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function optionalEmail(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  }
  return normalized;
}

function guardianRelationship(
  value: unknown,
  fallback?: 'father' | 'mother' | 'guardian' | 'other',
): 'father' | 'mother' | 'guardian' | 'other' | undefined {
  if (value === undefined) return fallback;
  if (
    value === 'father' ||
    value === 'mother' ||
    value === 'guardian' ||
    value === 'other'
  )
    return value;
  throw new AppError(
    400,
    'VALIDATION_ERROR',
    'Select a valid guardian relationship.',
  );
}

function communicationPreference(
  value: unknown,
): 'sms' | 'email' | 'both' | undefined {
  if (value === undefined) return undefined;
  if (value === 'sms' || value === 'email' || value === 'both') return value;
  throw new AppError(
    400,
    'VALIDATION_ERROR',
    'Select a valid communication preference.',
  );
}

function routeParameter(
  request: { params: Record<string, string | string[] | undefined> },
  name: string,
): string {
  const value = request.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
    };
  };
}): {
  organizationId: string;
  campusIds?: string[];
  role?: string;
} {
  const context = response.locals?.organizationContext;
  if (!context)
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  return context;
}

function defaultAuthenticate() {
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

export function createPeopleRouter(
  service: PeopleService = new PeopleService(new MongoPeopleRepository()),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);

  router.get(
    '/:organizationId/students',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (request, response) => {
      const body = request.query ?? {};
      const search = typeof body.search === 'string' ? body.search : undefined;
      const status = typeof body.status === 'string' ? body.status : undefined;
      const page =
        typeof body.page === 'string' ? Number(body.page) : undefined;
      const pageSize =
        typeof body.pageSize === 'string' ? Number(body.pageSize) : undefined;
      const result = await service.listStudents(organizationContext(response), {
        search,
        status: status as 'active' | 'inactive' | 'withdrawn' | undefined,
        page,
        pageSize,
      });
      response.status(200).json(result);
    }),
  );

  router.post(
    '/:organizationId/students',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.create'),
    requireAssignedCampusScope('campusId'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const student = await service.createStudent(
        organizationContext(response).organizationId,
        {
          firstName: requiredString(body, 'firstName', 2, 80),
          lastName: requiredString(body, 'lastName', 2, 80),
          preferredName: optionalString(body, 'preferredName', 80),
          dateOfBirth: body.dateOfBirth ? String(body.dateOfBirth) : undefined,
          gender: optionalString(body, 'gender', 40),
          status:
            body.status === 'inactive' ||
            body.status === 'withdrawn' ||
            body.status === 'active'
              ? (String(body.status) as 'active' | 'inactive' | 'withdrawn')
              : undefined,
          contactEmail: optionalEmail(body.contactEmail),
          phone: optionalString(body, 'phone', 40),
          campusId:
            typeof body.campusId === 'string' ? body.campusId : undefined,
          address:
            typeof body.address === 'object' && body.address !== null
              ? (body.address as Record<string, unknown>)
              : undefined,
          emergencyContact:
            typeof body.emergencyContact === 'object' &&
            body.emergencyContact !== null
              ? (body.emergencyContact as Record<string, unknown>)
              : undefined,
          academicHistory: Array.isArray(body.academicHistory)
            ? (body.academicHistory as Array<Record<string, unknown>>)
            : undefined,
        },
        organizationContext(response),
      );
      response.status(201).json({ student });
    }),
  );

  router.get(
    '/:organizationId/students/:studentId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (request, response) => {
      const student = await service.getStudent(
        organizationContext(response).organizationId,
        routeParameter(request, 'studentId'),
        organizationContext(response),
      );
      response.status(200).json({ student });
    }),
  );

  router.patch(
    '/:organizationId/students/:studentId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const student = await service.updateStudent(
        organizationContext(response).organizationId,
        routeParameter(request, 'studentId'),
        {
          firstName:
            body.firstName !== undefined ? String(body.firstName) : undefined,
          lastName:
            body.lastName !== undefined ? String(body.lastName) : undefined,
          preferredName:
            body.preferredName !== undefined
              ? String(body.preferredName)
              : undefined,
          dateOfBirth:
            body.dateOfBirth !== undefined
              ? String(body.dateOfBirth)
              : undefined,
          gender: body.gender !== undefined ? String(body.gender) : undefined,
          status:
            body.status === 'active' ||
            body.status === 'inactive' ||
            body.status === 'withdrawn'
              ? (String(body.status) as 'active' | 'inactive' | 'withdrawn')
              : undefined,
          contactEmail:
            body.contactEmail !== undefined
              ? optionalEmail(body.contactEmail)
              : undefined,
          phone: body.phone !== undefined ? String(body.phone) : undefined,
          campusId:
            typeof body.campusId === 'string' ? body.campusId : undefined,
          address:
            body.address !== undefined && typeof body.address === 'object'
              ? (body.address as Record<string, unknown>)
              : undefined,
          emergencyContact:
            body.emergencyContact !== undefined &&
            typeof body.emergencyContact === 'object'
              ? (body.emergencyContact as Record<string, unknown>)
              : undefined,
          academicHistory: Array.isArray(body.academicHistory)
            ? (body.academicHistory as Array<Record<string, unknown>>)
            : undefined,
        },
        organizationContext(response),
      );
      response.status(200).json({ student });
    }),
  );

  router.get(
    '/:organizationId/guardians',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('guardian.read'),
    asyncHandler(async (request, response) => {
      const query = request.query ?? {};
      const result = await service.listGuardians(
        organizationContext(response),
        {
          search: typeof query.search === 'string' ? query.search : undefined,
          page: typeof query.page === 'string' ? Number(query.page) : undefined,
          pageSize:
            typeof query.pageSize === 'string'
              ? Number(query.pageSize)
              : undefined,
        },
      );
      response.status(200).json(result);
    }),
  );

  router.post(
    '/:organizationId/guardians',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('guardian.create'),
    (request, response, next) => {
      const body = bodyObject(request.body);
      if (body.studentId !== undefined)
        return requireOrganizationPermission('student.update')(
          request,
          response,
          next,
        );
      return next();
    },
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const guardian = await service.createGuardian(
        organizationContext(response).organizationId,
        {
          firstName: requiredString(body, 'firstName', 2, 80),
          lastName: requiredString(body, 'lastName', 2, 80),
          relationship: guardianRelationship(body.relationship),
          phone: optionalString(body, 'phone', 40),
          email: optionalEmail(body.email),
          communicationPreference: communicationPreference(
            body.communicationPreference,
          ),
          address:
            typeof body.address === 'object' && body.address !== null
              ? (body.address as Record<string, unknown>)
              : undefined,
        },
        organizationContext(response),
        body.studentId === undefined
          ? undefined
          : requiredString(body, 'studentId', 12, 24),
      );
      response.status(201).json({ guardian });
    }),
  );

  router.get(
    '/:organizationId/guardians/:guardianId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('guardian.read'),
    asyncHandler(async (request, response) => {
      const result = await service.getGuardian(
        organizationContext(response),
        routeParameter(request, 'guardianId'),
      );
      response.status(200).json(result);
    }),
  );

  router.patch(
    '/:organizationId/guardians/:guardianId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('guardian.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const changes = {
        firstName:
          body.firstName !== undefined
            ? requiredString(body, 'firstName', 2, 80)
            : undefined,
        lastName:
          body.lastName !== undefined
            ? requiredString(body, 'lastName', 2, 80)
            : undefined,
        relationship: guardianRelationship(body.relationship),
        phone:
          body.phone !== undefined
            ? typeof body.phone === 'string'
              ? body.phone.trim().slice(0, 40)
              : optionalString(body, 'phone', 40)
            : undefined,
        email:
          body.email !== undefined
            ? body.email === ''
              ? ''
              : optionalEmail(body.email)
            : undefined,
        communicationPreference: communicationPreference(
          body.communicationPreference,
        ),
        address:
          body.address !== undefined && typeof body.address === 'object'
            ? (body.address as Record<string, unknown>)
            : undefined,
      };
      const guardian = await service.updateGuardian(
        organizationContext(response),
        routeParameter(request, 'guardianId'),
        changes,
      );
      response.status(200).json({ guardian });
    }),
  );

  router.get(
    '/:organizationId/students/:studentId/guardians',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    requireOrganizationPermission('guardian.read'),
    asyncHandler(async (request, response) => {
      const relations = await service.listStudentGuardians(
        organizationContext(response),
        routeParameter(request, 'studentId'),
      );
      response.status(200).json({ relations });
    }),
  );

  router.delete(
    '/:organizationId/students/:studentId/guardians/:guardianId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.update'),
    requireOrganizationPermission('guardian.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.unlinkGuardianFromStudent(
        organizationContext(response),
        routeParameter(request, 'studentId'),
        routeParameter(request, 'guardianId'),
      );
      response.status(204).end();
    }),
  );

  router.post(
    '/:organizationId/guardians/:guardianId/links',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('guardian.update'),
    requireOrganizationPermission('student.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const link = await service.linkGuardianToStudent(
        organizationContext(response),
        {
          studentId: requiredString(body, 'studentId', 12, 24),
          guardianId: routeParameter(request, 'guardianId'),
          relationship:
            guardianRelationship(body.relationship, 'guardian') ?? 'guardian',
          isPrimary: body.isPrimary === true,
        },
      );
      response.status(201).json({ link });
    }),
  );

  router.get(
    '/:organizationId/staff',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('staff.read'),
    asyncHandler(async (request, response) => {
      const query = request.query ?? {};
      const result = await service.listStaff(
        organizationContext(response).organizationId,
        {
          status: typeof query.status === 'string' ? query.status : undefined,
          department:
            typeof query.department === 'string' ? query.department : undefined,
          page: typeof query.page === 'string' ? Number(query.page) : undefined,
          pageSize:
            typeof query.pageSize === 'string'
              ? Number(query.pageSize)
              : undefined,
        },
      );
      response.status(200).json(result);
    }),
  );

  router.post(
    '/:organizationId/staff',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('staff.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const staff = await service.createStaff(
        organizationContext(response).organizationId,
        {
          firstName: requiredString(body, 'firstName', 2, 80),
          lastName: requiredString(body, 'lastName', 2, 80),
          department: optionalString(body, 'department', 100),
          qualification: optionalString(body, 'qualification', 240),
          status:
            body.status === 'active' ||
            body.status === 'on_leave' ||
            body.status === 'inactive'
              ? (String(body.status) as 'active' | 'on_leave' | 'inactive')
              : undefined,
          role: optionalString(body, 'role', 80),
          email: optionalEmail(body.email),
          phone: optionalString(body, 'phone', 40),
          campusId:
            typeof body.campusId === 'string' ? body.campusId : undefined,
        },
      );
      response.status(201).json({ staff });
    }),
  );

  router.patch(
    '/:organizationId/staff/:staffId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('staff.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const staff = await service.updateStaff(
        organizationContext(response).organizationId,
        routeParameter(request, 'staffId'),
        {
          firstName:
            body.firstName !== undefined ? String(body.firstName) : undefined,
          lastName:
            body.lastName !== undefined ? String(body.lastName) : undefined,
          department:
            body.department !== undefined ? String(body.department) : undefined,
          qualification:
            body.qualification !== undefined
              ? String(body.qualification)
              : undefined,
          role: body.role !== undefined ? String(body.role) : undefined,
          status:
            body.status === 'active' ||
            body.status === 'on_leave' ||
            body.status === 'inactive'
              ? (String(body.status) as 'active' | 'on_leave' | 'inactive')
              : undefined,
          email:
            body.email !== undefined ? optionalEmail(body.email) : undefined,
          phone: body.phone !== undefined ? String(body.phone) : undefined,
          campusId:
            typeof body.campusId === 'string' ? body.campusId : undefined,
        },
      );
      response.status(200).json({ staff });
    }),
  );

  router.get(
    '/:organizationId/admissions',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('admission.read'),
    asyncHandler(async (request, response) => {
      const query = request.query ?? {};
      const inquiries = await service.listInquiries(
        organizationContext(response).organizationId,
        {
          status:
            typeof query.inquiryStatus === 'string'
              ? (query.inquiryStatus as
                  'new' | 'contacted' | 'qualified' | 'converted')
              : undefined,
          page: typeof query.page === 'string' ? Number(query.page) : undefined,
          pageSize:
            typeof query.pageSize === 'string'
              ? Number(query.pageSize)
              : undefined,
        },
      );
      const applications = await service.listApplications(
        organizationContext(response).organizationId,
        {
          status:
            typeof query.applicationStatus === 'string'
              ? (query.applicationStatus as
                  | 'draft'
                  | 'submitted'
                  | 'in_review'
                  | 'approved'
                  | 'rejected'
                  | 'admitted')
              : undefined,
          page: typeof query.page === 'string' ? Number(query.page) : undefined,
          pageSize:
            typeof query.pageSize === 'string'
              ? Number(query.pageSize)
              : undefined,
        },
      );
      response.status(200).json({ inquiries, applications });
    }),
  );

  router.post(
    '/:organizationId/admissions/inquiries',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('admission.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const inquiry = await service.createInquiry(
        organizationContext(response).organizationId,
        {
          firstName: requiredString(body, 'firstName', 2, 80),
          lastName: requiredString(body, 'lastName', 2, 80),
          email: optionalEmail(body.email),
          phone: optionalString(body, 'phone', 40),
          source: optionalString(body, 'source', 80),
          notes: optionalString(body, 'notes', 1000),
          campusId:
            typeof body.campusId === 'string' ? body.campusId : undefined,
        },
      );
      response.status(201).json({ inquiry });
    }),
  );

  router.post(
    '/:organizationId/admissions/applications',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('admission.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const application = await service.createApplication(
        organizationContext(response).organizationId,
        {
          inquiryId:
            typeof body.inquiryId === 'string' ? body.inquiryId : undefined,
          firstName: requiredString(body, 'firstName', 2, 80),
          lastName: requiredString(body, 'lastName', 2, 80),
          email: optionalEmail(body.email),
          phone: optionalString(body, 'phone', 40),
          source: optionalString(body, 'source', 80),
          preferredCampusId:
            typeof body.preferredCampusId === 'string'
              ? body.preferredCampusId
              : undefined,
          program: optionalString(body, 'program', 120),
          status:
            body.status === 'draft' ||
            body.status === 'submitted' ||
            body.status === 'in_review' ||
            body.status === 'approved' ||
            body.status === 'rejected' ||
            body.status === 'admitted'
              ? (String(body.status) as
                  | 'draft'
                  | 'submitted'
                  | 'in_review'
                  | 'approved'
                  | 'rejected'
                  | 'admitted')
              : 'draft',
          notes: optionalString(body, 'notes', 1200),
        },
      );
      response.status(201).json({ application });
    }),
  );

  router.patch(
    '/:organizationId/admissions/applications/:applicationId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('admission.review'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const status =
        body.status === 'draft' ||
        body.status === 'submitted' ||
        body.status === 'in_review' ||
        body.status === 'approved' ||
        body.status === 'rejected' ||
        body.status === 'admitted'
          ? (String(body.status) as
              | 'draft'
              | 'submitted'
              | 'in_review'
              | 'approved'
              | 'rejected'
              | 'admitted')
          : undefined;
      if (!status)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid application status.',
        );
      const result = await service.reviewApplication(
        organizationContext(response).organizationId,
        routeParameter(request, 'applicationId'),
        {
          status,
          decisionReason:
            typeof body.decisionReason === 'string'
              ? body.decisionReason
              : undefined,
        },
      );
      response.status(200).json(result);
    }),
  );

  return router;
}

export const peopleRouter = createPeopleRouter();
