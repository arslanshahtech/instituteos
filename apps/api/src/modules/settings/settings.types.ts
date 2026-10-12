export interface OrganizationSettingsBranding {
  logoUrl?: string;
  primaryColor: string;
  tagLine?: string;
}

export interface OrganizationSettingsContact {
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

export interface OrganizationSettingsLocalization {
  timezone: string;
  currency: string;
  dateFormat: string;
}

export interface OrganizationSettingsNotifications {
  emailAlerts: boolean;
  smsAlerts: boolean;
  autoAttendanceAlerts: boolean;
}

export interface OrganizationSettingsInput {
  branding?: Partial<OrganizationSettingsBranding>;
  contact?: Partial<OrganizationSettingsContact>;
  localization?: Partial<OrganizationSettingsLocalization>;
  notifications?: Partial<OrganizationSettingsNotifications>;
}

export interface OrganizationSettingsRecord {
  organizationId: string;
  branding: OrganizationSettingsBranding;
  contact: OrganizationSettingsContact;
  localization: OrganizationSettingsLocalization;
  notifications: OrganizationSettingsNotifications;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsActor {
  userId: string;
  role: string;
}

export interface SettingsRepository {
  findSettings(organizationId: string): Promise<OrganizationSettingsRecord | null>;
  updateSettings(
    organizationId: string,
    input: OrganizationSettingsInput,
  ): Promise<OrganizationSettingsRecord>;
  createSettingsAuditLog(
    organizationId: string,
    actorId: string,
  ): Promise<void>;
}
