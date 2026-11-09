import { describe, expect, it } from 'vitest';
import { EnrollmentModel, StaffMemberModel, StudentModel } from './people.model.js';

describe('student schema indexes', () => {
  it('enforces registration uniqueness only for actual registration strings', () => {
    const index = StudentModel.schema
      .indexes()
      .find(([, options]) => options.name === 'uniq_student_registration_number');

    expect(index).toBeDefined();
    expect(index?.[0]).toEqual({ organizationId: 1, registrationNumber: 1 });
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { registrationNumber: { $type: 'string' } },
    });
    expect(index?.[1]).not.toHaveProperty('sparse');
  });

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
      expect(schema.path('userId').instance).toBe('ObjectId');
      expect(schema.path('status').options.enum).toContain('terminated');
      const accountIndex = schema
        .indexes()
        .find(
          ([, options]) =>
            options.name === 'uniq_staff_account_per_organization',
        );
      expect(accountIndex?.[0]).toEqual({ organizationId: 1, userId: 1 });
      expect(accountIndex?.[1]).toMatchObject({
        unique: true,
        partialFilterExpression: { userId: { $type: 'objectId' } },
      });
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

describe('enrollment schema indexes', () => {
  it('enforces application uniqueness only when a source application ObjectId exists', () => {
    const index = EnrollmentModel.schema
      .indexes()
      .find(([, options]) => options.name === 'uniq_enrollment_application_record');

    expect(index).toBeDefined();
    expect(index?.[0]).toEqual({ organizationId: 1, sourceApplicationId: 1 });
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { sourceApplicationId: { $type: 'objectId' } },
    });
    expect(index?.[1]).not.toHaveProperty('sparse');
  });
});