import { describe, expect, it } from 'vitest';
import { AcademicYearModel, AcademicSectionModel } from './academics.model.js';

describe('academic database invariants', () => {
  it('defaults new academic years to archived until explicitly activated', () => {
    expect(AcademicYearModel.schema.path('status')?.options.default).toBe(
      'archived',
    );
  });

  it('declares a partial unique index allowing only one active year per organization', () => {
    const index = AcademicYearModel.schema
      .indexes()
      .find(
        ([keys, options]) =>
          keys.organizationId === 1 &&
          options.name === 'uniq_one_active_academic_year_per_organization',
      );
    expect(index).toBeDefined();
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { status: 'active' },
    });
  });

  it('validates optional section capacity as a positive bounded integer', () => {
    const invalid = new AcademicSectionModel({
      organizationId: '650000000000000000000001',
      classId: '650000000000000000000002',
      name: '5-A',
      capacity: 0,
    });
    const error = invalid.validateSync();
    expect(error?.errors.capacity).toBeDefined();
  });
});
