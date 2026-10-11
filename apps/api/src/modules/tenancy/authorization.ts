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
  'student.update',

  'guardian.read',
  'guardian.create',
  'guardian.update',

  'staff.read',
  'staff.create',
  'staff.update',

  'admission.read',
  'admission.create',
  'admission.review',

  'examination.read',
  'examination.write',

  'finance.read',
  'finance.write',
] as const;

export type OrganizationPermission =
  (typeof ORGANIZATION_PERMISSIONS)[number];

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
    'student.update',

    'guardian.read',
    'guardian.create',
    'guardian.update',

    'staff.read',
    'staff.create',
    'staff.update',

    'admission.read',
    'admission.create',
    'admission.review',

    'examination.read',
    'examination.write',

    'finance.read',
    'finance.write',
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
    'student.update',

    'guardian.read',
    'guardian.create',
    'guardian.update',

    'staff.read',
    'staff.create',
    'staff.update',

    'admission.read',
    'admission.create',
    'admission.review',

    'examination.read',
    'examination.write',

    'finance.read',
    'finance.write',
  ],

  campus_admin: [
    'organization.read',
    'campus.read',
    'campus.update',
    'member.read',

    'student.read',
    'student.create',
    'student.update',

    'guardian.read',
    'guardian.create',
    'guardian.update',

    'staff.read',
    'staff.create',
    'staff.update',

    'admission.read',
    'admission.create',
    'admission.review',

    'examination.read',
    'examination.write',

    'finance.read',
    'finance.write',
  ],

  principal_director: [
    'organization.read',
    'member.read',

    'student.read',
    'student.create',
    'student.update',

    'guardian.read',
    'guardian.create',
    'guardian.update',

    'staff.read',
    'staff.create',
    'staff.update',

    'admission.read',
    'admission.create',
    'admission.review',

    'finance.read',
    'finance.write',
  ],

  academic_coordinator: [
    'organization.read',

    'student.read',
    'student.create',
    'student.update',

    'guardian.read',

    'staff.read',

    'admission.read',

    'examination.read',
    'examination.write',
  ],

  teacher: [
    'organization.read',
    'student.read',
    'guardian.read',
  ],

  accountant_finance_officer: [
    'organization.read',
    'finance.read',
    'finance.write',
  ],

  admissions_reception: [
    'organization.read',

    'student.read',

    'guardian.read',

    'admission.read',
    'admission.create',
  ],

  student: [
    'organization.read',
  ],

  parent_guardian: [
    'organization.read',
  ],
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