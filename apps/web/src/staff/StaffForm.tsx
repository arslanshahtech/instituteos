import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { FormField } from '../components/ui/FormField.js';
import type { Campus } from '../organizations/organizations-api.js';
import type { StaffInput, StaffRecord } from './staff-api.js';

const staffSchema = z.object({
  firstName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  lastName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  employeeCode: z.string().trim().max(40),
  department: z.string().trim().max(100),
  designation: z.string().trim().max(100),
  status: z.enum(['active', 'on_leave', 'terminated', 'inactive']),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Enter a valid email address.',
    ),
  phone: z.string().trim().max(40),
  dateOfBirth: z
    .string()
    .refine(
      (value) =>
        value === '' ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
          new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) ===
            value),
      'Enter a valid birth date.',
    ),
  gender: z.string().trim().max(40),
  qualification: z.string().trim().max(240),
  qualifications: z
    .string()
    .max(3200)
    .refine(
      (value) =>
        value === '' ||
        value.split(',').every((item) => item.trim().length <= 160),
      'Each qualification must be 160 characters or fewer.',
    )
    .refine(
      (value) => value.split(',').filter((item) => item.trim()).length <= 20,
      'Enter no more than 20 qualifications.',
    ),
  subjects: z
    .string()
    .max(3000)
    .refine(
      (value) =>
        value === '' ||
        value.split(',').every((item) => item.trim().length <= 100),
      'Each subject must be 100 characters or fewer.',
    )
    .refine(
      (value) => value.split(',').filter((item) => item.trim()).length <= 30,
      'Enter no more than 30 subjects or areas.',
    ),
  campusId: z.string(),
});

type FormValues = z.infer<typeof staffSchema>;

function initialValues(staff?: StaffRecord): FormValues {
  return {
    firstName: staff?.firstName ?? '',
    lastName: staff?.lastName ?? '',
    employeeCode: staff?.employeeCode ?? '',
    department: staff?.department ?? '',
    designation: staff?.designation ?? staff?.role ?? '',
    status: staff?.status ?? 'active',
    email: staff?.email ?? '',
    phone: staff?.phone ?? '',
    dateOfBirth: staff?.dateOfBirth?.slice(0, 10) ?? '',
    gender: staff?.gender ?? '',
    qualification: staff?.qualification ?? '',
    qualifications: staff?.qualifications?.join(', ') ?? '',
    subjects: staff?.subjects?.join(', ') ?? '',
    campusId: staff?.campusId ?? '',
  };
}

function splitValues(value: string): string[] | undefined {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

export function StaffForm({
  staff,
  campuses,
  canAssignCampus,
  campusRequired,
  campusError,
  isSaving,
  saveError,
  onSubmit,
}: {
  staff?: StaffRecord;
  campuses: Campus[];
  canAssignCampus: boolean;
  campusRequired: boolean;
  campusError?: string;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: StaffInput) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(
      staffSchema.extend({
        campusId: campusRequired
          ? z.string().min(1, 'Select a campus.')
          : z.string(),
      }),
    ),
    defaultValues: initialValues(staff),
    mode: 'onBlur',
  });

  const submit = form.handleSubmit((values) => {
    const input: StaffInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      employeeCode: values.employeeCode,
      department: values.department,
      designation: values.designation,
      status: values.status,
      email: values.email,
      phone: values.phone,
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
      qualification: values.qualification,
      qualifications: splitValues(values.qualifications) ?? [],
      subjects: splitValues(values.subjects) ?? [],
      ...(canAssignCampus ? { campusId: values.campusId } : {}),
    };
    onSubmit(input);
  });

  return (
    <form className="student-form staff-form" noValidate onSubmit={submit}>
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
          error={form.formState.errors.employeeCode?.message}
          label="Employee code"
          maxLength={40}
          {...form.register('employeeCode')}
        />
        <FormField
          error={form.formState.errors.department?.message}
          label="Department"
          maxLength={100}
          {...form.register('department')}
        />
        <FormField
          error={form.formState.errors.designation?.message}
          label="Designation / role"
          maxLength={100}
          {...form.register('designation')}
        />
        <FormField
          error={form.formState.errors.status?.message}
          label="Employment status"
        >
          <select id="status" {...form.register('status')}>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
            {staff?.status === 'inactive' && (
              <option value="inactive">Inactive (legacy)</option>
            )}
          </select>
        </FormField>
        <FormField
          autoComplete="email"
          error={form.formState.errors.email?.message}
          label="Contact email"
          maxLength={254}
          type="email"
          {...form.register('email')}
        />
        <FormField
          autoComplete="tel"
          error={form.formState.errors.phone?.message}
          label="Phone"
          maxLength={40}
          type="tel"
          {...form.register('phone')}
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
          error={form.formState.errors.qualification?.message}
          label="Qualification"
          maxLength={240}
          {...form.register('qualification')}
        />
        <FormField
          error={form.formState.errors.qualifications?.message}
          hint="Separate multiple qualifications with commas."
          label="Additional qualifications"
          {...form.register('qualifications')}
        />
        <FormField
          error={form.formState.errors.subjects?.message}
          hint="Separate subjects or areas of specialization with commas."
          label="Subjects / specialization"
          {...form.register('subjects')}
        />
        {canAssignCampus && (
          <FormField
            error={form.formState.errors.campusId?.message}
            label="Campus"
          >
            <select id="campusId" {...form.register('campusId')}>
              {!campusRequired && <option value="">No campus assigned</option>}
              {staff?.campusId &&
                !campuses.some((campus) => campus.id === staff.campusId) && (
                  <option value={staff.campusId}>Current campus</option>
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
          {isSaving
            ? 'Saving...'
            : staff
              ? 'Save changes'
              : 'Create staff member'}
        </Button>
      </div>
    </form>
  );
}
