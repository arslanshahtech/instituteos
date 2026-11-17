import { describe, expect, it } from 'vitest';
import { DataTransferHistoryModel } from './data-transfer.model.js';

const organizationId = '650000000000000000000001';
const actorId = '650000000000000000000002';

function validTransfer(overrides: Record<string, unknown> = {}) {
  return new DataTransferHistoryModel({
    organizationId,
    actorId,
    direction: 'import',
    dataType: 'students',
    format: 'xlsx',
    fileName: 'student-register.xlsx',
    status: 'completed',
    totalRows: 12,
    createdRows: 12,
    skippedRows: 0,
    failedRows: 0,
    ...overrides,
  });
}

describe('DataTransferHistoryModel', () => {
  it('accepts a valid organization-scoped transfer history record', async () => {
    await expect(validTransfer().validate()).resolves.toBeUndefined();
  });

  it('rejects invalid directions, formats and data types', async () => {
    await expect(
      validTransfer({ direction: 'restore' }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
    await expect(
      validTransfer({ format: 'xls' }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
    await expect(
      validTransfer({ dataType: 'database_backup' }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
  });

  it('accepts admission and organization report history types', async () => {
    for (const dataType of [
      'admissions',
      'admission-inquiries',
      'organization',
    ]) {
      await expect(
        validTransfer({ dataType }).validate(),
      ).resolves.toBeUndefined();
    }
  });

  it('rejects negative or excessive row counts', async () => {
    await expect(
      validTransfer({ totalRows: -1 }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
    await expect(
      validTransfer({ failedRows: 1000001 }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
  });

  it('requires a file name and actor identity', async () => {
    await expect(
      validTransfer({ fileName: '' }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
    await expect(
      validTransfer({ actorId: undefined }).validate(),
    ).rejects.toHaveProperty('name', 'ValidationError');
  });
});
