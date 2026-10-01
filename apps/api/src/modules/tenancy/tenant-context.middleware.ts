import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import {
  hasPermission,
  permissionsForOrganizationRole,
  type OrganizationPermission,
} from './authorization.js';
import type {
  OrganizationAccessRepository,
  OrganizationContext,
  OrganizationRole,
  PlatformRole,
} from './tenancy.types.js';
import mongoose from 'mongoose';

interface AuthenticatedLocals {
  auth?: { user?: { id?: string } };
  organizationContext?: OrganizationContext;
}

function authenticatedUserId(response: Response): string | null {
  const locals = response.locals as AuthenticatedLocals;
  return locals.auth?.user?.id ?? null;
}

export function createOrganizationContextMiddleware(
  repository: OrganizationAccessRepository,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const userId = authenticatedUserId(response);
    if (!userId)
      return next(
        new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'),
      );

    const organizationParam = request.params.organizationId;
    const organizationId = Array.isArray(organizationParam)
      ? organizationParam[0]
      : organizationParam;
    if (!organizationId || !mongoose.isValidObjectId(organizationId))
      return next(
        new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.'),
      );

    try {
      const membership = await repository.findActiveMembership(
        userId,
        organizationId,
      );
      if (!membership)
        return next(
          new AppError(
            404,
            'ORGANIZATION_NOT_FOUND',
            'Organization not found.',
          ),
        );

      (response.locals as AuthenticatedLocals).organizationContext = {
        ...membership,
        permissions: permissionsForOrganizationRole(membership.role),
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireOrganizationPermission(
  permission: OrganizationPermission,
) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const context = (response.locals as AuthenticatedLocals)
      .organizationContext;
    if (!context)
      return next(
        new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.'),
      );
    if (!hasPermission(context.permissions, permission))
      return next(
        new AppError(
          403,
          'PERMISSION_DENIED',
          'You do not have permission to perform this action.',
        ),
      );
    return next();
  };
}

export function requireOrganizationRole(roles: readonly OrganizationRole[]) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const context = (response.locals as AuthenticatedLocals)
      .organizationContext;
    if (!context)
      return next(
        new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.'),
      );
    if (!roles.includes(context.role))
      return next(
        new AppError(
          403,
          'ROLE_REQUIRED',
          'Your organization role does not allow this action.',
        ),
      );
    return next();
  };
}

export function requireAssignedCampusScope(campusIdParameter = 'campusId') {
  return (request: Request, response: Response, next: NextFunction) => {
    const context = (response.locals as AuthenticatedLocals)
      .organizationContext;
    if (!context)
      return next(
        new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.'),
      );
    if (context.role !== 'campus_admin') return next();
    const campusParam = request.params[campusIdParameter];
    const requestedCampusId = Array.isArray(campusParam)
      ? campusParam[0]
      : campusParam;
    if (!requestedCampusId || !context.campusIds.includes(requestedCampusId))
      return next(new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.'));
    return next();
  };
}

export function requirePlatformRole(
  repository: OrganizationAccessRepository,
  role: PlatformRole,
) {
  return async (_request: Request, response: Response, next: NextFunction) => {
    const userId = authenticatedUserId(response);
    if (!userId)
      return next(
        new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'),
      );
    try {
      if (!(await repository.hasPlatformRole(userId, role)))
        return next(
          new AppError(
            403,
            'PLATFORM_ROLE_REQUIRED',
            'This platform operation is not available to this account.',
          ),
        );
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
