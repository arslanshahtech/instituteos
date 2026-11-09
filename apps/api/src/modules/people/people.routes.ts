import { Router } from 'express';
import mongoose from 'mongoose';
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
import {
  EnrollmentModel,
  GuardianModel,
  StudentFamilyModel,
  PeopleSequenceModel,
  StudentGuardianLinkModel,
  StudentModel,
} from './people.model.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
} from '../academics/academics.model.js';
import { StudentSectionPlacementModel } from '../attendance/attendance.model.js';
import {
  FeeStructureModel,
  StudentInvoiceModel,
} from '../finance/finance.model.js';
import type { StudentImportRowInput } from './people.types.js';

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

async function syncPeopleSequence(
  organizationId: mongoose.Types.ObjectId,
  name: string,
  minimumValue: number,
): Promise<void> {
  const filter = { organizationId, name };
  try {
    await PeopleSequenceModel.updateOne(
      filter,
      { $max: { value: minimumValue }, $setOnInsert: { organizationId, name } },
      { upsert: true },
    );
  } catch (error) {
    if (!(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ))
      throw error;
    await PeopleSequenceModel.updateOne(filter, {
      $max: { value: minimumValue },
    });
  }
}

async function latestStudentRegistrationValue(
  organizationId: mongoose.Types.ObjectId,
  yearCode: string,
): Promise<number> {
  const pattern = new RegExp('^' + yearCode + '-[0-9]+$', 'i');
  const [studentRecords, enrollmentRecords] = await Promise.all([
    StudentModel.find({
      organizationId,
      registrationNumber: { $regex: pattern },
    })
      .select({ registrationNumber: 1 })
      .lean(),
    EnrollmentModel.find({
      organizationId,
      registrationNumber: { $regex: pattern },
    })
      .select({ registrationNumber: 1 })
      .lean(),
  ]);
  return [...studentRecords, ...enrollmentRecords].reduce(
    (max, item) =>
      Math.max(max, Number(item.registrationNumber?.split('-').at(-1) ?? 0)),
    0,
  );
}
const STUDENT_IMPORT_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'preferredName',
  'dateOfBirth',
  'gender',
  'contactEmail',
  'phone',
  'status',
  'guardianName',
  'guardianPhone',
  'guardianEmail',
  'guardianRelationship',
] as const;

function studentImportRows(value: unknown): StudentImportRowInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) {
    throw new AppError(
      400,
      'STUDENT_IMPORT_ROW_LIMIT',
      'Choose between 1 and 1000 student rows to import.',
    );
  }
  return value.map((rawRow) => {
    const row = bodyObject(rawRow);
    if (!Number.isInteger(row.rowNumber) || Number(row.rowNumber) < 1) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Every import row must have a positive source row number.',
      );
    }
    const rawData = bodyObject(row.data);
    const unsupportedField = Object.keys(rawData).find(
      (field) =>
        !STUDENT_IMPORT_FIELDS.includes(
          field as (typeof STUDENT_IMPORT_FIELDS)[number],
        ),
    );
    if (unsupportedField) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'The import contains an unsupported mapped field.',
      );
    }
    const data: Record<string, unknown> = {};
    for (const field of STUDENT_IMPORT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(rawData, field)) {
        data[field] = rawData[field];
      }
    }
    return { rowNumber: Number(row.rowNumber), data };
  });
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

function optionalStringList(
  body: Record<string, unknown>,
  field: string,
  maxItems: number,
  maxLength: number,
): string[] | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some(
      (item) =>
        typeof item !== 'string' ||
        item.trim().length === 0 ||
        item.trim().length > maxLength,
    )
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter valid ${field}.`);
  }
  return value.map((item: string) => item.trim());
}

function staffType(value: unknown): 'teacher' | 'other_staff' | undefined {
  if (value === undefined) return undefined;
  if (value === 'teacher' || value === 'other_staff') return value;
  throw new AppError(400, 'VALIDATION_ERROR', 'Select Teacher or Other Staff.');
}

function staffStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (
    value === 'active' ||
    value === 'on_leave' ||
    value === 'terminated' ||
    value === 'inactive'
  )
    return value;
  throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid staff status.');
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

function queryEnum<T extends string>(
  query: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  return value as T;
}

function queryString(
  query: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim() || undefined;
}

function optionalObjectId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  return value;
}

function requiredRouteObjectId(value: string, field: string): string {
  if (!mongoose.isValidObjectId(value))
    throw new AppError(404, 'STAFF_MEMBER_NOT_FOUND', `${field} not found.`);
  return value;
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
      permissions?: readonly string[];
    };
  };
}): {
  organizationId: string;
  campusIds?: string[];
  role?: string;
  permissions?: readonly string[];
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
      const context = organizationContext(response);

      // Parent role cannot fetch arbitrary student directory listings
      if (context.role === 'parent_guardian') {
        throw new AppError(
          403,
          'PERMISSION_DENIED',
          'Parents may only view profiles of their linked children.',
        );
      }

      const body = request.query ?? {};
      const search = typeof body.search === 'string' ? body.search : undefined;
      const status = typeof body.status === 'string' ? body.status : undefined;
      const classId =
        typeof body.classId === 'string' &&
        mongoose.isValidObjectId(body.classId)
          ? body.classId
          : undefined;
      const sectionId =
        typeof body.sectionId === 'string' &&
        mongoose.isValidObjectId(body.sectionId)
          ? body.sectionId
          : undefined;
      const page =
        typeof body.page === 'string' ? Number(body.page) : undefined;
      const pageSize =
        typeof body.pageSize === 'string' ? Number(body.pageSize) : undefined;
      const result = await service.listStudents(context, {
        search,
        status: status as 'active' | 'inactive' | 'withdrawn' | undefined,
        classId,
        sectionId,
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
    '/:organizationId/students/placements',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const organizationId = new mongoose.Types.ObjectId(
        context.organizationId,
      );
      const studentIds =
        typeof request.query.studentIds === 'string'
          ? request.query.studentIds.split(',').filter(mongoose.isValidObjectId)
          : [];
      const requestedAcademicYearId =
        typeof request.query.academicYearId === 'string'
          ? request.query.academicYearId
          : '';
      if (
        requestedAcademicYearId &&
        !mongoose.isValidObjectId(requestedAcademicYearId)
      )
        throw new AppError(
          400,
          'INVALID_ACADEMIC_YEAR',
          'Select a valid academic year.',
        );
      const activeYear = await AcademicYearModel.findOne({
        organizationId,
        status: 'active',
        ...(requestedAcademicYearId
          ? { _id: new mongoose.Types.ObjectId(requestedAcademicYearId) }
          : {}),
      })
        .select({ _id: 1 })
        .lean();
      if (requestedAcademicYearId && !activeYear)
        throw new AppError(
          404,
          'ACADEMIC_YEAR_NOT_FOUND',
          'The selected active academic year was not found.',
        );
      const filter: Record<string, unknown> = {
        organizationId,
        status: 'active',
        ...(activeYear ? { academicYearId: activeYear._id } : {}),
      };
      if (context.role === 'campus_admin')
        filter.campusId = {
          $in: (context.campusIds ?? []).map(
            (id) => new mongoose.Types.ObjectId(id),
          ),
        };
      if (studentIds.length)
        filter.studentId = {
          $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      const records = await StudentSectionPlacementModel.find(filter)
        .sort({ createdAt: -1 })
        .populate('classId', 'name')
        .populate('sectionId', 'name')
        .populate('academicYearId', 'name')
        .lean();
      // StudentSectionPlacement is the class roster source of truth; it does
      // not create an admissions Enrollment record. Resolve fees from the
      // active year's class/campus FeeStructure instead.
      const placementClassIds = records
        .map((item) => {
          const classRecord = item.classId as unknown as {
            _id?: unknown;
          } | null;
          return classRecord && typeof classRecord === 'object'
            ? classRecord._id
            : item.classId;
        })
        .filter(Boolean);
      const feeStructures =
        activeYear && records.length
          ? await FeeStructureModel.find({
              organizationId,
              academicYearId: activeYear._id,
              classId: { $in: placementClassIds },
              campusId: { $in: records.map((item) => item.campusId) },
            })
              .select({ classId: 1, campusId: 1, feeHeads: 1 })
              .lean()
          : [];
      const feeByClassAndCampus = new Map(
        feeStructures.map((structure) => [
          `${String(structure.classId)}:${String(structure.campusId)}`,
          structure.feeHeads.reduce(
            (total: number, head: { amount: unknown }) =>
              total + Number(String(head.amount)),
            0,
          ),
        ]),
      );
      const familyRecords = await StudentFamilyModel.find({
        organizationId,
        studentIds: { $in: records.map((item) => item.studentId) },
      })
        .select({ familyNumber: 1, studentIds: 1 })
        .lean();
      const familyByStudent = new Map<string, string>();
      for (const family of familyRecords)
        for (const familyStudentId of family.studentIds)
          familyByStudent.set(String(familyStudentId), family.familyNumber);
      response.status(200).json({
        items: records.map((item) => ({
          studentId: String(item.studentId),
          classId: item.classId
            ? String((item.classId as unknown as { _id: unknown })._id)
            : '',
          className:
            item.classId && typeof item.classId === 'object'
              ? String((item.classId as unknown as { name: string }).name)
              : '',
          sectionId: item.sectionId
            ? String((item.sectionId as unknown as { _id: unknown })._id)
            : '',
          sectionName:
            item.sectionId && typeof item.sectionId === 'object'
              ? String((item.sectionId as unknown as { name: string }).name)
              : '',
          academicYearId:
            item.academicYearId && typeof item.academicYearId === 'object'
              ? String((item.academicYearId as unknown as { _id: unknown })._id)
              : String(item.academicYearId ?? ''),
          campusId: String(item.campusId),
          academicYearName:
            item.academicYearId && typeof item.academicYearId === 'object'
              ? String(
                  (item.academicYearId as unknown as { name: string }).name,
                )
              : '',
          monthlyFee:
            feeByClassAndCampus.get(
              `${String(item.classId && typeof item.classId === 'object' ? (item.classId as unknown as { _id: unknown })._id : item.classId)}:${String(item.campusId)}`,
            ) ?? 0,
          familyNumber: familyByStudent.get(String(item.studentId)) ?? '',
        })),
      });
    }),
  );

  router.get(
    '/:organizationId/students/summary',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (_request, response) => {
      const context = organizationContext(response);
      const organizationId = new mongoose.Types.ObjectId(
        context.organizationId,
      );
      const scope =
        context.role === 'campus_admin'
          ? {
              campusId: {
                $in: (context.campusIds ?? []).map(
                  (id) => new mongoose.Types.ObjectId(id),
                ),
              },
            }
          : {};
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const [total, girls, newAdmissions, classes] = await Promise.all([
        StudentModel.countDocuments({ organizationId, ...scope }),
        StudentModel.countDocuments({
          organizationId,
          ...scope,
          gender: { $regex: /^female$/i },
        }),
        StudentModel.countDocuments({
          organizationId,
          ...scope,
          createdAt: { $gte: since },
        }),
        AcademicClassModel.countDocuments({
          organizationId,
          ...(context.role === 'campus_admin'
            ? {
                campusId: {
                  $in: (context.campusIds ?? []).map(
                    (id) => new mongoose.Types.ObjectId(id),
                  ),
                },
              }
            : {}),
        }),
      ]);
      response
        .status(200)
        .json({ summary: { total, girls, newAdmissions, classes } });
    }),
  );

  router.get(
    '/:organizationId/students/enrollment-identifiers',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.create'),
    asyncHandler(async (_request, response) => {
      const context = organizationContext(response);
      const yearCode = String(new Date().getFullYear()).slice(-2);
      const tenantId = new mongoose.Types.ObjectId(context.organizationId);
      const [latestRegistrationValue, familyRecords] = await Promise.all([
        latestStudentRegistrationValue(tenantId, yearCode),
        StudentFamilyModel.find({
          organizationId: tenantId,
          familyNumber: { $regex: /^F-[0-9]+$/i },
        })
          .select({ familyNumber: 1 })
          .lean(),
      ]);
      const latestFamilyValue = familyRecords.reduce(
        (max, item) =>
          Math.max(max, Number(item.familyNumber?.split('-').at(-1) ?? 0)),
        0,
      );
      await Promise.all([
        syncPeopleSequence(
          tenantId,
          'student-registration-' + yearCode,
          latestRegistrationValue,
        ),
        syncPeopleSequence(tenantId, 'family-number', latestFamilyValue),
      ]);
      const [registration, family] = await Promise.all([
        PeopleSequenceModel.findOne({
          organizationId: tenantId,
          name: 'student-registration-' + yearCode,
        }).lean(),
        PeopleSequenceModel.findOne({
          organizationId: tenantId,
          name: 'family-number',
        }).lean(),
      ]);
      let nextRegistration = Number(registration?.value ?? 0) + 1;
      let nextFamily = Number(family?.value ?? 0) + 1;
      while (
        await StudentModel.exists({
          organizationId: tenantId,
          registrationNumber:
            yearCode + '-' + String(nextRegistration).padStart(4, '0'),
        })
      )
        nextRegistration += 1;
      while (
        await StudentFamilyModel.exists({
          organizationId: tenantId,
          familyNumber: 'F-' + String(nextFamily).padStart(3, '0'),
        })
      )
        nextFamily += 1;
      response.status(200).json({
        registrationNumber: `${yearCode}-${String(nextRegistration).padStart(4, '0')}`,
        familyNumber: `F-${String(nextFamily).padStart(3, '0')}`,
      });
    }),
  );

  router.post(
    '/:organizationId/students/enroll',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const student = bodyObject(body.student);
      const enrollment = bodyObject(body.enrollment);
      const parents = Array.isArray(body.parents)
        ? body.parents.map(bodyObject)
        : [];
      if (parents.length < 1 || parents.length > 3)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Add at least one parent or guardian.',
        );
      const context = organizationContext(response);
      const objectId = (value: unknown, label: string) => {
        if (typeof value !== 'string' || !mongoose.isValidObjectId(value))
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `Select a valid ${label}.`,
          );
        return new mongoose.Types.ObjectId(value);
      };
      const campusId = objectId(enrollment.campusId, 'campus');
      const academicYearId = objectId(
        enrollment.academicYearId,
        'academic session',
      );
      const classId = objectId(enrollment.classId, 'class');
      const sectionId = objectId(enrollment.sectionId, 'section');
      if (
        context.role === 'campus_admin' &&
        !context.campusIds?.includes(String(campusId))
      )
        throw new AppError(
          403,
          'CAMPUS_FORBIDDEN',
          'You are not authorized for this campus.',
        );
      const [campusClass, section, academicYear] = await Promise.all([
        AcademicClassModel.findOne({
          _id: classId,
          organizationId: new mongoose.Types.ObjectId(context.organizationId),
          campusId,
        }).lean(),
        AcademicSectionModel.findOne({
          _id: sectionId,
          organizationId: new mongoose.Types.ObjectId(context.organizationId),
          classId,
        }).lean(),
        AcademicYearModel.findOne({
          _id: academicYearId,
          organizationId: new mongoose.Types.ObjectId(context.organizationId),
        }).lean(),
      ]);
      if (!campusClass || !section || !academicYear)
        throw new AppError(
          400,
          'INVALID_ACADEMIC_PLACEMENT',
          'The selected session, class, section or campus is not valid.',
        );
      const firstName = requiredString(student, 'firstName', 1, 80);
      const lastName = requiredString(student, 'lastName', 1, 80);
      const parentMobile = optionalString(student, 'parentMobile', 40);
      if (parentMobile) {
        const digits = parentMobile.replace(/\D/g, '');
        if (!/^(03\d{9}|923\d{9})$/.test(digits))
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Enter a valid 11-digit father mobile number.',
          );
      }
      const registrationMode =
        enrollment.registrationMode === 'manual' ? 'manual' : 'auto';
      let registrationNumber =
        registrationMode === 'manual'
          ? requiredString(student, 'registrationNumber', 1, 40).toUpperCase()
          : '';
      const admissionType =
        enrollment.admissionType === 'family' ? 'family' : 'single';
      const familyNumberMode =
        enrollment.familyNumberMode === 'manual' ? 'manual' : 'auto';
      let familyNumber =
        admissionType === 'family' && familyNumberMode === 'manual'
          ? requiredString(enrollment, 'familyNumber', 1, 24).toUpperCase()
          : '';
      const dateValue = (value: unknown, label: string) => {
        if (value === undefined || value === null || value === '')
          return undefined;
        const text = String(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `Enter a valid ${label} date.`,
          );
        const date = new Date(`${text}T00:00:00.000Z`);
        if (
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== text
        )
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `Enter a valid ${label} date.`,
          );
        return date;
      };
      const amount = (key: string) => {
        const value =
          enrollment[key] === undefined || enrollment[key] === ''
            ? 0
            : Number(enrollment[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100000000)
          throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${key}.`);
        return value;
      };
      const discountType =
        enrollment.discountType === 'percentage' ? 'percentage' : 'fixed';
      const discountValue = amount('discountValue');
      if (discountType === 'percentage' && discountValue > 100)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Discount percentage cannot exceed 100.',
        );
      const tenantId = new mongoose.Types.ObjectId(context.organizationId);
      const yearCode = String(new Date().getFullYear()).slice(-2);
      if (registrationMode === 'auto') {
        const latestRegistrationValue = await latestStudentRegistrationValue(
          tenantId,
          yearCode,
        );
        await syncPeopleSequence(
          tenantId,
          'student-registration-' + yearCode,
          latestRegistrationValue,
        );
      }
      if (admissionType === 'family' && familyNumberMode === 'auto') {
        const existingFamilies = await StudentFamilyModel.find({
          organizationId: tenantId,
          familyNumber: { $regex: /^F-[0-9]+$/i },
        })
          .select({ familyNumber: 1 })
          .lean();
        const latestFamilyValue = existingFamilies.reduce(
          (max, item) =>
            Math.max(max, Number(item.familyNumber?.split('-').at(-1) ?? 0)),
          0,
        );
        await syncPeopleSequence(tenantId, 'family-number', latestFamilyValue);
      }
      const session = await mongoose.startSession();
      let createdStudentId = '';
      try {
        await session.withTransaction(async () => {
          if (registrationMode === 'auto') {
            let allocated = false;
            while (!allocated) {
              const sequence = await PeopleSequenceModel.findOneAndUpdate(
                {
                  organizationId: tenantId,
                  name: 'student-registration-' + yearCode,
                },
                { $inc: { value: 1 } },
                { new: true, session },
              ).lean();
              if (!sequence)
                throw new AppError(
                  500,
                  'SEQUENCE_UNAVAILABLE',
                  'Could not reserve a registration number. Please retry.',
                );
              registrationNumber =
                yearCode + '-' + String(sequence.value).padStart(4, '0');
              const [studentConflict, enrollmentConflict] = await Promise.all([
                StudentModel.exists({
                  organizationId: tenantId,
                  registrationNumber,
                }).session(session),
                EnrollmentModel.exists({
                  organizationId: tenantId,
                  registrationNumber,
                }).session(session),
              ]);
              allocated = !studentConflict && !enrollmentConflict;
            }
          }
          if (admissionType === 'family' && familyNumberMode === 'auto') {
            let allocated = false;
            while (!allocated) {
              const sequence = await PeopleSequenceModel.findOneAndUpdate(
                { organizationId: tenantId, name: 'family-number' },
                { $inc: { value: 1 } },
                { new: true, session },
              ).lean();
              if (!sequence)
                throw new AppError(
                  500,
                  'SEQUENCE_UNAVAILABLE',
                  'Could not reserve a family number. Please retry.',
                );
              familyNumber = 'F-' + String(sequence.value).padStart(3, '0');
              allocated = !(await StudentFamilyModel.exists({
                organizationId: tenantId,
                familyNumber,
              }).session(session));
            }
          }
          const [createdStudent] = await StudentModel.create(
            [
              {
                organizationId: new mongoose.Types.ObjectId(
                  context.organizationId,
                ),
                campusId,
                firstName,
                lastName,
                registrationNumber,
                preferredName: optionalString(student, 'preferredName', 80),
                dateOfBirth: dateValue(student.dateOfBirth, 'date of birth'),
                gender: optionalString(student, 'gender', 40),
                contactEmail: optionalEmail(student.contactEmail),
                phone: optionalString(student, 'phone', 40),
                fatherName: optionalString(student, 'fatherName', 160),
                motherName: optionalString(student, 'motherName', 160),
                parentMobile,
                secondaryNumber: optionalString(student, 'secondaryNumber', 40),
                nationality: optionalString(student, 'nationality', 80),
                religion: optionalString(student, 'religion', 80),
                birthPlace: optionalString(student, 'birthPlace', 120),
                nationalId: optionalString(student, 'nationalId', 40),
                specialNeeds: optionalString(student, 'specialNeeds', 500),
                address:
                  typeof student.address === 'object' &&
                  student.address !== null
                    ? student.address
                    : undefined,
                status: 'active',
              },
            ],
            { session },
          );
          createdStudentId = String(createdStudent._id);
          const guardianIds: mongoose.Types.ObjectId[] = [];
          for (const [index, parent] of parents.entries()) {
            const relationship = [
              'father',
              'mother',
              'guardian',
              'other',
            ].includes(String(parent.relationship))
              ? String(parent.relationship)
              : 'guardian';
            const [guardian] = await GuardianModel.create(
              [
                {
                  organizationId: new mongoose.Types.ObjectId(
                    context.organizationId,
                  ),
                  firstName: requiredString(parent, 'firstName', 1, 80),
                  lastName: requiredString(parent, 'lastName', 1, 80),
                  relationship,
                  phone: optionalString(parent, 'phone', 40),
                  email: optionalEmail(parent.email),
                  cnic: optionalString(parent, 'cnic', 40),
                  occupation: optionalString(parent, 'occupation', 120),
                  monthlyIncome:
                    parent.monthlyIncome === undefined ||
                    parent.monthlyIncome === ''
                      ? undefined
                      : mongoose.Types.Decimal128.fromString(
                          String(parent.monthlyIncome),
                        ),
                  address:
                    typeof parent.address === 'object' &&
                    parent.address !== null
                      ? parent.address
                      : undefined,
                },
              ],
              { session },
            );
            guardianIds.push(guardian._id);
            await StudentGuardianLinkModel.create(
              [
                {
                  organizationId: new mongoose.Types.ObjectId(
                    context.organizationId,
                  ),
                  studentId: createdStudent._id,
                  guardianId: guardian._id,
                  relationship,
                  isPrimary: parent.isPrimary === true || index === 0,
                },
              ],
              { session },
            );
          }
          await StudentModel.updateOne(
            {
              _id: createdStudent._id,
              organizationId: new mongoose.Types.ObjectId(
                context.organizationId,
              ),
            },
            { $set: { guardianIds } },
            { session },
          );
          if (admissionType === 'family') {
            const [family] = await StudentFamilyModel.create(
              [
                {
                  organizationId: new mongoose.Types.ObjectId(
                    context.organizationId,
                  ),
                  familyNumber,
                  name:
                    optionalString(enrollment, 'familyName', 120) ||
                    `${optionalString(student, 'fatherName', 160) || 'Student'} Family`,
                  primaryContactMobile: optionalString(
                    student,
                    'parentMobile',
                    40,
                  ),
                  guardianIds,
                  studentIds: [createdStudent._id],
                },
              ],
              { session },
            );
            await StudentModel.updateOne(
              {
                _id: createdStudent._id,
                organizationId: new mongoose.Types.ObjectId(
                  context.organizationId,
                ),
              },
              { $set: { familyId: family._id } },
              { session },
            );
          }
          const lockedSection = await AcademicSectionModel.findOneAndUpdate(
            {
              _id: sectionId,
              organizationId: new mongoose.Types.ObjectId(
                context.organizationId,
              ),
              classId,
            },
            { $inc: { placementRevision: 1 } },
            { new: true, session },
          )
            .select({ capacity: 1 })
            .lean();
          if (!lockedSection)
            throw new AppError(404, 'SECTION_NOT_FOUND', 'Section not found.');
          if (typeof lockedSection.capacity === 'number') {
            const currentCount =
              await StudentSectionPlacementModel.countDocuments({
                organizationId: new mongoose.Types.ObjectId(
                  context.organizationId,
                ),
                sectionId,
                academicYearId,
                status: 'active',
              }).session(session);
            if (currentCount >= lockedSection.capacity)
              throw new AppError(
                409,
                'SECTION_CAPACITY_REACHED',
                'This section has reached its configured student capacity.',
              );
          }
          await StudentSectionPlacementModel.create(
            [
              {
                organizationId: new mongoose.Types.ObjectId(
                  context.organizationId,
                ),
                studentId: createdStudent._id,
                classId,
                sectionId,
                academicYearId,
                campusId,
                status: 'active',
              },
            ],
            { session },
          );
          await EnrollmentModel.create(
            [
              {
                organizationId: new mongoose.Types.ObjectId(
                  context.organizationId,
                ),
                studentId: createdStudent._id,
                campusId,
                academicYearId,
                gradeLevel: String(campusClass.name),
                registrationNumber,
                admissionFee: mongoose.Types.Decimal128.fromString(
                  String(amount('admissionFee')),
                ),
                registrationFee: mongoose.Types.Decimal128.fromString(
                  String(amount('registrationFee')),
                ),
                securityDeposit: mongoose.Types.Decimal128.fromString(
                  String(amount('securityDeposit')),
                ),
                monthlyFee: mongoose.Types.Decimal128.fromString(
                  String(amount('monthlyFee')),
                ),
                admissionType,
                discountCategory: [
                  'sibling',
                  'staff',
                  'merit',
                  'other',
                ].includes(String(enrollment.discountCategory))
                  ? String(enrollment.discountCategory)
                  : 'none',
                discountType,
                discountValue: mongoose.Types.Decimal128.fromString(
                  String(discountValue),
                ),
                previousSchool: optionalString(
                  enrollment,
                  'previousSchool',
                  160,
                ),
                leavingReason: optionalString(enrollment, 'leavingReason', 500),
                startDate:
                  dateValue(enrollment.startDate, 'enrollment start') ??
                  new Date(),
                status: 'active',
              },
            ],
            { session },
          );
        });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 11000
        ) {
          const duplicate = error as {
            keyPattern?: Record<string, unknown>;
            message?: string;
          };
          const pattern = duplicate.keyPattern ?? {};
          const message = duplicate.message ?? '';
          const registrationConflict =
            'registrationNumber' in pattern ||
            message.includes('uniq_student_registration_number');
          const familyConflict =
            'familyNumber' in pattern ||
            message.includes('uniq_family_number_per_organization');
          if (registrationConflict || familyConflict) {
            throw new AppError(
              409,
              'IDENTIFIER_ALREADY_EXISTS',
              registrationConflict
                ? 'This registration number is already in use. Please use the next available number.'
                : 'This family number is already in use. Please use the next available number.',
            );
          }
          if (
            'sourceApplicationId' in pattern ||
            message.includes('uniq_enrollment_application_record')
          ) {
            throw new AppError(
              409,
              'APPLICATION_ALREADY_ENROLLED',
              'This admission application has already been enrolled.',
            );
          }
        }
        throw error;
      } finally {
        await session.endSession();
      }
      const saved = await StudentModel.findOne({
        _id: new mongoose.Types.ObjectId(createdStudentId),
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      }).lean();
      response.status(201).json({
        student: saved
          ? {
              id: String(saved._id),
              firstName: saved.firstName,
              lastName: saved.lastName,
              registrationNumber: saved.registrationNumber,
              status: saved.status,
            }
          : null,
        familyNumber: admissionType === 'family' ? familyNumber : undefined,
      });
    }),
  );

  router.post(
    '/:organizationId/students/import/preview',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const rows = studentImportRows(body.rows);
      const campusId = optionalObjectId(body.campusId, 'campusId');
      const preview = await service.previewStudentImport(
        organizationContext(response),
        rows,
        campusId,
      );
      response.status(200).json(preview);
    }),
  );

  router.post(
    '/:organizationId/students/import',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.create'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const rows = studentImportRows(body.rows);
      const campusId = optionalObjectId(body.campusId, 'campusId');
      const result = await service.importStudents(
        organizationContext(response),
        rows,
        campusId,
      );
      response.status(200).json(result);
    }),
  );

  router.get(
    '/:organizationId/students/:studentId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const studentId = routeParameter(request, 'studentId');

      // Parent Scoping Guard: Enforce linked child verification
      if (context.role === 'parent_guardian') {
        const relations = await service.listStudentGuardians(
          context,
          studentId,
        );
        const userEmail = response.locals?.session?.email?.toLowerCase();
        const userPhone = response.locals?.session?.phone;

        const isLinked = relations.some(
          (rel) =>
            (userEmail && rel.guardian?.email?.toLowerCase() === userEmail) ||
            (userPhone && rel.guardian?.phone === userPhone),
        );

        if (!isLinked) {
          throw new AppError(
            403,
            'PERMISSION_DENIED',
            'You are not authorized to view this student profile.',
          );
        }
      }

      const student = await service.getStudent(
        context.organizationId,
        studentId,
        context,
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

  // Family directory: families are a grouping of existing student and guardian
  // records. Deleting a family never deletes students, guardians or invoices.
  router.get(
    '/:organizationId/families',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    requireOrganizationPermission('guardian.read'),
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const page = Math.max(1, Number(request.query.page) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, Number(request.query.pageSize) || 10),
      );
      const search =
        typeof request.query.search === 'string'
          ? request.query.search.trim()
          : '';
      const filter: Record<string, unknown> = {
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      };
      if (search)
        filter.$or = [
          {
            familyNumber: {
              $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          },
          {
            name: {
              $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          },
        ];
      const [families, total] = await Promise.all([
        StudentFamilyModel.find(filter)
          .sort({ familyNumber: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        StudentFamilyModel.countDocuments(filter),
      ]);
      const studentIds = families.flatMap((family) => family.studentIds ?? []);
      const guardianIds = families.flatMap(
        (family) => family.guardianIds ?? [],
      );
      const [students, guardians, invoiceCounts] = await Promise.all([
        StudentModel.find({
          organizationId: filter.organizationId,
          _id: { $in: studentIds },
        })
          .select({ firstName: 1, lastName: 1, familyId: 1 })
          .lean(),
        GuardianModel.find({
          organizationId: filter.organizationId,
          _id: { $in: guardianIds },
        })
          .select({ firstName: 1, lastName: 1 })
          .lean(),
        StudentInvoiceModel.aggregate<{
          _id: mongoose.Types.ObjectId;
          count: number;
        }>([
          {
            $match: {
              organizationId: filter.organizationId,
              studentId: { $in: studentIds },
            },
          },
          { $group: { _id: '$studentId', count: { $sum: 1 } } },
        ]),
      ]);
      const studentMap = new Map(
        students.map(
          (item: {
            _id: mongoose.Types.ObjectId;
            firstName: string;
            lastName: string;
          }) => [String(item._id), item],
        ),
      );
      const guardianMap = new Map(
        guardians.map(
          (item: {
            _id: mongoose.Types.ObjectId;
            firstName: string;
            lastName: string;
          }) => [String(item._id), item],
        ),
      );
      const invoiceMap = new Map(
        invoiceCounts.map(
          (item: { _id: mongoose.Types.ObjectId; count: number }) => [
            String(item._id),
            item.count,
          ],
        ),
      );
      response.status(200).json({
        items: families.map(
          (family: {
            _id: mongoose.Types.ObjectId;
            familyNumber: string;
            name?: string;
            studentIds?: mongoose.Types.ObjectId[];
            guardianIds?: mongoose.Types.ObjectId[];
          }) => ({
            id: String(family._id),
            familyNumber: family.familyNumber,
            name: family.name ?? '',
            studentCount: (family.studentIds ?? []).filter((id) =>
              studentMap.has(String(id)),
            ).length,
            parentCount: (family.guardianIds ?? []).filter((id) =>
              guardianMap.has(String(id)),
            ).length,
            invoiceCount: (family.studentIds ?? []).reduce(
              (sum, id) => sum + (invoiceMap.get(String(id)) ?? 0),
              0,
            ),
            students: (family.studentIds ?? [])
              .map((id) => studentMap.get(String(id)))
              .filter(Boolean)
              .map((item) => ({
                id: String(item!._id),
                name: item!.firstName + ' ' + item!.lastName,
              })),
            parents: (family.guardianIds ?? [])
              .map((id) => guardianMap.get(String(id)))
              .filter(Boolean)
              .map((item) => ({
                id: String(item!._id),
                name: item!.firstName + ' ' + item!.lastName,
              })),
            status: 'active',
          }),
        ),
        total,
        page,
        pageSize,
      });
    }),
  );

  router.post(
    '/:organizationId/families',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.update'),
    requireOrganizationPermission('guardian.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const context = organizationContext(response);
      const organizationId = new mongoose.Types.ObjectId(
        context.organizationId,
      );
      const guardianIds = Array.isArray(body.guardianIds)
        ? [
            ...new Set(
              body.guardianIds.filter(
                (id): id is string =>
                  typeof id === 'string' && mongoose.isValidObjectId(id),
              ),
            ),
          ]
        : [];
      let studentIds = Array.isArray(body.studentIds)
        ? [
            ...new Set(
              body.studentIds.filter(
                (id): id is string =>
                  typeof id === 'string' && mongoose.isValidObjectId(id),
              ),
            ),
          ]
        : [];
      if (!guardianIds.length)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select at least one existing parent or guardian.',
        );
      if (!studentIds.length) {
        const links = await StudentGuardianLinkModel.find({
          organizationId,
          guardianId: {
            $in: guardianIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select({ studentId: 1 })
          .lean();
        studentIds = [...new Set(links.map((link) => String(link.studentId)))];
      }
      if (!studentIds.length)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select at least one student linked to this family.',
        );
      const [guardians, students] = await Promise.all([
        GuardianModel.find({
          organizationId,
          _id: {
            $in: guardianIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select({ _id: 1 })
          .lean(),
        StudentModel.find({
          organizationId,
          _id: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select({ _id: 1, familyId: 1, campusId: 1 })
          .lean(),
      ]);
      if (
        guardians.length !== guardianIds.length ||
        students.length !== studentIds.length
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'One or more selected parents or students do not belong to this school.',
        );
      if (students.some((student) => student.familyId))
        throw new AppError(
          409,
          'STUDENT_ALREADY_IN_FAMILY',
          'A selected student is already assigned to a family.',
        );
      if (
        context.role === 'campus_admin' &&
        students.some(
          (student) =>
            !student.campusId ||
            !context.campusIds?.includes(String(student.campusId)),
        )
      )
        throw new AppError(
          403,
          'CAMPUS_FORBIDDEN',
          'You are not authorized for one or more selected students.',
        );
      const linkedStudentIds = await StudentGuardianLinkModel.distinct(
        'studentId',
        {
          organizationId,
          guardianId: {
            $in: guardianIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          studentId: {
            $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      );
      if (linkedStudentIds.length !== studentIds.length)
        throw new AppError(
          400,
          'GUARDIAN_STUDENT_MISMATCH',
          'Each selected student must be linked to at least one selected parent or guardian.',
        );
      const existingFamilyNumbers = await StudentFamilyModel.find({
        organizationId,
        familyNumber: { $regex: /^F-[0-9]+$/i },
      })
        .select({ familyNumber: 1 })
        .lean();
      const latestFamilyValue = existingFamilyNumbers.reduce(
        (max, item) =>
          Math.max(max, Number(item.familyNumber.split('-').at(-1) ?? 0)),
        0,
      );
      await syncPeopleSequence(
        organizationId,
        'family-number',
        latestFamilyValue,
      );
      const session = await mongoose.startSession();
      let createdFamily:
        { _id: mongoose.Types.ObjectId; familyNumber: string } | undefined;
      try {
        await session.withTransaction(async () => {
          const sequence = await PeopleSequenceModel.findOneAndUpdate(
            { organizationId, name: 'family-number' },
            { $inc: { value: 1 } },
            { new: true, session },
          ).lean();
          if (!sequence)
            throw new AppError(
              500,
              'SEQUENCE_UNAVAILABLE',
              'Could not reserve a family number.',
            );
          const familyNumber = 'F-' + String(sequence.value).padStart(3, '0');
          if (
            await StudentFamilyModel.exists({
              organizationId,
              familyNumber,
            }).session(session)
          )
            throw new AppError(
              409,
              'FAMILY_NUMBER_CONFLICT',
              'The family number is already in use. Please retry.',
            );
          const [family] = await StudentFamilyModel.create(
            [
              {
                organizationId,
                familyNumber,
                name: optionalString(body, 'name', 120),
                guardianIds: guardianIds.map(
                  (id) => new mongoose.Types.ObjectId(id),
                ),
                studentIds: studentIds.map(
                  (id) => new mongoose.Types.ObjectId(id),
                ),
              },
            ],
            { session },
          );
          await StudentModel.updateMany(
            {
              organizationId,
              _id: {
                $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
              familyId: null,
            },
            { $set: { familyId: family._id } },
            { session },
          );
          createdFamily = { _id: family._id, familyNumber };
        });
      } finally {
        await session.endSession();
      }
      response.status(201).json({ family: createdFamily });
    }),
  );

  router.get(
    '/:organizationId/families/:familyId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    requireOrganizationPermission('guardian.read'),
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const family = await StudentFamilyModel.findOne({
        _id: routeParameter(request, 'familyId'),
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      }).lean();
      if (!family)
        throw new AppError(404, 'FAMILY_NOT_FOUND', 'Family not found.');
      const [students, guardians, placements, invoiceCount] = await Promise.all(
        [
          StudentModel.find({
            organizationId: family.organizationId,
            _id: { $in: family.studentIds ?? [] },
          })
            .select({
              firstName: 1,
              lastName: 1,
              registrationNumber: 1,
              campusId: 1,
            })
            .lean(),
          GuardianModel.find({
            organizationId: family.organizationId,
            _id: { $in: family.guardianIds ?? [] },
          })
            .select({
              firstName: 1,
              lastName: 1,
              relationship: 1,
              phone: 1,
              email: 1,
              cnic: 1,
            })
            .lean(),
          StudentSectionPlacementModel.find({
            organizationId: family.organizationId,
            studentId: { $in: family.studentIds ?? [] },
            status: 'active',
          })
            .sort({ createdAt: -1 })
            .populate('classId', 'name')
            .populate('sectionId', 'name')
            .lean(),
          StudentInvoiceModel.countDocuments({
            organizationId: family.organizationId,
            studentId: { $in: family.studentIds ?? [] },
          }),
        ],
      );
      const placementByStudent = new Map<string, (typeof placements)[number]>();
      for (const placement of placements)
        if (!placementByStudent.has(String(placement.studentId)))
          placementByStudent.set(String(placement.studentId), placement);
      response.status(200).json({
        family: {
          id: String(family._id),
          familyNumber: family.familyNumber,
          name: family.name ?? '',
          invoiceCount,
          status: 'active',
        },
        students: students.map((student) => {
          const placement = placementByStudent.get(String(student._id));
          const classRecord = placement?.classId as unknown as {
            name?: string;
          } | null;
          const sectionRecord = placement?.sectionId as unknown as {
            name?: string;
          } | null;
          return {
            id: String(student._id),
            name: student.firstName + ' ' + student.lastName,
            registrationNumber: student.registrationNumber ?? '',
            className: classRecord?.name ?? '—',
            sectionName: sectionRecord?.name ?? '—',
          };
        }),
        parents: guardians.map((guardian) => ({
          id: String(guardian._id),
          name: guardian.firstName + ' ' + guardian.lastName,
          relationship: guardian.relationship ?? 'guardian',
          phone: guardian.phone ?? '',
          email: guardian.email ?? '',
          cnic: guardian.cnic ?? '',
        })),
      });
    }),
  );

  router.patch(
    '/:organizationId/families/:familyId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('guardian.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const family = await StudentFamilyModel.findOneAndUpdate(
        {
          _id: routeParameter(request, 'familyId'),
          organizationId: new mongoose.Types.ObjectId(
            organizationContext(response).organizationId,
          ),
        },
        {
          $set: {
            familyNumber: requiredString(
              body,
              'familyNumber',
              1,
              24,
            ).toUpperCase(),
            name: optionalString(body, 'name', 120),
          },
        },
        { new: true, runValidators: true },
      ).lean();
      if (!family)
        throw new AppError(404, 'FAMILY_NOT_FOUND', 'Family not found.');
      response.status(200).json({
        family: {
          id: String(family._id),
          familyNumber: family.familyNumber,
          name: family.name ?? '',
        },
      });
    }),
  );

  router.delete(
    '/:organizationId/families/:familyId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.update'),
    requireOrganizationPermission('guardian.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const family = await StudentFamilyModel.findOne({
        _id: routeParameter(request, 'familyId'),
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      });
      if (!family)
        throw new AppError(404, 'FAMILY_NOT_FOUND', 'Family not found.');
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await StudentModel.updateMany(
            { organizationId: family.organizationId, familyId: family._id },
            { $set: { familyId: null } },
            { session },
          );
          await StudentFamilyModel.deleteOne(
            { _id: family._id, organizationId: family.organizationId },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      response.status(204).end();
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
      const result = await service.listStaff(organizationContext(response), {
        status: staffStatus(query.status),
        department: queryString(query, 'department', 100),
        staffType: staffType(query.staffType),
        campusId: optionalObjectId(query.campusId, 'campusId'),
        search: queryString(query, 'search', 160),
        page: typeof query.page === 'string' ? Number(query.page) : undefined,
        pageSize:
          typeof query.pageSize === 'string'
            ? Number(query.pageSize)
            : undefined,
      });
      response.status(200).json(result);
    }),
  );

  router.get(
    '/:organizationId/staff/:staffId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('staff.read'),
    asyncHandler(async (request, response) => {
      const staff = await service.getStaff(
        organizationContext(response),
        requiredRouteObjectId(
          routeParameter(request, 'staffId'),
          'Staff member',
        ),
      );
      response.status(200).json({ staff });
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
          status: staffStatus(body.status),
          role: optionalString(body, 'role', 80),
          designation: optionalString(body, 'designation', 100),
          employeeCode: optionalString(body, 'employeeCode', 40),
          staffType: staffType(body.staffType) ?? 'other_staff',
          qualifications: optionalStringList(body, 'qualifications', 20, 160),
          subjects: optionalStringList(body, 'subjects', 30, 100),
          dateOfBirth: optionalString(body, 'dateOfBirth', 10),
          gender: optionalString(body, 'gender', 40),
          email: optionalEmail(body.email),
          phone: optionalString(body, 'phone', 40),
          campusId: optionalObjectId(body.campusId, 'campusId'),
        },
        organizationContext(response),
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
        requiredRouteObjectId(
          routeParameter(request, 'staffId'),
          'Staff member',
        ),
        {
          firstName:
            body.firstName !== undefined
              ? requiredString(body, 'firstName', 2, 80)
              : undefined,
          lastName:
            body.lastName !== undefined
              ? requiredString(body, 'lastName', 2, 80)
              : undefined,
          department:
            body.department !== undefined
              ? String(optionalString(body, 'department', 100) ?? '')
              : undefined,
          qualification:
            body.qualification !== undefined
              ? String(optionalString(body, 'qualification', 240) ?? '')
              : undefined,
          role:
            body.role !== undefined
              ? String(optionalString(body, 'role', 80) ?? '')
              : undefined,
          designation:
            body.designation !== undefined
              ? String(optionalString(body, 'designation', 100) ?? '')
              : undefined,
          employeeCode:
            body.employeeCode !== undefined
              ? String(optionalString(body, 'employeeCode', 40) ?? '')
              : undefined,
          staffType: staffType(body.staffType),
          qualifications: optionalStringList(body, 'qualifications', 20, 160),
          subjects: optionalStringList(body, 'subjects', 30, 100),
          dateOfBirth:
            body.dateOfBirth !== undefined
              ? String(optionalString(body, 'dateOfBirth', 10) ?? '')
              : undefined,
          gender:
            body.gender !== undefined
              ? String(optionalString(body, 'gender', 40) ?? '')
              : undefined,
          status: staffStatus(body.status),
          email:
            body.email !== undefined
              ? body.email === ''
                ? ''
                : optionalEmail(body.email)
              : undefined,
          phone:
            body.phone !== undefined
              ? String(optionalString(body, 'phone', 40) ?? '')
              : undefined,
          campusId:
            body.campusId === ''
              ? ''
              : optionalObjectId(body.campusId, 'campusId'),
        },
        organizationContext(response),
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
      const context = organizationContext(response);
      const inquiries = await service.listInquiries(
        context.organizationId,
        {
          status: queryEnum(query, 'inquiryStatus', [
            'new',
            'contacted',
            'qualified',
            'converted',
            'closed',
          ]),
          search: typeof query.search === 'string' ? query.search : undefined,
          page: typeof query.page === 'string' ? Number(query.page) : undefined,
          pageSize:
            typeof query.pageSize === 'string'
              ? Number(query.pageSize)
              : undefined,
        },
        context,
      );
      const applications = await service.listApplications(
        context.organizationId,
        {
          status: queryEnum(query, 'applicationStatus', [
            'draft',
            'submitted',
            'in_review',
            'approved',
            'rejected',
            'admitted',
          ]),
          search: typeof query.search === 'string' ? query.search : undefined,
          page: typeof query.page === 'string' ? Number(query.page) : undefined,
          pageSize:
            typeof query.pageSize === 'string'
              ? Number(query.pageSize)
              : undefined,
        },
        context,
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
      const context = organizationContext(response);
      const inquiry = await service.createInquiry(
        context.organizationId,
        {
          firstName: requiredString(body, 'firstName', 2, 80),
          lastName: requiredString(body, 'lastName', 2, 80),
          email: optionalEmail(body.email),
          phone: optionalString(body, 'phone', 40),
          source: optionalString(body, 'source', 80),
          notes: optionalString(body, 'notes', 1000),
          gradeLevelInterest: optionalString(body, 'gradeLevelInterest', 80),
          campusId:
            typeof body.campusId === 'string' ? body.campusId : undefined,
        },
        context,
      );
      response.status(201).json({ inquiry });
    }),
  );

  router.patch(
    '/:organizationId/admissions/inquiries/:inquiryId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('admission.review'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const status = queryEnum(body, 'status', [
        'new',
        'contacted',
        'qualified',
        'converted',
        'closed',
      ]);
      if (!status)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid inquiry status.',
        );
      const context = organizationContext(response);
      const inquiry = await service.updateInquiry(
        context.organizationId,
        routeParameter(request, 'inquiryId'),
        {
          status,
          ...(body.notes !== undefined
            ? { notes: optionalString(body, 'notes', 1000) }
            : {}),
        },
        context,
      );
      response.status(200).json({ inquiry });
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
      const context = organizationContext(response);
      const status =
        body.status === undefined || body.status === 'draft'
          ? 'draft'
          : body.status === 'submitted'
            ? 'submitted'
            : undefined;
      if (!status)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'A new application must be a draft or submitted.',
        );
      const application = await service.createApplication(
        context.organizationId,
        {
          inquiryId: optionalObjectId(body.inquiryId, 'inquiry'),
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
          dateOfBirth: optionalString(body, 'dateOfBirth', 10),
          guardianName: optionalString(body, 'guardianName', 160),
          guardianPhone: optionalString(body, 'guardianPhone', 40),
          feePlan:
            body.feePlan === 'Standard' ||
            body.feePlan === 'Scholarship' ||
            body.feePlan === 'Sibling plan'
              ? body.feePlan
              : undefined,
          status,
          notes: optionalString(body, 'notes', 1200),
        },
        context,
      );
      response.status(201).json({ application });
    }),
  );

  router.get(
    '/:organizationId/admissions/applications/:applicationId',
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('admission.read'),
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const application = await service.getApplication(
        context.organizationId,
        routeParameter(request, 'applicationId'),
        context,
      );
      response.status(200).json({ application });
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
      const context = organizationContext(response);
      if (
        status === 'approved' &&
        !context.permissions?.includes('student.create')
      )
        throw new AppError(
          403,
          'PERMISSION_DENIED',
          'You do not have permission to create the resulting student record.',
        );
      const result = await service.reviewApplication(
        context.organizationId,
        routeParameter(request, 'applicationId'),
        {
          status,
          decisionReason: optionalString(body, 'decisionReason', 400),
          campusId: optionalObjectId(body.campusId, 'campusId'),
        },
        context,
      );
      response.status(200).json(result);
    }),
  );

  return router;
}

export const peopleRouter = createPeopleRouter();
