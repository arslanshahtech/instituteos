import mongoose, { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GuardianModel,
  StaffMemberModel,
  StudentGuardianLinkModel,
  StudentModel,
} from './people.model.js';
import { MongoPeopleRepository } from './people.repository.js';
import { CampusModel } from '../tenancy/tenancy.model.js';

afterEach(() => vi.restoreAllMocks());

describe('MongoPeopleRepository guardian operations', () => {
  it('searches guardian names by case-insensitive whitespace-separated terms', async () => {
    const find = vi.spyOn(GuardianModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as never);
    vi.spyOn(GuardianModel, 'countDocuments').mockResolvedValue(0);

    await new MongoPeopleRepository().listGuardians(
      '650000000000000000000001',
      {
        search: '  Leela   Rao ',
        page: 1,
        pageSize: 20,
      },
    );

    const filter = find.mock.calls[0]?.[0] as unknown as {
      $and: Array<{
        $or: Array<Record<string, { $regex: string; $options: string }>>;
      }>;
    };
    expect(filter.$and).toHaveLength(2);
    expect(filter.$and.map((term) => term.$or[0]?.firstName.$regex)).toEqual([
      'Leela',
      'Rao',
    ]);
    expect(
      filter.$and.every((term) =>
        term.$or.every((field) => Object.values(field)[0]?.$options === 'i'),
      ),
    ).toBe(true);
  });

  describe('MongoPeopleRepository staff operations', () => {
    it('rejects campus assignments outside the staff organization', async () => {
      const organizationId = new Types.ObjectId();
      const campusId = new Types.ObjectId();
      const exists = vi.spyOn(CampusModel, 'exists').mockResolvedValue(null);
      const create = vi.spyOn(StaffMemberModel, 'create');

      await expect(
        new MongoPeopleRepository().createStaff(String(organizationId), {
          firstName: 'Ada',
          lastName: 'Lovelace',
          campusId: String(campusId),
        }),
      ).rejects.toMatchObject({ code: 'CAMPUS_NOT_FOUND' });

      expect(exists).toHaveBeenCalledWith({
        _id: campusId,
        organizationId,
      });
      expect(create).not.toHaveBeenCalled();
    });
  });

  it('performs guardian and student reads sequentially in the link transaction', async () => {
    const organizationId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const guardianId = new Types.ObjectId();
    const studentRecord = {
      _id: studentId,
      organizationId,
      campusId: null,
    };
    const guardianRecord = { _id: guardianId, organizationId };
    let activeReads = 0;
    let maximumConcurrentReads = 0;
    const createReadQuery = <T>(result: T) => ({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => {
        activeReads += 1;
        maximumConcurrentReads = Math.max(maximumConcurrentReads, activeReads);
        await Promise.resolve();
        activeReads -= 1;
        return result;
      }),
    });
    const studentQuery = createReadQuery(studentRecord);
    const guardianQuery = createReadQuery(guardianRecord);
    vi.spyOn(StudentModel, 'findOne').mockReturnValue(studentQuery as never);
    vi.spyOn(GuardianModel, 'findOne').mockReturnValue(guardianQuery as never);

    const linkRecord = {
      _id: new Types.ObjectId(),
      organizationId,
      studentId,
      guardianId,
      relationship: 'mother',
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const linkQuery = { lean: vi.fn().mockResolvedValue(linkRecord) };
    const findOneAndUpdate = vi
      .spyOn(StudentGuardianLinkModel, 'findOneAndUpdate')
      .mockReturnValue(linkQuery as never);
    const updateOne = vi
      .spyOn(StudentModel, 'updateOne')
      .mockResolvedValue({} as never);
    const session = {
      withTransaction: vi.fn(
        async (operation: () => Promise<void>) => await operation(),
      ),
      endSession: vi.fn(async () => undefined),
    } as unknown as ClientSession;
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    await new MongoPeopleRepository().linkGuardianToStudent(
      String(organizationId),
      {
        studentId: String(studentId),
        guardianId: String(guardianId),
        relationship: 'mother',
        isPrimary: true,
      },
    );

    expect(maximumConcurrentReads).toBe(1);
    expect(studentQuery.session).toHaveBeenCalledWith(session);
    expect(guardianQuery.session).toHaveBeenCalledWith(session);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      {
        organizationId,
        studentId,
        guardianId,
      },
      {
        $set: { relationship: 'mother', isPrimary: true },
      },
      expect.objectContaining({ upsert: true, session }),
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: studentId, organizationId },
      { $addToSet: { guardianIds: guardianId } },
      { session },
    );
  });
});
