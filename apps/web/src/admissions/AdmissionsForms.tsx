import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { FormField } from '../components/ui/FormField.js';
import type { Campus } from '../organizations/organizations-api.js';
import type { ApplicationInput, InquiryInput } from './admissions-api.js';

const applicantFields = {
  firstName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  lastName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Enter a valid email address.',
    ),
  phone: z.string().trim().max(40),
  campusId: z.string(),
  source: z.string().trim().max(80),
  notes: z.string().trim().max(1200),
};

const inquirySchema = z.object({
  ...applicantFields,
  gradeLevelInterest: z.string().trim().max(80),
});
type InquiryValues = z.infer<typeof inquirySchema>;

const applicationSchema = z.object({
  fullName: z.string().trim().min(5, 'Enter the student’s full name.').max(160)
    .refine((value) => value.trim().split(/\s+/).length >= 2, 'Enter first and last name.'),
  dateOfBirth: z.string().min(1, 'Select the date of birth.'),
  program: z.string().trim().min(1, 'Select a class or grade.').max(120),
  guardianName: z.string().trim().min(2, 'Enter the guardian’s name.').max(160),
  guardianPhone: z.string().trim().min(7, 'Enter a valid guardian phone number.').max(40),
  feePlan: z.enum(['Standard', 'Scholarship', 'Sibling plan']),
  campusId: z.string(),
});
type ApplicationValues = z.infer<typeof applicationSchema>;

function CampusSelect({
  campuses,
  campusRequired,
  registration,
  error,
}: {
  campuses: Campus[];
  campusRequired: boolean;
  registration: UseFormRegisterReturn<'campusId'>;
  error?: string;
}) {
  return (
    <FormField error={error} label="Campus of interest" name="campusId">
      <select id="campusId" {...registration}>
        {!campusRequired && <option value="">No campus selected</option>}
        {campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function ApplicantFields({
  campuses,
  campusRequired,
  registrations,
  errors,
}: {
  campuses: Campus[];
  campusRequired: boolean;
  registrations: {
    firstName: UseFormRegisterReturn<'firstName'>;
    lastName: UseFormRegisterReturn<'lastName'>;
    email: UseFormRegisterReturn<'email'>;
    phone: UseFormRegisterReturn<'phone'>;
    campusId: UseFormRegisterReturn<'campusId'>;
    source: UseFormRegisterReturn<'source'>;
    notes: UseFormRegisterReturn<'notes'>;
  };
  errors: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    campusId?: string;
    source?: string;
    notes?: string;
  };
}) {
  return (
    <>
      <FormField
        autoComplete="given-name"
        error={errors.firstName}
        label="Applicant first name"
        maxLength={80}
        {...registrations.firstName}
      />
      <FormField
        autoComplete="family-name"
        error={errors.lastName}
        label="Applicant last name"
        maxLength={80}
        {...registrations.lastName}
      />
      <FormField
        autoComplete="email"
        error={errors.email}
        label="Contact email"
        maxLength={254}
        type="email"
        {...registrations.email}
      />
      <FormField
        autoComplete="tel"
        error={errors.phone}
        label="Phone"
        maxLength={40}
        type="tel"
        {...registrations.phone}
      />
      <CampusSelect
        campuses={campuses}
        campusRequired={campusRequired}
        registration={registrations.campusId}
        error={errors.campusId}
      />
      <FormField
        error={errors.source}
        label="How did they hear about us?"
        maxLength={80}
        {...registrations.source}
      />
      <FormField
        error={errors.notes}
        label="Notes"
        maxLength={1200}
        {...registrations.notes}
      />
    </>
  );
}

export function InquiryForm({
  campuses,
  campusRequired,
  isSaving,
  saveError,
  onSubmit,
}: {
  campuses: Campus[];
  campusRequired: boolean;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: InquiryInput) => void;
}) {
  const form = useForm<InquiryValues>({
    resolver: zodResolver(
      inquirySchema.extend({
        campusId: campusRequired
          ? z.string().min(1, 'Select a campus.')
          : z.string(),
      }),
    ),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      campusId: '',
      source: '',
      notes: '',
      gradeLevelInterest: '',
    },
    mode: 'onBlur',
  });
  return (
    <form
      className="student-form"
      noValidate
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          firstName: values.firstName,
          lastName: values.lastName,
          ...(values.email ? { email: values.email } : {}),
          ...(values.phone ? { phone: values.phone } : {}),
          ...(values.campusId ? { campusId: values.campusId } : {}),
          ...(values.source ? { source: values.source } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
          ...(values.gradeLevelInterest
            ? { gradeLevelInterest: values.gradeLevelInterest }
            : {}),
        }),
      )}
    >
      <div className="student-form-grid">
        <ApplicantFields
          campuses={campuses}
          campusRequired={campusRequired}
          registrations={{
            firstName: form.register('firstName'),
            lastName: form.register('lastName'),
            email: form.register('email'),
            phone: form.register('phone'),
            campusId: form.register('campusId'),
            source: form.register('source'),
            notes: form.register('notes'),
          }}
          errors={{
            firstName: form.formState.errors.firstName?.message,
            lastName: form.formState.errors.lastName?.message,
            email: form.formState.errors.email?.message,
            phone: form.formState.errors.phone?.message,
            campusId: form.formState.errors.campusId?.message,
            source: form.formState.errors.source?.message,
            notes: form.formState.errors.notes?.message,
          }}
        />
        <FormField
          error={form.formState.errors.gradeLevelInterest?.message}
          label="Grade level of interest"
          maxLength={80}
          {...form.register('gradeLevelInterest')}
        />
      </div>
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <Button disabled={isSaving} type="submit" variant="primary">
        {isSaving ? 'Saving…' : 'Create inquiry'}
      </Button>
    </form>
  );
}

export function ApplicationForm({
  campuses,
  campusRequired,
  isSaving,
  saveError,
  onSubmit,
}: {
  campuses: Campus[];
  campusRequired: boolean;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: ApplicationInput) => void;
}) {
  const form = useForm<ApplicationValues>({
    resolver: zodResolver(
      applicationSchema.extend({
        campusId: campusRequired
          ? z.string().min(1, 'Select a campus.')
          : z.string(),
      }),
    ),
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      program: '',
      guardianName: '',
      guardianPhone: '',
      feePlan: 'Standard',
      campusId: '',
    },
    mode: 'onBlur',
  });

  return (
    <form
      className="student-form reference-admission-form"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        const [firstName, ...lastNameParts] = values.fullName.trim().split(/\s+/);
        onSubmit({
          firstName: firstName!,
          lastName: lastNameParts.join(' '),
          status: 'submitted',
          phone: values.guardianPhone,
          ...(values.campusId ? { preferredCampusId: values.campusId } : {}),
          program: values.program,
          dateOfBirth: values.dateOfBirth,
          guardianName: values.guardianName,
          guardianPhone: values.guardianPhone,
          feePlan: values.feePlan,
        });
      })}
    >
      <div className="student-form-grid">
        <FormField
          error={form.formState.errors.fullName?.message}
          label="Student name"
          maxLength={160}
          {...form.register('fullName')}
        />
        <FormField
          error={form.formState.errors.dateOfBirth?.message}
          label="Date of birth"
          type="date"
          {...form.register('dateOfBirth')}
        />
        <FormField
          error={form.formState.errors.program?.message}
          label="Class / grade"
          maxLength={120}
          {...form.register('program')}
        />
        <FormField
          error={form.formState.errors.guardianName?.message}
          label="Guardian name"
          maxLength={160}
          {...form.register('guardianName')}
        />
        <FormField
          autoComplete="tel"
          error={form.formState.errors.guardianPhone?.message}
          label="Guardian phone"
          maxLength={40}
          type="tel"
          {...form.register('guardianPhone')}
        />
        <FormField error={form.formState.errors.feePlan?.message} label="Fee plan" name="feePlan">
          <select id="feePlan" {...form.register('feePlan')}>
            <option value="Standard">Standard</option>
            <option value="Scholarship">Scholarship</option>
            <option value="Sibling plan">Sibling plan</option>
          </select>
        </FormField>
        {campusRequired && (
          <CampusSelect
            campuses={campuses}
            campusRequired={campusRequired}
            registration={form.register('campusId')}
            error={form.formState.errors.campusId?.message}
          />
        )}
      </div>
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <Button disabled={isSaving} type="submit" variant="primary">
        {isSaving ? 'Submitting…' : 'Submit for approval'}
      </Button>
    </form>
  );
}
