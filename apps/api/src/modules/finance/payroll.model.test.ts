import { describe, expect, it } from 'vitest';
import {
  PayrollMonthModel,
  PayrollSalaryProfileModel,
} from './payroll.model.js';

const validPayroll = (month: string) =>
  new PayrollMonthModel({
    organizationId: '650000000000000000000001',
    staffId: '650000000000000000000002',
    recordedBy: '650000000000000000000003',
    month,
    staffName: 'Test Staff',
    grossSalary: '25000.00',
  });

describe('payroll month schema', () => {
  it('accepts a valid YYYY-MM payroll period', async () => {
    await expect(validPayroll('2026-11').validate()).resolves.toBeUndefined();
  });

  it('rejects invalid payroll month values', async () => {
    await expect(validPayroll('2026-13').validate()).rejects.toMatchObject({
      errors: { month: expect.anything() },
    });
    await expect(validPayroll('26-11').validate()).rejects.toMatchObject({
      errors: { month: expect.anything() },
    });
  });
});

describe('payroll salary profile schema', () => {
  it('retains effective-dated salary versions', async () => {
    const profile = new PayrollSalaryProfileModel({
      organizationId: '650000000000000000000001',
      staffId: '650000000000000000000002',
      recordedBy: '650000000000000000000003',
      monthlySalary: '35000.00',
      effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
      salaryHistory: [
        {
          monthlySalary: '30000.00',
          effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
          isActive: true,
          recordedBy: '650000000000000000000003',
        },
      ],
    });

    await expect(profile.validate()).resolves.toBeUndefined();
    expect(profile.salaryHistory).toHaveLength(1);
    expect(profile.salaryHistory[0]?.monthlySalary.toString()).toBe('30000.00');
  });
});
