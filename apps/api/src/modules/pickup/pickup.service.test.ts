import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PickupService } from './pickup.service.js';
import type { MongoPickupRepository } from './pickup.repository.js';
import type { AuthorizedPickupPerson, PickupPass } from './pickup.types.js';

describe('PickupService', () => {
  let mockRepository: Partial<MongoPickupRepository>;
  let service: PickupService;

  const mockPerson: AuthorizedPickupPerson = {
    id: 'person-123',
    organizationId: 'org-1',
    studentId: 'student-1',
    fullName: 'Ali Khan',
    relationship: 'father',
    phone: '+923001234567',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockPass: PickupPass = {
    id: 'pass-123',
    organizationId: 'org-1',
    studentId: 'student-1',
    pickupPersonId: 'person-123',
    passCode: '654321',
    validFrom: new Date(Date.now() - 5000).toISOString(),
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    status: 'active',
    generatedByUserId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockRepository = {
      findPickupPersonById: vi.fn(),
      createPass: vi.fn(),
      findActivePassByCode: vi.fn(),
      updatePassStatus: vi.fn(),
      createLog: vi.fn(),
      listLogsByStudent: vi.fn(),
    };
    service = new PickupService(mockRepository as MongoPickupRepository);
  });

  it('generates a 6-digit gate-pass for an active authorized person', async () => {
    vi.mocked(mockRepository.findPickupPersonById!).mockResolvedValue(mockPerson);
    vi.mocked(mockRepository.createPass!).mockResolvedValue(mockPass);

    const result = await service.generateGatePass('org-1', 'student-1', 'user-1', {
      pickupPersonId: 'person-123',
      validMinutes: 60,
    });

    expect(result.passCode).toBe('654321');
    expect(mockRepository.createPass).toHaveBeenCalledTimes(1);
  });

  it('rejects pass generation if pickup person is suspended', async () => {
    vi.mocked(mockRepository.findPickupPersonById!).mockResolvedValue({
      ...mockPerson,
      status: 'suspended',
    });

    await expect(
      service.generateGatePass('org-1', 'student-1', 'user-1', {
        pickupPersonId: 'person-123',
      }),
    ).rejects.toThrow('Cannot generate pass for a suspended pickup person.');
  });

  it('successfully verifies pass and logs student release', async () => {
    vi.mocked(mockRepository.findActivePassByCode!).mockResolvedValue(mockPass);
    vi.mocked(mockRepository.findPickupPersonById!).mockResolvedValue(mockPerson);
    vi.mocked(mockRepository.createLog!).mockResolvedValue({
      id: 'log-1',
      organizationId: 'org-1',
      studentId: 'student-1',
      pickupPersonId: 'person-123',
      passId: 'pass-123',
      releasedByStaffId: 'staff-1',
      releasedAt: new Date().toISOString(),
      method: 'digital_pass',
      createdAt: new Date().toISOString(),
    });

    const result = await service.verifyAndReleaseStudent('org-1', 'staff-1', {
      passCode: '654321',
    });

    expect(mockRepository.updatePassStatus).toHaveBeenCalledWith('org-1', 'pass-123', 'used');
    expect(result.method).toBe('digital_pass');
    expect(result.releasedByStaffId).toBe('staff-1');
  });

  it('rejects an expired gate pass', async () => {
    const expiredPass: PickupPass = {
      ...mockPass,
      validUntil: new Date(Date.now() - 60000).toISOString(),
    };

    vi.mocked(mockRepository.findActivePassByCode!).mockResolvedValue(expiredPass);

    await expect(
      service.verifyAndReleaseStudent('org-1', 'staff-1', { passCode: '654321' }),
    ).rejects.toThrow('This pass code has expired.');

    expect(mockRepository.updatePassStatus).toHaveBeenCalledWith('org-1', 'pass-123', 'expired');
  });
});