// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcademicsForm } from './AcademicsForm.js';

afterEach(() => cleanup());

describe('AcademicsForm curriculum validation', () => {
  it('creates a subject with all selected classes and numeric assessment defaults', async () => {
    const onSubmit = vi.fn();
    render(
      <AcademicsForm
        resource="subjects"
        choices={{
          classIds: [
            { value: 'class-1', label: 'Class 9 (C9)' },
            { value: 'class-2', label: 'Class 10 (C10)' },
          ],
        }}
        isSaving={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Subject Name'), {
      target: { value: 'Mathematics' },
    });
    fireEvent.click(screen.getByLabelText('Class 9 (C9)'));
    fireEvent.click(screen.getByLabelText('Class 10 (C10)'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Subject' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mathematics',
        classIds: ['class-1', 'class-2'],
        totalMarks: 100,
        passingPercentage: 40,
      }),
    );
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('classId');
  });

  it('requires at least one class when editing a subject too', async () => {
    const onSubmit = vi.fn();
    render(
      <AcademicsForm
        resource="subjects"
        record={{
          name: 'Mathematics',
          classIds: ['class-1'],
          totalMarks: 100,
          passingPercentage: 40,
        }}
        choices={{
          classIds: [{ value: 'class-1', label: 'Class 9 (C9)' }],
        }}
        isSaving={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByLabelText('Class 9 (C9)'));
    fireEvent.click(screen.getByRole('button', { name: 'Update Subject' }));

    expect(await screen.findByText('Choose a class.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects an academic session whose end date is not after its start date', async () => {
    const onSubmit = vi.fn();
    render(
      <AcademicsForm
        resource="academic-years"
        choices={{}}
        isSaving={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Session name'), {
      target: { value: '2026-2027' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-04-01' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-04-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    expect(await screen.findByText('End date must be later.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('preserves multiple class associations when editing a subject', async () => {
    const onSubmit = vi.fn();
    render(
      <AcademicsForm
        resource="subjects"
        record={{
          name: 'Science',
          classIds: ['class-1', 'class-2'],
          totalMarks: 100,
          passingPercentage: 40,
        }}
        choices={{
          classIds: [
            { value: 'class-1', label: 'Class 9 (C9)' },
            { value: 'class-2', label: 'Class 10 (C10)' },
          ],
        }}
        isSaving={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update Subject' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ classIds: ['class-1', 'class-2'] }),
    );
  });
});
