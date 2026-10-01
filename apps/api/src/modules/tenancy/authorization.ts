import type { OrganizationRole, PlatformRole } from './tenancy.types.js';

export const ORGANIZATION_PERMISSIONS = [
  'organization.read',
  'organization.update',
  'campus.read',
  'campus.create',
  'campus.update',
  'campus.status.update',
  'member.read',
  'member.invite',
  'member.manage',
  'student.read',
  'student.create',
  'finance.read',
] as const;

export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];

const rolePermissions: Record<
  OrganizationRole,
  readonly OrganizationPermission[]
> = {
  organization_owner: [
    'organization.read',
    'organization.update',
    'campus.read',
    'campus.create',
    'campus.update',
    'campus.status.update',
    'member.read',
    'member.invite',
    'member.manage',
    'student.read',
    'student.create',
    'finance.read',
  ],
  organization_admin: [
    'organization.read',
    'organization.update',
    'campus.read',
    'campus.create',
    'campus.update',
    'campus.status.update',
    'member.read',
    'member.invite',
    'member.manage',
    'student.read',
    'student.create',
    'finance.read',
  ],
  campus_admin: [
    'organization.read',
    'campus.read',
    'campus.update',
    'member.read',
    'student.read',
    'student.create',
  ],
  principal_director: [
    'organization.read',
    'member.read',
    'student.read',
    'student.create',
  ],
  academic_coordinator: ['organization.read', 'student.read', 'student.create'],
  teacher: ['organization.read', 'student.read'],
  accountant_finance_officer: ['organization.read', 'finance.read'],
  admissions_reception: ['organization.read', 'student.read', 'student.create'],
  student: ['organization.read'],
  parent_guardian: ['organization.read'],
};

export function permissionsForOrganizationRole(
  role: OrganizationRole,
): readonly OrganizationPermission[] {
  return rolePermissions[role];
}

// Platform grants are a separate scope and never confer organization access.
export const PLATFORM_ROLES = [
  'platform_super_admin',
] as const satisfies readonly PlatformRole[];

export function hasPermission(
  granted: readonly string[],
  required: OrganizationPermission,
): boolean {
  return granted.includes(required);
}
