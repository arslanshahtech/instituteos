import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicClassModel,
  TeacherAssignmentModel,
} from './academics.model.js';
import { MongoAcademicsRepository } from './academics.repository.js';

afterEach(() => vi.restoreAllMocks());

describe('MongoAcademicsRepository tenant and campus scopes', () => {
  it('lists only classes belonging to the organization and assigned campuses', async () => {
    const find = vi.spyOn(AcademicClassModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as never);

    await new MongoAcademicsRepository().listClasses(
      '650000000000000000000001',
      ['650000000000000000000002'],
    );

    expect(find).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId('650000000000000000000001'),
      campusId: { $in: [new Types.ObjectId('650000000000000000000002')] },
    });
  });

  it('checks assignment conflicts within the organization, teacher, class, section, and year', async () => {
    const exists = vi
      .spyOn(TeacherAssignmentModel, 'exists')
      .mockResolvedValue(null);

    await new MongoAcademicsRepository().findTeacherAssignmentConflict(
      '650000000000000000000001',
      {
        teacherStaffId: '650000000000000000000002',
        subjectId: '650000000000000000000003',
        classId: '650000000000000000000004',
        sectionId: '650000000000000000000005',
        academicYearId: '650000000000000000000006',
      },
      '650000000000000000000007',
    );

    expect(exists).toHaveBeenCalledWith({
      organizationId: new Types.ObjectId('650000000000000000000001'),
      teacherStaffId: new Types.ObjectId('650000000000000000000002'),
      classId: new Types.ObjectId('650000000000000000000004'),
      sectionId: new Types.ObjectId('650000000000000000000005'),
      academicYearId: new Types.ObjectId('650000000000000000000006'),
      _id: { $ne: new Types.ObjectId('650000000000000000000007') },
    });
  });
});
