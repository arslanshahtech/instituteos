import mongoose from 'mongoose';
import {
  MembershipModel,
  OrganizationModel,
  CampusModel,
  OrganizationAuditEventModel,
  OrganizationInvitationModel,
  PlatformRoleGrantModel,
} from '../modules/tenancy/tenancy.model.js';
import {
  StaffAttendanceModel,
  StudentAttendanceModel,
  StudentSectionPlacementModel,
} from '../modules/attendance/attendance.model.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
  TeacherTimetableModel,
  TermModel,
} from '../modules/academics/academics.model.js';

let tenancyModelsInitialized = false;

export async function connectDatabase(
  uri: string,
  serverSelectionTimeoutMs: number,
): Promise<void> {
  tenancyModelsInitialized = false;
  const expectedDevelopmentDatabase =
    (process.env.NODE_ENV ?? 'development') === 'development'
      ? 'instituteos_dev'
      : undefined;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: serverSelectionTimeoutMs,
    ...(expectedDevelopmentDatabase
      ? { dbName: expectedDevelopmentDatabase }
      : {}),
  });

  if (
    expectedDevelopmentDatabase &&
    mongoose.connection.name !== expectedDevelopmentDatabase
  ) {
    await mongoose.disconnect().catch(() => undefined);
    throw new Error(
      `Refusing development database connection: expected ${expectedDevelopmentDatabase}.`,
    );
  }

  try {
    await Promise.all([
      OrganizationModel.init(),
      MembershipModel.init(),
      PlatformRoleGrantModel.init(),
      CampusModel.init(),
      OrganizationInvitationModel.init(),
      OrganizationAuditEventModel.init(),
      StudentAttendanceModel.init(),
      StaffAttendanceModel.init(),
      StudentSectionPlacementModel.init(),
      AcademicYearModel.init(),
      TermModel.init(),
      AcademicClassModel.init(),
      AcademicSectionModel.init(),
      SubjectModel.init(),
      TeacherAssignmentModel.init(),
      TeacherTimetableModel.init(),
    ]);
    tenancyModelsInitialized = true;
  } catch (error) {
    await mongoose.disconnect().catch(() => undefined);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  tenancyModelsInitialized = false;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1 && tenancyModelsInitialized;
}

export function getDatabaseState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return states[mongoose.connection.readyState] ?? 'unknown';
}
