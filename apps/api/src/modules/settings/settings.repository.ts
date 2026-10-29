import { Types } from 'mongoose';
import { AuditLogModel } from '../audit/audit.model.js';
import { OrganizationSettingsModel } from './settings.model.js';
import type {
  OrganizationSettingsInput,
  OrganizationSettingsRecord,
  SettingsRepository,
} from './settings.types.js';

const oid = (id: string) => new Types.ObjectId(id);
const iso = (value: Date) => new Date(value).toISOString();

function settingsRecord(
  record: Record<string, unknown>,
): OrganizationSettingsRecord {
  return {
    organizationId: String(record.organizationId),
    branding: record.branding as OrganizationSettingsRecord['branding'],
    contact: record.contact as OrganizationSettingsRecord['contact'],
    localization:
      record.localization as OrganizationSettingsRecord['localization'],
    notifications:
      record.notifications as OrganizationSettingsRecord['notifications'],
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function updateFields(input: OrganizationSettingsInput) {
  const fields: Record<string, unknown> = {};
  for (const section of [
    'branding',
    'contact',
    'localization',
    'notifications',
  ] as const) {
    const values = input[section];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      fields[`${section}.${key}`] = value;
    }
  }
  return fields;
}

export class MongoSettingsRepository implements SettingsRepository {
  async findSettings(
    organizationId: string,
  ): Promise<OrganizationSettingsRecord | null> {
    const record = await OrganizationSettingsModel.findOne({
      organizationId: oid(organizationId),
    }).lean();
    return record
      ? settingsRecord(record as unknown as Record<string, unknown>)
      : null;
  }

  async updateSettings(
    organizationId: string,
    input: OrganizationSettingsInput,
  ): Promise<OrganizationSettingsRecord> {
    const record = await OrganizationSettingsModel.findOneAndUpdate(
      { organizationId: oid(organizationId) },
      {
        $set: updateFields(input),
        $setOnInsert: { organizationId: oid(organizationId) },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();
    return settingsRecord(record as unknown as Record<string, unknown>);
  }

  async createSettingsAuditLog(
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await AuditLogModel.create({
      organizationId: oid(organizationId),
      actorId: oid(actorId),
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entityType: 'OrganizationSettings',
      entityId: organizationId,
    });
  }
}
