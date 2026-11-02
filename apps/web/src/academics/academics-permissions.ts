export interface AcademicsRosterPermissions {
  canReadStudents: boolean;
  canAddStudents: boolean;
}

/**
 * Keep the UI aligned with the existing attendance API authorization:
 * roster reads need student.read + attendance.read; placements additionally
 * need student.create + staff.read + attendance.write.
 */
export function getAcademicsRosterPermissions(
  permissions: readonly string[],
): AcademicsRosterPermissions {
  // The current roster endpoint returns attendance-aware data and is protected
  // by attendance.read. Placement endpoints use staff.read + attendance.write.
  const canReadStudents =
    permissions.includes('student.read') &&
    permissions.includes('attendance.read');
  return {
    canReadStudents,
    canAddStudents:
      canReadStudents &&
      permissions.includes('student.create') &&
      permissions.includes('staff.read') &&
      permissions.includes('attendance.write'),
  };
}
