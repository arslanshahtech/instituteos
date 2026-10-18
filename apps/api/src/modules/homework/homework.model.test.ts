import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { HomeworkTestModel } from './homework.model.js';

const oid = () => new mongoose.Types.ObjectId();
function validInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: oid(),
    campusId: oid(),
    academicYearId: oid(),
    classId: oid(),
    sectionId: oid(),
    subjectId: oid(),
    title: 'Fractions exercise',
    instructions: 'Complete questions 1-10.',
    type: 'homework',
    dueDate: new Date('2026-11-01T00:00:00.000Z'),
    createdBy: oid(),
    ...overrides,
  };
}

describe('HomeworkTestModel', () => {
  it('accepts a scoped homework record and defaults it to published', async () => {
    const record = new HomeworkTestModel(validInput());
    await record.validate();
    expect(record.status).toBe('published');
    expect(record.type).toBe('homework');
  });

  it('accepts a test with total marks', async () => {
    const record = new HomeworkTestModel(
      validInput({ type: 'test', totalMarks: 25 }),
    );
    await record.validate();
    expect(record.totalMarks).toBe(25);
  });

  it('rejects a homework/test type outside the allowed enum', async () => {
    const record = new HomeworkTestModel(validInput({ type: 'project' }));
    await expect(record.validate()).rejects.toMatchObject({
      errors: { type: expect.any(Object) },
    });
  });

  it('rejects missing class and section scope', async () => {
    const record = new HomeworkTestModel(
      validInput({ classId: undefined, sectionId: undefined }),
    );
    await expect(record.validate()).rejects.toMatchObject({
      errors: {
        classId: expect.any(Object),
        sectionId: expect.any(Object),
      },
    });
  });

  it('rejects negative total marks', async () => {
    const record = new HomeworkTestModel(
      validInput({ type: 'test', totalMarks: -1 }),
    );
    await expect(record.validate()).rejects.toMatchObject({
      errors: { totalMarks: expect.any(Object) },
    });
  });
});
