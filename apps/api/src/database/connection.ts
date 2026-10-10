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

let tenancyModelsInitialized = false;

export async function connectDatabase(
  uri: string,
  serverSelectionTimeoutMs: number,
): Promise<void> {
  tenancyModelsInitialized = false;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: serverSelectionTimeoutMs,
  });

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
