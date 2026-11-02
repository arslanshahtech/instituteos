import { describe, expect, it } from 'vitest';
import { getAcademicsRosterPermissions } from './academics-permissions.js';

describe('academic roster permissions', () => {
  it('allows an authorized Admin to view and enroll students when all API permissions are granted', () => {
    expect(
      getAcademicsRosterPermissions([
        'student.read',
        'student.create',
        'staff.read',
        'attendance.read',
        'attendance.write',
      ]),
    ).toEqual({ canReadStudents: true, canAddStudents: true });
  });

  it('keeps the roster read-only when placement permissions are missing', () => {
    expect(
      getAcademicsRosterPermissions(['student.read', 'attendance.read']),
    ).toEqual({ canReadStudents: true, canAddStudents: false });
    expect(
      getAcademicsRosterPermissions([
        'student.read',
        'attendance.read',
        'student.create',
        'staff.read',
      ]),
    ).toEqual({ canReadStudents: true, canAddStudents: false });
    expect(
      getAcademicsRosterPermissions([
        'student.read',
        'attendance.read',
        'student.create',
        'attendance.write',
      ]),
    ).toEqual({ canReadStudents: true, canAddStudents: false });
  });

  it('does not expose the roster without both student and attendance read permissions', () => {
    expect(getAcademicsRosterPermissions(['student.read'])).toEqual({
      canReadStudents: false,
      canAddStudents: false,
    });
    expect(getAcademicsRosterPermissions(['attendance.read'])).toEqual({
      canReadStudents: false,
      canAddStudents: false,
    });
  });
});
