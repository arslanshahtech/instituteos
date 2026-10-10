import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { FormField } from '../components/ui/FormField.js';
import type { StudentRecord } from '../students/students-api.js';
import type { GuardianInput, GuardianRecord } from './guardians-api.js';

const schema = z.object({
  firstName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  lastName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
  phone: z.string().trim().max(40, 'Use 40 characters or fewer.'),
  email: z
    .string()
    .trim()
    .max(254, 'Use 254 characters or fewer.')
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Enter a valid email address.',
    ),
  communicationPreference: z.enum(['sms', 'email', 'both']),
});

type FormValues = z.infer<typeof schema> & { studentId: string };

export function GuardianForm({
  guardian,
  students,
  studentSearch,
  onStudentSearchChange,
  selectedStudentId,
  onStudentChange,
  requireStudent,
  canLinkStudent,
  studentError,
  isSaving,
  saveError,
  onSubmit,
}: {
  guardian?: GuardianRecord;
  students: StudentRecord[];
  studentSearch: string;
  onStudentSearchChange: (search: string) => void;
  selectedStudentId: string;
  onStudentChange: (studentId: string) => void;
  requireStudent: boolean;
  canLinkStudent: boolean;
  studentError?: string;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: GuardianInput, studentId?: string) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(
      schema.extend({
        studentId: requireStudent
          ? z.string().min(1, 'Select a student.')
          : z.string(),
      }),
    ),
    defaultValues: {
      firstName: guardian?.firstName ?? '',
      lastName: guardian?.lastName ?? '',
      relationship: guardian?.relationship ?? 'guardian',
      phone: guardian?.phone ?? '',
      email: guardian?.email ?? '',
      communicationPreference: guardian?.communicationPreference ?? 'both',
      studentId: selectedStudentId,
    },
    mode: 'onBlur',
  });

  const submit = form.handleSubmit((values) => {
    const input: GuardianInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      relationship: values.relationship,
      communicationPreference: values.communicationPreference,
    };
    if (values.phone) input.phone = values.phone;
    if (values.email) input.email = values.email;
    onSubmit(input, canLinkStudent ? values.studentId || undefined : undefined);
  });

  return (
    <form className="student-form" noValidate onSubmit={submit}>
      <div className="student-form-grid">
        <FormField
          autoComplete="given-name"
          error={form.formState.errors.firstName?.message}
          label="First name"
          maxLength={80}
          {...form.register('firstName')}
        />
        <FormField
          autoComplete="family-name"
          error={form.formState.errors.lastName?.message}
          label="Last name"
          maxLength={80}
          {...form.register('lastName')}
        />
        <FormField
          error={form.formState.errors.relationship?.message}
          label="Relationship"
          {...form.register('relationship')}
        >
          <select id="relationship" {...form.register('relationship')}>
            <option value="father">Father</option>
            <option value="mother">Mother</option>
            <option value="guardian">Guardian</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField
          autoComplete="tel"
          error={form.formState.errors.phone?.message}
          label="Phone"
          maxLength={40}
          type="tel"
          {...form.register('phone')}
        />
        <FormField
          autoComplete="email"
          error={form.formState.errors.email?.message}
          label="Email"
          maxLength={254}
          type="email"
          {...form.register('email')}
        />
        <FormField
          error={form.formState.errors.communicationPreference?.message}
          label="Communication preference"
          {...form.register('communicationPreference')}
        >
          <select
            id="communicationPreference"
            {...form.register('communicationPreference')}
          >
            <option value="both">Email and SMS</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </FormField>
        {canLinkStudent && !guardian && (
          <>
            <label className="form-field">
              <span>Find student</span>
              <input
                autoComplete="off"
                onChange={(event) => onStudentSearchChange(event.target.value)}
                placeholder="Search by student name"
                value={studentSearch}
              />
            </label>
            <FormField
              error={form.formState.errors.studentId?.message}
              label="Link to student"
            >
              <select
                id="studentId"
                {...form.register('studentId', {
                  onChange: (event) => onStudentChange(event.target.value),
                })}
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}
      </div>
      {studentError && (
        <p className="form-error" role="alert">
          Student choices could not be loaded: {studentError}
        </p>
      )}
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="button-row">
        <Button disabled={isSaving} type="submit" variant="primary">
          {isSaving ? 'Saving…' : guardian ? 'Save changes' : 'Create guardian'}
        </Button>
      </div>
    </form>
  );
}
