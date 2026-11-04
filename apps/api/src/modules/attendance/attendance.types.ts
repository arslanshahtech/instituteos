export type StudentAttendanceStatus = 'present' | 'absent' | 'leave' | 'late';
export type StaffAttendanceStatus =
  'present' | 'absent' | 'half-day' | 'on-leave';

export interface AttendanceContext {
  organizationId: string;
  campusIds: string[];
  role: string;
  userId?: string;
}

export interface TeacherSelfAttendanceConfig {
  viewOwnAttendance: boolean;
  selfMarkingEnabled: boolean;
  allowedStatuses: StaffAttendanceStatus[];
  timezone: string;
}

export interface TeacherAttendanceAssignment {
  id: string;
  classId: string;
  className: string;
  subjectName?: string;
  sectionId: string;
  sectionName: string;
  academicYearId: string;
  academicYearName: string;
  campusId: string;
  campusName: string;
}

export interface StudentRosterMember {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  contactEmail?: string;
  phone?: string;
  status?: StudentAttendanceStatus;
  remarks?: string;
}

export interface AttendanceStudentChoice {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
}

export interface StudentAttendanceInput {
  studentId: string;
  status: StudentAttendanceStatus;
  remarks?: string;
}

export interface StudentAttendanceBulkInput {
  classId: string;
  sectionId: string;
  academicYearId: string;
  campusId: string;
  date: string;
  records: StudentAttendanceInput[];
}

export interface StudentAttendanceRecord extends StudentAttendanceInput {
  id: string;
  organizationId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  campusId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentAttendanceQuery {
  dateFrom?: string;
  dateTo?: string;
  studentId?: string;
  classId?: string;
  sectionId?: string;
  campusId?: string;
  /** Internal repository restriction derived from the signed-in teacher's assignments. */
  academicYearIds?: string[];
}

export interface StaffAttendanceInput {
  staffId: string;
  date: string;
  status: StaffAttendanceStatus;
  remarks?: string;
}

export interface StaffAttendanceRecord extends StaffAttendanceInput {
  id: string;
  organizationId: string;
  campusId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAttendanceQuery {
  dateFrom?: string;
  dateTo?: string;
  staffId?: string;
  campusId?: string;
}

export interface StudentPlacementInput {
  studentId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  campusId: string;
}

export interface StudentPlacementRecord extends StudentPlacementInput {
  id: string;
  organizationId: string;
  status: 'active' | 'inactive';
}

export interface AttendanceRepository {
  listTeacherAssignmentsForUser(
    organizationId: string,
    userId: string,
  ): Promise<TeacherAttendanceAssignment[]>;
  getTeacherSelfAttendanceConfig(
    organizationId: string,
  ): Promise<TeacherSelfAttendanceConfig>;
  findActiveStaffForUser(
    organizationId: string,
    userId: string,
  ): Promise<{ id: string; campusId?: string } | null>;
  isTeacherAssignedToSection(
    organizationId: string,
    userId: string,
    input: { classId: string; sectionId: string; academicYearId: string },
  ): Promise<boolean>;
  getClassCampus(
    organizationId: string,
    classId: string,
  ): Promise<string | null>;
  validateSection(
    organizationId: string,
    classId: string,
    sectionId: string,
  ): Promise<boolean>;
  listEligibleStudents(
    organizationId: string,
    campusId: string,
    academicYearId: string,
  ): Promise<AttendanceStudentChoice[]>;
  validateAcademicYear(
    organizationId: string,
    academicYearId: string,
    date: string,
  ): Promise<boolean>;
  validateActiveAcademicYear(
    organizationId: string,
    academicYearId: string,
  ): Promise<boolean>;
  validateStudentEnrollment(
    organizationId: string,
    studentId: string,
    campusId: string,
  ): Promise<boolean>;
  getSectionCapacity(
    organizationId: string,
    sectionId: string,
  ): Promise<number | null>;
  countActiveSectionPlacements(
    organizationId: string,
    sectionId: string,
    academicYearId: string,
    excludingStudentId?: string,
  ): Promise<number>;
  validateStaff(
    organizationId: string,
    staffId: string,
  ): Promise<{ campusId?: string } | null>;
  upsertStudentPlacements(
    organizationId: string,
    input: StudentPlacementInput,
  ): Promise<StudentPlacementRecord>;
  upsertStudentPlacementWithinCapacity(
    organizationId: string,
    input: StudentPlacementInput,
  ): Promise<StudentPlacementRecord>;
  deactivateStudentPlacement(
    organizationId: string,
    input: StudentPlacementInput,
  ): Promise<boolean>;
  listStudentRoster(
    organizationId: string,
    input: Pick<
      StudentAttendanceBulkInput,
      'classId' | 'sectionId' | 'academicYearId' | 'campusId' | 'date'
    >,
  ): Promise<StudentRosterMember[]>;
  saveStudentAttendance(
    organizationId: string,
    input: StudentAttendanceBulkInput,
  ): Promise<StudentAttendanceRecord[]>;
  listStudentAttendance(
    organizationId: string,
    input: StudentAttendanceQuery,
    campusIds?: string[],
  ): Promise<StudentAttendanceRecord[]>;
  saveStaffAttendance(
    organizationId: string,
    campusId: string | undefined,
    input: StaffAttendanceInput,
  ): Promise<StaffAttendanceRecord>;
  createStaffAttendanceOnce(
    organizationId: string,
    campusId: string | undefined,
    actorId: string,
    input: StaffAttendanceInput,
  ): Promise<StaffAttendanceRecord>;
  listStaffAttendance(
    organizationId: string,
    input: StaffAttendanceQuery,
    campusIds?: string[],
  ): Promise<StaffAttendanceRecord[]>;
}
