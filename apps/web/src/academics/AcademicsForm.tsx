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
  sortOrder: string;
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
  studyLevel: '' | 'first_year' | 'second_year' | 'other';
  programName: string;
  classIds: string[];
}

interface Choice {
  value: string;
  label: string;
  classIds?: string[];
}

interface Field {
  name: keyof FormValues;
  label: string;
  type?: 'date' | 'number' | 'select' | 'multiselect';
  choices?: Choice[];
}

function schemaForResource(resource: AcademicsResource, isEditing: boolean) {
  return z
    .object({
      name: z.string().trim().max(120, 'Use 120 characters or fewer.'),
      code: z.string().trim().max(30, 'Use 30 characters or fewer.'),
      sortOrder: z
        .string()
        .refine(
          (value) =>
            value === '' || (/^\d+$/.test(value) && Number(value) <= 100000),
          'Enter a whole number from 0 to 100,000.',
        ),
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
      studyLevel: z.enum(['', 'first_year', 'second_year', 'other']),
      programName: z.string().trim().max(120, 'Use 120 characters or fewer.'),
      classIds: z.array(z.string()),
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
      if (resource === 'subjects' && !isEditing && values.classIds.length === 0)
        context.addIssue({
          code: 'custom',
          path: ['classIds'],
          message: 'Choose at least one class or college group.',
        });
      if (
        resource === 'classes' &&
        values.studyLevel &&
        !values.programName.trim()
      )
        context.addIssue({
          code: 'custom',
          path: ['programName'],
          message: 'Enter the college program/group name.',
        });
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
    { name: 'name', label: 'Class / study level name (e.g. First Year)' },
    { name: 'code', label: 'Class code' },
    { name: 'sortOrder', label: 'Display order', type: 'number' },
    {
      name: 'studyLevel',
      label: 'Study level',
      type: 'select',
      choices: [
        { value: 'first_year', label: 'First Year' },
        { value: 'second_year', label: 'Second Year' },
        { value: 'other', label: 'Other' },
      ],
    },
    { name: 'programName', label: 'Program name (e.g. FSc Pre-Medical)' },
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
    {
      name: 'classIds',
      label: 'Available for classes / groups',
      type: 'multiselect',
    },
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
  sortOrder: '0',
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
  studyLevel: '',
  programName: '',
  classIds: [],
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
    const value = (key: Exclude<keyof FormValues, 'classIds'>): string =>
      record?.[key] == null
        ? (emptyValues[key] as string)
        : String(record[key]);
    return {
      name: value('name'),
      code: value('code'),
      sortOrder: value('sortOrder'),
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
      studyLevel: value('studyLevel') as FormValues['studyLevel'],
      programName: value('programName'),
      classIds: Array.isArray(record?.classIds)
        ? record.classIds.map(String)
        : [],
    };
  }, [
    record,
    resource,
    choices.campusId?.length,
    choices.campusId?.[0]?.value,
  ]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaForResource(resource, Boolean(record))),
    defaultValues: initialValues,
    mode: 'onBlur',
  });
  const { reset } = form;
  const selectedClassId = form.watch('classId');
  const selectedSubjectId = form.watch('subjectId');
  useEffect(() => {
    if (
      resource !== 'teacher-assignments' ||
      !selectedSubjectId ||
      !selectedClassId
    )
      return;
    const selectedSubject = choices.subjectId?.find(
      (choice) => choice.value === selectedSubjectId,
    );
    if (
      selectedSubject?.classIds?.length &&
      !selectedSubject.classIds.includes(selectedClassId)
    )
      form.setValue('subjectId', '', {
        shouldDirty: true,
        shouldValidate: true,
      });
  }, [choices.subjectId, form, resource, selectedClassId, selectedSubjectId]);
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, resource, reset]);

  const submit = form.handleSubmit((values) => {
    const input: AcademicsFormPayload = { ...values };
    if (resource === 'classes')
      input.sortOrder = values.sortOrder === '' ? 0 : Number(values.sortOrder);
    else delete input.sortOrder;
    if (resource === 'sections')
      input.capacity = values.capacity ? Number(values.capacity) : '';
    else delete input.capacity;
    if (resource !== 'subjects') {
      delete input.department;
      delete input.classIds;
    } else if (record && values.classIds.length === 0) delete input.classIds;
    if (resource !== 'classes') {
      delete input.studyLevel;
      delete input.programName;
    }
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
          const visibleChoices =
            field.name === 'subjectId' && selectedClassId
              ? fieldChoices.filter(
                  (choice) =>
                    !choice.classIds?.length ||
                    choice.classIds.includes(selectedClassId),
                )
              : fieldChoices;
          if (field.type === 'multiselect') {
            const selectedClassIds = form.watch('classIds');
            return (
              <FormField
                error={error}
                key={field.name}
                label={field.label}
                name={field.name}
              >
                <div className="academics-class-choice-list">
                  {fieldChoices.map((choice) => (
                    <label
                      key={choice.value}
                      className="academics-class-choice"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(choice.value)}
                        onChange={(event) =>
                          form.setValue(
                            'classIds',
                            event.target.checked
                              ? [...selectedClassIds, choice.value]
                              : selectedClassIds.filter(
                                  (id) => id !== choice.value,
                                ),
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                  {!fieldChoices.length && (
                    <p className="form-help-text">
                      Pehle Classes mein college groups create karein.
                    </p>
                  )}
                </div>
                <p className="form-help-text">
                  Subject sirf selected classes/groups mein teacher assignment
                  aur exams ke liye available hoga. Purane global subjects
                  existing records ke liye compatible rahenge.
                </p>
              </FormField>
            );
          }
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
                  {visibleChoices.map((choice) => (
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
