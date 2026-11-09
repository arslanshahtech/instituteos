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

  it('creates an academic session with only a name and optional description', async () => {
    const onSubmit = vi.fn();
    render(
      <AcademicsForm
        resource="academic-years"
        choices={{}}
        isSaving={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Session Name *'), {
      target: { value: '2027-2028' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Next academic session' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '2027-2028',
        description: 'Next academic session',
        status: 'archived',
      }),
    );
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('startDate');
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('endDate');
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
