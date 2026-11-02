import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthUserModel } from '../auth/auth.model.js';
import {
  GuardianModel,
  StudentGuardianLinkModel,
  StudentModel,
} from '../people/people.model.js';
import { activeStudentIdsForAccount } from './portal.routes.js';

const organizationId = '650000000000000000000001';
const userId = '650000000000000000000002';
const guardianId = '650000000000000000000003';
const linkedStudentId = '650000000000000000000004';
const legacyStudentId = '650000000000000000000005';

afterEach(() => vi.restoreAllMocks());

function activeUserQuery(
  email = 'parent@example.test',
  status = 'active',
  emailVerifiedAt: Date | null = new Date('2026-01-01T00:00:00.000Z'),
) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue({ email, status, emailVerifiedAt }),
  };
}

function guardianQuery(records: Array<{ _id: Types.ObjectId }>) {
  return {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(records),
  };
}

describe('parent portal child-link resolution', () => {
  it('returns only students linked to the matched guardian within the organization', async () => {
    const organizationObjectId = new Types.ObjectId(organizationId);
    const guardianObjectId = new Types.ObjectId(guardianId);
    const findById = vi
      .spyOn(AuthUserModel, 'findById')
      .mockReturnValue(activeUserQuery() as never);
    const findGuardians = vi
      .spyOn(GuardianModel, 'find')
      .mockReturnValue(guardianQuery([{ _id: guardianObjectId }]) as never);
    const findLinks = vi
      .spyOn(StudentGuardianLinkModel, 'find')
      .mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi
          .fn()
          .mockResolvedValue([
            { studentId: new Types.ObjectId(linkedStudentId) },
          ]),
      } as never);
    const findLegacyStudents = vi.spyOn(StudentModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi
        .fn()
        .mockResolvedValue([
          { _id: new Types.ObjectId(legacyStudentId) },
          { _id: new Types.ObjectId(linkedStudentId) },
        ]),
    } as never);

    const result = await activeStudentIdsForAccount(
      organizationId,
      userId,
      'parent_guardian',
    );

    expect(result).toEqual([linkedStudentId, legacyStudentId]);
    expect(findById).toHaveBeenCalledWith(new Types.ObjectId(userId));
    expect(findGuardians).toHaveBeenCalledWith({
      organizationId: organizationObjectId,
      email: 'parent@example.test',
    });
    expect(findLinks).toHaveBeenCalledWith({
      organizationId: organizationObjectId,
      guardianId: guardianObjectId,
    });
    expect(findLegacyStudents).toHaveBeenCalledWith({
      organizationId: organizationObjectId,
      status: 'active',
      guardianIds: guardianObjectId,
    });
  });

  it('blocks a parent account when the email matches multiple guardian records', async () => {
    vi.spyOn(AuthUserModel, 'findById').mockReturnValue(
      activeUserQuery() as never,
    );
    vi.spyOn(GuardianModel, 'find').mockReturnValue(
      guardianQuery([
        { _id: new Types.ObjectId(guardianId) },
        { _id: new Types.ObjectId(linkedStudentId) },
      ]) as never,
    );
    const findLinks = vi.spyOn(StudentGuardianLinkModel, 'find');

    await expect(
      activeStudentIdsForAccount(organizationId, userId, 'parent_guardian'),
    ).rejects.toMatchObject({ code: 'PORTAL_ACCOUNT_UNLINKED' });
    expect(findLinks).not.toHaveBeenCalled();
  });

  it('blocks inactive portal accounts before looking up guardian links', async () => {
    vi.spyOn(AuthUserModel, 'findById').mockReturnValue(
      activeUserQuery('parent@example.test', 'suspended') as never,
    );
    const findGuardians = vi.spyOn(GuardianModel, 'find');

    await expect(
      activeStudentIdsForAccount(organizationId, userId, 'parent_guardian'),
    ).rejects.toMatchObject({ code: 'PORTAL_ACCOUNT_UNLINKED' });
    expect(findGuardians).not.toHaveBeenCalled();
  });

  it('does not fall back to every student when a guardian has no child links', async () => {
    vi.spyOn(AuthUserModel, 'findById').mockReturnValue(
      activeUserQuery() as never,
    );
    vi.spyOn(GuardianModel, 'find').mockReturnValue(
      guardianQuery([{ _id: new Types.ObjectId(guardianId) }]) as never,
    );
    vi.spyOn(StudentGuardianLinkModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as never);
    vi.spyOn(StudentModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as never);

    await expect(
      activeStudentIdsForAccount(organizationId, userId, 'parent_guardian'),
    ).resolves.toEqual([]);
  });

  it('blocks guardian linking until the account email is verified', async () => {
    const userQuery = activeUserQuery('parent@example.test', 'active', null);
    vi.spyOn(AuthUserModel, 'findById').mockReturnValue(userQuery as never);
    const findGuardians = vi.spyOn(GuardianModel, 'find');

    await expect(
      activeStudentIdsForAccount(organizationId, userId, 'parent_guardian'),
    ).rejects.toMatchObject({ code: 'PORTAL_ACCOUNT_UNLINKED' });

    expect(userQuery.select).toHaveBeenCalledWith({
      email: 1,
      status: 1,
      emailVerifiedAt: 1,
    });
    expect(findGuardians).not.toHaveBeenCalled();
  });
});
