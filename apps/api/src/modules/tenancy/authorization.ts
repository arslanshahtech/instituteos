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

  'academics.read',
  'academics.write',

  'attendance.read',
  'attendance.write',

  'examination.read',
  'examination.write',

  'finance.read',
  'finance.write',

  'communication.read',
  'communication.write',

  'reporting.read',
  'audit.read',
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
    'academics.read',
    'academics.write',
    'attendance.read',
    'attendance.write',
    'examination.read',
    'examination.write',
    'finance.read',
    'finance.write',
    'communication.read',
    'communication.write',
    'reporting.read',
    'audit.read',
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
    'academics.read',
    'academics.write',
    'attendance.read',
    'attendance.write',
    'examination.read',
    'examination.write',
    'finance.read',
    'finance.write',
    'communication.read',
    'communication.write',
    'reporting.read',
    'audit.read',
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
    'academics.read',
    'academics.write',
    'attendance.read',
    'attendance.write',
    'examination.read',
    'examination.write',
    'finance.read',
    'finance.write',
    'communication.read',
    'communication.write',
    'reporting.read',
    'audit.read',
  ],

  principal_director: [
    'organization.read',
    'campus.read',
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
    'academics.read',
    'attendance.read',
    'examination.read',
    'finance.read',
    'communication.read',
    'communication.write',
    'reporting.read',
  ],

  academic_coordinator: [
    'organization.read',
    'campus.read',
    'student.read',
    'student.create',
    'student.update',
    'guardian.read',
    'staff.read',
    'admission.read',
    'academics.read',
    'academics.write',
    'attendance.read',
    'attendance.write',
    'examination.read',
    'examination.write',
    'communication.read',
  ],

  teacher: [
    'organization.read',
    'student.read',
    'guardian.read',
    'academics.read',
    'attendance.read',
    'attendance.write',
    'examination.read',
    'examination.write',
    'communication.read',
  ],

  accountant_finance_officer: [
    'organization.read',
    'student.read',
    'finance.read',
    'finance.write',
    'reporting.read',
  ],

  admissions_reception: [
    'organization.read',
    'student.read',
    'guardian.read',
    'admission.read',
    'admission.create',
    'admission.review',
  ],

  student: [
    'organization.read',
    'academics.read',
    'attendance.read',
    'examination.read',
    'communication.read',
  ],

  parent_guardian: [
    'organization.read',
    'student.read',
    'attendance.read',
    'examination.read',
    'finance.read',
    'communication.read',
  ],
};

export function permissionsForOrganizationRole(
  role: OrganizationRole,
): readonly OrganizationPermission[] {
  return rolePermissions[role] ?? [];
}

export const PLATFORM_ROLES = [
  'platform_super_admin',
] as const satisfies readonly PlatformRole[];

export function hasPermission(
  granted: readonly string[],
  required: OrganizationPermission,
): boolean {
  return granted.includes(required);
}

// ==========================================
// Object-Level Boundary Scope Validators
// ==========================================

export interface ScopeContext {
  userId: string;
  role: OrganizationRole;
  assignedCampusIds?: string[];
  assignedSectionIds?: string[];
  linkedStudentIds?: string[];
}

/**
 * Asserts whether the user has access to a specific student record.
 * Admin/Owner: Full access.
 * Teacher: Must be teaching one of the student's sections.
 * Parent: Must be explicitly linked to the student.
 * Student: Must be their own ID.
 */
export function isStudentInScope(
  context: ScopeContext,
  studentId: string,
  studentSectionId?: string,
): boolean {
  if (
    context.role === 'organization_owner' ||
    context.role === 'organization_admin' ||
    context.role === 'principal_director'
  ) {
    return true;
  }

  if (context.role === 'parent_guardian') {
    return context.linkedStudentIds?.includes(studentId) ?? false;
  }

  if (context.role === 'student') {
    return context.userId === studentId;
  }

  if (context.role === 'teacher') {
    if (!studentSectionId) return false;
    return context.assignedSectionIds?.includes(studentSectionId) ?? false;
  }

  return false;
}