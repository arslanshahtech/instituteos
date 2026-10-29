import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { FormField } from '../components/ui/FormField.js';
import type {
  AcademicsFormPayload,
  AcademicsResource,
} from './academics-api.js';

interface FormValues {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  academicYearId: string;
  campusId: string;
  classId: string;
  capacity: string;
  department: string;
  teacherStaffId: string;
  subjectId: string;
  sectionId: string;
}

interface Choice {
  value: string;
  label: string;
}

interface Field {
  name: keyof FormValues;
  label: string;
  type?: 'date' | 'number' | 'select';
  choices?: Choice[];
}

function schemaForResource(resource: AcademicsResource) {
  return z
    .object({
      name: z.string().trim().max(120, 'Use 120 characters or fewer.'),
      code: z.string().trim().max(30, 'Use 30 characters or fewer.'),
      startDate: z.string(),
      endDate: z.string(),
      status: z.enum(['active', 'archived']),
      academicYearId: z.string(),
      campusId: z.string(),
      classId: z.string(),
      capacity: z
        .string()
        .refine(
          (value) =>
            value === '' ||
            (/^\d+$/.test(value) &&
              Number(value) >= 1 &&
              Number(value) <= 10000),
          'Enter a whole number from 1 to 10,000.',
        ),
      department: z.string().trim().max(100, 'Use 100 characters or fewer.'),
      teacherStaffId: z.string(),
      subjectId: z.string(),
      sectionId: z.string(),
    })
    .superRefine((values, context) => {
      const requiredByResource: Record<
        AcademicsResource,
        (keyof FormValues)[]
      > = {
        'academic-years': ['name', 'startDate', 'endDate'],
        terms: ['name', 'academicYearId', 'startDate', 'endDate'],
        classes: ['name', 'code', 'campusId'],
        sections: ['name', 'classId'],
        subjects: ['name', 'code'],
        'teacher-assignments': [
          'teacherStaffId',
          'subjectId',
          'classId',
          'sectionId',
          'academicYearId',
        ],
      };
      for (const key of requiredByResource[resource] ?? []) {
        if (typeof values[key] !== 'string' || !values[key].trim())
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'This field is required.',
          });
      }
      if (resource === 'academic-years' || resource === 'terms') {
        for (const key of ['startDate', 'endDate'] as const) {
          const value = values[key];
          const parsed = value ? new Date(`${value}T00:00:00.000Z`) : undefined;
          if (
            value &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              !parsed ||
              Number.isNaN(parsed.getTime()) ||
              parsed.toISOString().slice(0, 10) !== value)
          ) {
            context.addIssue({
              code: 'custom',
              path: [key],
              message: 'Enter a valid date.',
            });
          }
        }
        if (
          values.startDate &&
          values.endDate &&
          values.endDate <= values.startDate
        ) {
          context.addIssue({
            code: 'custom',
            path: ['endDate'],
            message: 'End date must be after start date.',
          });
        }
      }
    });
}

const fieldsByResource: Record<AcademicsResource, Field[]> = {
  'academic-years': [
    { name: 'name', label: 'Academic year name' },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'endDate', label: 'End date', type: 'date' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      choices: [
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Archived' },
      ],
    },
  ],
  terms: [
    { name: 'name', label: 'Term / semester name' },
    { name: 'academicYearId', label: 'Academic year', type: 'select' },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'endDate', label: 'End date', type: 'date' },
  ],
  classes: [
    { name: 'name', label: 'Class name' },
    { name: 'code', label: 'Class code' },
    { name: 'campusId', label: 'Campus', type: 'select' },
  ],
  sections: [
    { name: 'name', label: 'Section name' },
    { name: 'classId', label: 'Class', type: 'select' },
    { name: 'capacity', label: 'Capacity', type: 'number' },
  ],
  subjects: [
    { name: 'name', label: 'Subject name' },
    { name: 'code', label: 'Subject code' },
    { name: 'department', label: 'Department' },
  ],
  'teacher-assignments': [
    { name: 'teacherStaffId', label: 'Teacher', type: 'select' },
    { name: 'subjectId', label: 'Subject', type: 'select' },
    { name: 'classId', label: 'Class', type: 'select' },
    { name: 'sectionId', label: 'Section', type: 'select' },
    { name: 'academicYearId', label: 'Academic year', type: 'select' },
  ],
};

const emptyValues: FormValues = {
  name: '',
  code: '',
  startDate: '',
  endDate: '',
  status: 'active',
  academicYearId: '',
  campusId: '',
  classId: '',
  capacity: '',
  department: '',
  teacherStaffId: '',
  subjectId: '',
  sectionId: '',
};

export function AcademicsForm({
  resource,
  record,
  choices,
  isSaving,
  saveError,
  onSubmit,
}: {
  resource: AcademicsResource;
  record?: Record<string, unknown>;
  choices: Partial<Record<keyof FormValues, Choice[]>>;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: AcademicsFormPayload) => void;
}) {
  const initialValues = useMemo(() => {
    const value = (key: keyof FormValues) =>
      record?.[key] == null ? emptyValues[key] : String(record[key]);
    return {
      name: value('name'),
      code: value('code'),
      startDate: value('startDate'),
      endDate: value('endDate'),
      status:
        value('status') === 'archived'
          ? ('archived' as const)
          : ('active' as const),
      academicYearId: value('academicYearId'),
      campusId:
        value('campusId') ||
        (resource === 'classes' && choices.campusId?.length === 1
          ? choices.campusId[0]!.value
          : ''),
      classId: value('classId'),
      capacity: value('capacity'),
      department: value('department'),
      teacherStaffId: value('teacherStaffId'),
      subjectId: value('subjectId'),
      sectionId: value('sectionId'),
    };
  }, [
    record,
    resource,
    choices.campusId?.length,
    choices.campusId?.[0]?.value,
  ]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaForResource(resource)),
    defaultValues: initialValues,
    mode: 'onBlur',
  });
  const { reset } = form;
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, resource, reset]);

  const submit = form.handleSubmit((values) => {
    const input: AcademicsFormPayload = { ...values };
    if (resource === 'sections')
      input.capacity = values.capacity ? Number(values.capacity) : '';
    else delete input.capacity;
    if (resource !== 'subjects') delete input.department;
    if (resource !== 'academic-years') delete input.status;
    for (const [key, value] of Object.entries(input)) {
      if (
        value === '' &&
        !(
          (resource === 'sections' && key === 'capacity') ||
          (resource === 'subjects' && key === 'department')
        )
      ) {
        delete input[key];
      }
    }
    if (resource === 'academic-years') input.status = values.status;
    onSubmit(input);
  });

  return (
    <form className="student-form academics-form" noValidate onSubmit={submit}>
      <div className="student-form-grid">
        {fieldsByResource[resource].map((field) => {
          const error = form.formState.errors[field.name]?.message;
          const fieldChoices = choices[field.name] ?? field.choices ?? [];
          if (field.type === 'select') {
            return (
              <FormField
                error={error}
                key={field.name}
                label={field.label}
                name={field.name}
              >
                <select id={field.name} {...form.register(field.name)}>
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {fieldChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                {field.name === 'campusId' && fieldChoices.length === 0 && (
                  <p className="form-help-text">
                    No campus is set up yet. A campus means your school branch
                    or location. Create one in organization campus settings,
                    then return here to create the class.
                  </p>
                )}
                {field.name === 'campusId' && fieldChoices.length === 1 && (
                  <p className="form-help-text">
                    Your only campus is selected automatically.
                  </p>
                )}
              </FormField>
            );
          }
          return (
            <FormField
              error={error}
              key={field.name}
              label={field.label}
              maxLength={field.name === 'name' ? 120 : 100}
              type={field.type}
              {...form.register(field.name)}
            />
          );
        })}
      </div>
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="button-row">
        <Button disabled={isSaving} type="submit" variant="primary">
          {isSaving ? 'Saving…' : record ? 'Save changes' : 'Create record'}
        </Button>
      </div>
    </form>
  );
}
