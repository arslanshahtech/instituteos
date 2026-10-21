import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicClassModel,
  TeacherAssignmentModel,
} from './academics.model.js';
import { MongoAcademicsRepository } from './academics.repository.js';

afterEach(() => vi.restoreAllMocks());

describe('TeacherAssignment schema and repository constraints', () => {
  it('includes subjectId in the unique assignment index so a teacher can teach multiple subjects per section', () => {
    const index = TeacherAssignmentModel.schema
      .indexes()
      .find(([, options]) => options.name === 'uniq_teacher_section_per_year');

    expect(index).toBeDefined();
    expect(index?.[0]).toEqual({
      organizationId: 1,
      teacherStaffId: 1,
      subjectId: 1,
      classId: 1,
      sectionId: 1,
      academicYearId: 1,
    });
    expect(index?.[1]).toMatchObject({ unique: true });
  });
});

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
      subjectId: new Types.ObjectId('650000000000000000000003'),
      classId: new Types.ObjectId('650000000000000000000004'),
      sectionId: new Types.ObjectId('650000000000000000000005'),
      academicYearId: new Types.ObjectId('650000000000000000000006'),
      _id: { $ne: new Types.ObjectId('650000000000000000000007') },
    });
  });
});
