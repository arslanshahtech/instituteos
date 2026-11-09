import { describe, expect, it } from 'vitest';
import { ExamModel } from './examinations.model.js';

const baseExam = {
  organizationId: '650000000000000000000001',
  campusId: '650000000000000000000002',
  name: 'Annual Examination',
  type: 'final',
  academicYearId: '650000000000000000000003',
  startDate: new Date('2026-10-01T00:00:00.000Z'),
  endDate: new Date('2026-10-31T00:00:00.000Z'),
};

describe('ExamModel term relationship', () => {
  it('accepts an annual exam without a term', async () => {
    const record = new ExamModel(baseExam);

    await expect(record.validate()).resolves.toBeUndefined();
  });

  it('continues to accept a term-based exam', async () => {
    const record = new ExamModel({
      ...baseExam,
      termId: '650000000000000000000004',
    });

    await expect(record.validate()).resolves.toBeUndefined();
  });
});
