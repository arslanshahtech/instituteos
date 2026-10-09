import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { FormField } from '../components/ui/FormField.js';
import type { Campus } from '../organizations/organizations-api.js';
import type { StudentInput, StudentRecord } from './students-api.js';

const studentFieldsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Enter at least two characters.')
    .max(80, 'Use 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Enter at least two characters.')
    .max(80, 'Use 80 characters or fewer.'),
  preferredName: z.string().trim().max(80, 'Use 80 characters or fewer.'),
  dateOfBirth: z.string(),
  gender: z.string().trim().max(40, 'Use 40 characters or fewer.'),
  status: z.enum(['active', 'inactive', 'withdrawn']),
  contactEmail: z
    .string()
    .trim()
    .max(254, 'Use 254 characters or fewer.')
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Enter a valid email address.',
    ),
  phone: z.string().trim().max(40, 'Use 40 characters or fewer.'),
  campusId: z.string(),
});

type StudentFormValues = z.infer<typeof studentFieldsSchema>;

function studentSchema(campusRequired: boolean) {
  return studentFieldsSchema.extend({
    campusId: campusRequired
      ? z.string().min(1, 'Select a campus.')
      : z.string(),
  });
}

function initialValues(student?: StudentRecord): StudentFormValues {
  return {
    firstName: student?.firstName ?? '',
    lastName: student?.lastName ?? '',
    preferredName: student?.preferredName ?? '',
    dateOfBirth: student?.dateOfBirth?.slice(0, 10) ?? '',
    gender: student?.gender ?? '',
    status: student?.status ?? 'active',
    contactEmail: student?.contactEmail ?? '',
    phone: student?.phone ?? '',
    campusId: student?.campusId ?? '',
  };
}

export function StudentForm({
  student,
  campuses,
  canAssignCampus,
  campusRequired,
  campusError,
  isSaving,
  saveError,
  onSubmit,
}: {
  student?: StudentRecord;
  campuses: Campus[];
  canAssignCampus: boolean;
  campusRequired: boolean;
  campusError?: string;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: StudentInput) => void;
}) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema(campusRequired)),
    defaultValues: initialValues(student),
    mode: 'onBlur',
  });

  const submit = form.handleSubmit((values) => {
    const input: StudentInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      status: values.status,
    };
    if (values.preferredName) input.preferredName = values.preferredName;
    if (values.dateOfBirth) input.dateOfBirth = values.dateOfBirth;
    if (values.gender) input.gender = values.gender;
    if (values.contactEmail) input.contactEmail = values.contactEmail;
    if (values.phone) input.phone = values.phone;
    if (canAssignCampus && values.campusId) input.campusId = values.campusId;
    onSubmit(input);
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
          error={form.formState.errors.preferredName?.message}
          label="Preferred name"
          maxLength={80}
          {...form.register('preferredName')}
        />
        <FormField
          error={form.formState.errors.dateOfBirth?.message}
          label="Date of birth"
          type="date"
          {...form.register('dateOfBirth')}
        />
        <FormField
          error={form.formState.errors.gender?.message}
          label="Gender"
          maxLength={40}
          {...form.register('gender')}
        />
        <FormField
          error={form.formState.errors.status?.message}
          label="Status"
          {...form.register('status')}
        >
          <select id="status" {...form.register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </FormField>
        <FormField
          autoComplete="email"
          error={form.formState.errors.contactEmail?.message}
          label="Contact email"
          maxLength={254}
          type="email"
          {...form.register('contactEmail')}
        />
        <FormField
          autoComplete="tel"
          error={form.formState.errors.phone?.message}
          label="Phone"
          maxLength={40}
          type="tel"
          {...form.register('phone')}
        />
        {canAssignCampus && (
          <FormField
            error={form.formState.errors.campusId?.message}
            label="Campus"
            {...form.register('campusId')}
          >
            <select id="campusId" {...form.register('campusId')}>
              {!campusRequired && <option value="">No campus assigned</option>}
              {student?.campusId &&
                !campuses.some((campus) => campus.id === student.campusId) && (
                  <option value={student.campusId}>Current campus</option>
                )}
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                  {campus.status === 'inactive' ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </div>
      {campusError && (
        <p className="form-error" role="alert">
          Campus choices could not be loaded: {campusError}
        </p>
      )}
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="button-row">
        <Button disabled={isSaving} type="submit" variant="primary">
          {isSaving ? 'Saving…' : student ? 'Save changes' : 'Create student'}
        </Button>
      </div>
    </form>
  );
}
