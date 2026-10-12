import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  OrganizationSettingsInput,
  OrganizationSettingsRecord,
  SettingsActor,
  SettingsRepository,
} from './settings.types.js';

const managerRoles = ['organization_owner', 'organization_admin'];

function validateOrganizationId(organizationId: string): void {
  if (!mongoose.isValidObjectId(organizationId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid organization.');
  }
}

function defaultSettings(
  organizationId: string,
  now: Date,
): OrganizationSettingsRecord {
  const timestamp = now.toISOString();
  return {
    organizationId,
    branding: { primaryColor: '#0f766e' },
    contact: {},
    localization: {
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      dateFormat: 'YYYY-MM-DD',
    },
    notifications: {
      emailAlerts: true,
      smsAlerts: false,
      autoAttendanceAlerts: false,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function validateInput(input: OrganizationSettingsInput): void {
  const sections = [
    'branding',
    'contact',
    'localization',
    'notifications',
  ] as const;
  let hasValue = false;
  for (const section of sections) {
    const values = input[section];
    if (!values) continue;
    const allowed = {
      branding: ['logoUrl', 'primaryColor', 'tagLine'],
      contact: ['email', 'phone', 'address', 'website'],
      localization: ['timezone', 'currency', 'dateFormat'],
      notifications: ['emailAlerts', 'smsAlerts', 'autoAttendanceAlerts'],
    }[section];
    const optionalTextFields = [
      'logoUrl',
      'tagLine',
      'email',
      'phone',
      'address',
      'website',
    ];
    for (const [key, value] of Object.entries(values)) {
      hasValue = true;
      if (!allowed.includes(key)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Settings contain an unsupported field.');
      }
      if (section === 'notifications') {
        if (typeof value !== 'boolean') {
          throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${key}.`);
        }
      } else if (
        typeof value !== 'string' ||
        (value.length === 0 && !optionalTextFields.includes(key)) ||
        (key === 'tagLine' && value.length > 160)
      ) {
        throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${key}.`);
      }
    }
  }
  if (!hasValue) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Provide at least one settings value.');
  }
}

function changedSettings(
  current: OrganizationSettingsRecord,
  input: OrganizationSettingsInput,
): boolean {
  for (const section of [
    'branding',
    'contact',
    'localization',
    'notifications',
  ] as const) {
    const values = input[section];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      if (
        current[section][key as keyof (typeof current)[typeof section]] !==
        value
      ) {
        return true;
      }
    }
  }
  return false;
}

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getSettings(organizationId: string): Promise<OrganizationSettingsRecord> {
    validateOrganizationId(organizationId);
    return (
      (await this.repository.findSettings(organizationId)) ??
      defaultSettings(organizationId, this.now())
    );
  }

  async updateSettings(
    organizationId: string,
    input: OrganizationSettingsInput,
    actor: SettingsActor,
  ): Promise<OrganizationSettingsRecord> {
    validateOrganizationId(organizationId);
    if (!mongoose.isValidObjectId(actor.userId)) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
    }
    if (!managerRoles.includes(actor.role)) {
      throw new AppError(
        403,
        'ROLE_REQUIRED',
        'Your organization role does not allow this action.',
      );
    }
    validateInput(input);

    const existing =
      (await this.repository.findSettings(organizationId)) ??
      defaultSettings(organizationId, this.now());
    const updated = await this.repository.updateSettings(organizationId, input);
    if (changedSettings(existing, input)) {
      await this.repository.createSettingsAuditLog(
        organizationId,
        actor.userId,
      );
    }
    return updated;
  }
}
