import { useState } from 'react';
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
  staffType: z.enum(['teacher', 'other_staff']),
  department: z.string().trim().max(100),
  designation: z.string().trim().max(100),
  status: z.enum(['active', 'on_leave', 'terminated', 'inactive']),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === '' || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value),
      'Enter a valid email address.',
    ),
  phone: z.string().trim().max(40),
  dateOfBirth: z
    .string()
    .refine(
      (value) =>
        value === '' ||
        (/^\\d{4}-\\d{2}-\\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value + 'T00:00:00.000Z')) &&
          new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) ===
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

const steps = [
  {
    title: 'Personal information',
    description: 'Basic identity and contact details',
  },
  {
    title: 'Professional details',
    description: 'Role, department and teaching profile',
  },
  {
    title: 'Review & account',
    description: 'Check details before creating the record',
  },
] as const;

function initialValues(staff?: StaffRecord): FormValues {
  return {
    firstName: staff?.firstName ?? '',
    lastName: staff?.lastName ?? '',
    employeeCode: staff?.employeeCode ?? '',
    staffType: staff?.staffType ?? 'other_staff',
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
  setupOptions = { departments: [], designations: [], qualifications: [] },
  campuses,
  canAssignCampus,
  campusRequired,
  campusError,
  isSaving,
  saveError,
  onSubmit,
}: {
  staff?: StaffRecord;
  setupOptions?: { departments: string[]; designations: string[]; qualifications: string[] };
  campuses: Campus[];
  canAssignCampus: boolean;
  campusRequired: boolean;
  campusError?: string;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: StaffInput) => void;
}) {
  const [activeStep, setActiveStep] = useState(0);
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

  const stepFields: Array<Array<keyof FormValues>> = [
    ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender'],
    [
      'employeeCode',
      'staffType',
      'department',
      'designation',
      'status',
      'qualification',
      'qualifications',
      'subjects',
      'campusId',
    ],
    [],
  ];

  const goNext = async () => {
    const valid = await form.trigger(stepFields[activeStep]);
    if (valid) setActiveStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const submit = form.handleSubmit((values) => {
    const input: StaffInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      employeeCode: values.employeeCode,
      staffType: values.staffType,
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

  const values = form.watch();
  const fullName = [values.firstName, values.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <form
      className="student-form staff-form staff-wizard"
      noValidate
      onSubmit={submit}
    >
      <div className="staff-wizard-progress" aria-label="Staff form progress">
        {steps.map((step, index) => (
          <div
            className={
              index === activeStep
                ? 'staff-wizard-step is-current'
                : index < activeStep
                  ? 'staff-wizard-step is-complete'
                  : 'staff-wizard-step'
            }
            key={step.title}
          >
            <span className="staff-wizard-step-number">
              {index < activeStep ? '✓' : index + 1}
            </span>
            <span className="staff-wizard-step-copy">
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
          </div>
        ))}
      </div>

      {activeStep === 0 && (
        <section
          className="staff-wizard-section"
          aria-labelledby="staff-personal-heading"
        >
          <div className="staff-wizard-section-heading">
            <span className="staff-wizard-eyebrow">STEP 01 · PERSONAL</span>
            <h2 id="staff-personal-heading">Personal information</h2>
            <p>
              Start with the staff member’s name and the best way to contact
              them.
            </p>
          </div>
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
              autoComplete="email"
              error={form.formState.errors.email?.message}
              hint="If this person needs portal access, use the email address they will use for their invitation."
              label="Contact email"
              maxLength={254}
              type="email"
              {...form.register('email')}
            />
            <FormField
              autoComplete="tel"
              error={form.formState.errors.phone?.message}
              label="Phone number"
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
          </div>
          <p className="staff-wizard-required-note">
            * Required fields. Other personal fields can be added when the Staff
            API supports them.
          </p>
        </section>
      )}

      {activeStep === 1 && (
        <section
          className="staff-wizard-section"
          aria-labelledby="staff-professional-heading"
        >
          <div className="staff-wizard-section-heading">
            <span className="staff-wizard-eyebrow">STEP 02 · EMPLOYMENT</span>
            <h2 id="staff-professional-heading">Professional details</h2>
            <p>
              Add the employee’s school role, department and professional
              background.
            </p>
          </div>
          <div className="student-form-grid">
            <FormField
              error={form.formState.errors.employeeCode?.message}
              hint="Optional for now; use the school’s existing employee ID if available."
              label="Employee ID / code"
              maxLength={40}
              {...form.register('employeeCode')}
            />
            <FormField
              error={form.formState.errors.staffType?.message}
              label="Staff type"
            >
              <select id="staffType" {...form.register('staffType')}>
                <option value="teacher">Teacher</option>
                <option value="other_staff">Other Staff</option>
              </select>
            </FormField>
            <FormField error={form.formState.errors.department?.message} label="Department">
              <input list="staff-department-options" maxLength={100} {...form.register('department')} />
              <datalist id="staff-department-options">{setupOptions.departments.map((item) => <option key={item} value={item} />)}</datalist>
            </FormField>
            <FormField error={form.formState.errors.designation?.message} label="Designation / job title">
              <input list="staff-designation-options" maxLength={100} {...form.register('designation')} />
              <datalist id="staff-designation-options">{setupOptions.designations.map((item) => <option key={item} value={item} />)}</datalist>
            </FormField>
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
            <FormField error={form.formState.errors.qualification?.message} label="Highest qualification">
              <input list="staff-qualification-options" maxLength={240} {...form.register('qualification')} />
              <datalist id="staff-qualification-options">{setupOptions.qualifications.map((item) => <option key={item} value={item} />)}</datalist>
            </FormField>
            <FormField
              error={form.formState.errors.qualifications?.message}
              hint="Separate multiple qualifications with commas."
              label="Additional qualifications"
              {...form.register('qualifications')}
            />
            <FormField
              error={form.formState.errors.subjects?.message}
              hint="For teaching staff, enter subjects they teach. Separate with commas."
              label="Subjects / specialization"
              {...form.register('subjects')}
            />
            {canAssignCampus && (
              <FormField
                error={form.formState.errors.campusId?.message}
                label="Campus"
              >
                <select id="campusId" {...form.register('campusId')}>
                  {!campusRequired && (
                    <option value="">No campus assigned</option>
                  )}
                  {staff?.campusId &&
                    !campuses.some(
                      (campus) => campus.id === staff.campusId,
                    ) && <option value={staff.campusId}>Current campus</option>}
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
        </section>
      )}

      {activeStep === 2 && (
        <section
          className="staff-wizard-section"
          aria-labelledby="staff-review-heading"
        >
          <div className="staff-wizard-section-heading">
            <span className="staff-wizard-eyebrow">STEP 03 · CONFIRM</span>
            <h2 id="staff-review-heading">Review & account access</h2>
            <p>Check the details below before saving this staff record.</p>
          </div>
          <div className="staff-review-card">
            <div className="staff-review-card-heading">
              <div className="staff-review-avatar">
                {fullName
                  ? fullName
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'ST'}
              </div>
              <div>
                <strong>{fullName || 'New staff member'}</strong>
                <span>{values.designation || 'Designation not provided'}</span>
              </div>
              <span className="staff-review-status">
                {values.status.replace('_', ' ')}
              </span>
            </div>
            <dl className="staff-review-grid">
              <div>
                <dt>Employee ID</dt>
                <dd>{values.employeeCode || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{values.department || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Campus</dt>
                <dd>
                  {campuses.find((campus) => campus.id === values.campusId)
                    ?.name ||
                    (campusRequired ? 'Required campus' : 'Not assigned')}
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{values.email || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{values.phone || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Qualification</dt>
                <dd>{values.qualification || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Subjects</dt>
                <dd>{values.subjects || 'Not provided'}</dd>
              </div>
            </dl>
          </div>
          <div className="staff-account-note">
            <strong>Portal access is managed separately</strong>
            <p>
              Creating this staff profile does not create a login account. To
              give a teacher or staff member portal access, use the existing
              organization member invitation flow with the same email address.
            </p>
          </div>
          <div className="staff-account-note staff-account-note-muted">
            <strong>Documents & additional HR details</strong>
            <p>
              Secure document uploads, CNIC, address, emergency contact and
              joining-date fields are not part of the current Staff API yet. We
              will connect these only after the backend and secure file-storage
              support are ready.
            </p>
          </div>
        </section>
      )}

      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="staff-wizard-actions">
        <div>
          {activeStep > 0 && (
            <Button
              disabled={isSaving}
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
              type="button"
              variant="secondary"
            >
              Back
            </Button>
          )}
        </div>
        {activeStep < steps.length - 1 ? (
          <Button
            disabled={isSaving}
            onClick={() => void goNext()}
            type="button"
            variant="primary"
          >
            Continue
          </Button>
        ) : (
          <Button disabled={isSaving} type="submit" variant="primary">
            {isSaving
              ? 'Saving...'
              : staff
                ? 'Save staff changes'
                : 'Create staff member'}
          </Button>
        )}
      </div>
    </form>
  );
}
