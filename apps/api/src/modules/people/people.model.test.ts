import { describe, expect, it } from 'vitest';
import { StudentModel } from './people.model.js';

describe('student schema indexes', () => {
  it('keeps standalone source application IDs null ObjectId fields', () => {
    const sourceApplicationPath = StudentModel.schema.path(
      'sourceApplicationId',
    );

    expect(sourceApplicationPath.instance).toBe('ObjectId');
    expect(sourceApplicationPath.options.default).toBeNull();
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
