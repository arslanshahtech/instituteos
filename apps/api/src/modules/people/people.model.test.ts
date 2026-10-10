import { describe, expect, it } from 'vitest';
import { StaffMemberModel, StudentModel } from './people.model.js';

describe('student schema indexes', () => {
  it('keeps standalone source application IDs null ObjectId fields', () => {
    const sourceApplicationPath = StudentModel.schema.path(
      'sourceApplicationId',
    );

    expect(sourceApplicationPath.instance).toBe('ObjectId');
    expect(sourceApplicationPath.options.default).toBeNull();
  });

  describe('staff member schema', () => {
    it('supports employment, personal and teaching profile fields', () => {
      const schema = StaffMemberModel.schema;
      expect(schema.path('employeeCode').instance).toBe('String');
      expect(schema.path('dateOfBirth').instance).toBe('Date');
      expect(schema.path('gender').instance).toBe('String');
      expect(schema.path('qualifications').instance).toBe('Array');
      expect(schema.path('subjects').instance).toBe('Array');
      expect(schema.path('designation').instance).toBe('String');
      expect(schema.path('campusId').instance).toBe('ObjectId');
      expect(schema.path('status').options.enum).toContain('terminated');
    });
  });

  it('enforces application uniqueness only for ObjectId source application IDs', () => {
    const index = StudentModel.schema
      .indexes()
      .find(([, options]) => options.name === 'uniq_student_applicant_record');

    expect(index).toBeDefined();
    expect(index?.[0]).toEqual({
      organizationId: 1,
      sourceApplicationId: 1,
    });
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: {
        sourceApplicationId: { $type: 'objectId' },
      },
    });
    expect(index?.[1]).not.toHaveProperty('sparse');
  });
});
