import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { FormField } from '../components/ui/FormField.js';
import type {
  AcademicsFormPayload,
  AcademicsResource,
  SubjectMarkComponent,
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
  subjectId: string;
  sectionId: string;
  studyLevel: '' | 'first_year' | 'second_year' | 'other';
  programName: string;
  classIds: string[];
  totalMarks: string;
  passingPercentage: string;
  theoryEnabled: boolean;
  theoryTotalMarks: string;
  theoryPassingMarks: string;
  practicalEnabled: boolean;
  practicalTotalMarks: string;
  practicalPassingMarks: string;
  vivaEnabled: boolean;
  vivaTotalMarks: string;
  vivaPassingMarks: string;
  description: string;
}

interface Choice {
  value: string;
  label: string;
  classIds?: string[];
}

interface Field {
  name: keyof FormValues;
  label: string;
  type?:
    'date' | 'number' | 'select' | 'multiselect' | 'textarea' | 'components';
  choices?: Choice[];
}

function schemaForResource(resource: AcademicsResource) {
  return z
    .object({
      name: z.string().trim().max(120, 'Max 120 characters.'),
      code: z.string().trim().max(30, 'Max 30 characters.'),
      sortOrder: z
        .string()
        .refine(
          (value) =>
            value === '' || (/^\d+$/.test(value) && Number(value) <= 100000),
          'Enter 0 to 100,000.',
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
          'Enter 1 to 10,000.',
        ),
      department: z.string().trim().max(100, 'Max 100 characters.'),
      subjectId: z.string(),
      sectionId: z.string(),
      studyLevel: z.enum(['', 'first_year', 'second_year', 'other']),
      programName: z.string().trim().max(120, 'Max 120 characters.'),
      classIds: z.array(z.string()),
      totalMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100000,
          'Enter 1 to 100,000.',
        ),
      passingPercentage: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100,
          'Enter 0 to 100.',
        ),
      theoryEnabled: z.boolean(),
      theoryTotalMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
          'Enter valid marks.',
        ),
      theoryPassingMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
          'Enter valid marks.',
        ),
      practicalEnabled: z.boolean(),
      practicalTotalMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
          'Enter valid marks.',
        ),
      practicalPassingMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
          'Enter valid marks.',
        ),
      vivaEnabled: z.boolean(),
      vivaTotalMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
          'Enter valid marks.',
        ),
      vivaPassingMarks: z
        .string()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
          'Enter valid marks.',
        ),
      description: z.string().trim().max(1000, 'Maximum 1,000 characters.'),
    })
    .superRefine((values, context) => {
      const requiredByResource: Record<
        AcademicsResource,
        (keyof FormValues)[]
      > = {
        'academic-years': ['name'],
        terms: ['name', 'academicYearId', 'startDate', 'endDate'],
        classes: ['name', 'code', 'campusId'],
        sections: ['name', 'classId'],
        subjects: ['name', 'totalMarks', 'passingPercentage'],
      };
      if (resource === 'subjects') {
        const components = [
          {
            key: 'theory',
            enabled: values.theoryEnabled,
            total: values.theoryTotalMarks,
            passing: values.theoryPassingMarks,
          },
          {
            key: 'practical',
            enabled: values.practicalEnabled,
            total: values.practicalTotalMarks,
            passing: values.practicalPassingMarks,
          },
          {
            key: 'viva',
            enabled: values.vivaEnabled,
            total: values.vivaTotalMarks,
            passing: values.vivaPassingMarks,
          },
        ];
        const enabled = components.filter((component) => component.enabled);
        if (enabled.length === 0)
          context.addIssue({
            code: 'custom',
            path: ['theoryEnabled'],
            message: 'Enable at least one component.',
          });
        for (const component of components) {
          if (
            (component.enabled && Number(component.total) < 1) ||
            Number(component.passing) > Number(component.total)
          )
            context.addIssue({
              code: 'custom',
              path: [`${component.key}PassingMarks`],
              message: 'Passing marks cannot exceed total marks.',
            });
        }
      }
      if (resource === 'subjects' && values.classIds.length === 0)
        context.addIssue({
          code: 'custom',
          path: ['classIds'],
          message: 'Choose a class.',
        });
      if (
        resource === 'classes' &&
        values.studyLevel &&
        !values.programName.trim()
      )
        context.addIssue({
          code: 'custom',
          path: ['programName'],
          message: 'Enter a program name.',
        });
      for (const key of requiredByResource[resource] ?? []) {
        if (typeof values[key] !== 'string' || !values[key].trim())
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required.',
          });
      }
      if (resource === 'terms') {
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
            message: 'End date must be later.',
          });
        }
      }
    });
}

const fieldsByResource: Record<AcademicsResource, Field[]> = {
  'academic-years': [
    { name: 'name', label: 'Session Name *' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  terms: [
    { name: 'name', label: 'Term / semester name' },
    { name: 'academicYearId', label: 'Academic year', type: 'select' },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'endDate', label: 'End date', type: 'date' },
  ],
  classes: [
    { name: 'name', label: 'Class Name' },
    { name: 'code', label: 'Class code' },
    { name: 'sortOrder', label: 'Display order', type: 'number' },
    {
      name: 'studyLevel',
      label: 'Level',
      type: 'select',
      choices: [
        { value: 'first_year', label: 'First Year' },
        { value: 'second_year', label: 'Second Year' },
        { value: 'other', label: 'Other' },
      ],
    },
    { name: 'programName', label: 'Program' },
    { name: 'campusId', label: 'Campus', type: 'select' },
  ],
  sections: [
    { name: 'name', label: 'Section name' },
    { name: 'classId', label: 'Class', type: 'select' },
    { name: 'capacity', label: 'Capacity', type: 'number' },
  ],
  subjects: [
    { name: 'name', label: 'Subject Name' },
    { name: 'classIds', label: 'Select Classes', type: 'multiselect' },
    { name: 'theoryEnabled', label: 'Mark components', type: 'components' },
    { name: 'description', label: 'Description', type: 'textarea' },
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
  subjectId: '',
  sectionId: '',
  studyLevel: '',
  programName: '',
  classIds: [],
  totalMarks: '100',
  passingPercentage: '40',
  theoryEnabled: true,
  theoryTotalMarks: '100',
  theoryPassingMarks: '40',
  practicalEnabled: false,
  practicalTotalMarks: '0',
  practicalPassingMarks: '0',
  vivaEnabled: false,
  vivaTotalMarks: '0',
  vivaPassingMarks: '0',
  description: '',
};

export function AcademicsForm({
  resource,
  record,
  choices,
  isSaving,
  saveError,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  resource: AcademicsResource;
  record?: Record<string, unknown>;
  choices: Partial<Record<keyof FormValues, Choice[]>>;
  isSaving: boolean;
  saveError?: string;
  onSubmit: (input: AcademicsFormPayload) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const initialValues = useMemo(() => {
    const existingComponents = Array.isArray(record?.markComponents)
      ? (record.markComponents as Array<{
          key: string;
          enabled: boolean;
          totalMarks: number;
          passingMarks: number;
        }>)
      : [];
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
      classId: String(
        record?.classId ??
          (Array.isArray(record?.classIds) ? (record.classIds[0] ?? '') : ''),
      ),
      capacity: value('capacity'),
      department: value('department'),
      subjectId: value('subjectId'),
      sectionId: value('sectionId'),
      studyLevel: value('studyLevel') as FormValues['studyLevel'],
      programName: value('programName'),
      classIds: Array.isArray(record?.classIds)
        ? record.classIds.map(String)
        : [],
      totalMarks: String(record?.totalMarks ?? 100),
      passingPercentage: String(record?.passingPercentage ?? 40),
      theoryEnabled: existingComponents.length
        ? Boolean(
            existingComponents.find((item) => item.key === 'theory')?.enabled,
          )
        : true,
      theoryTotalMarks: String(
        existingComponents.find((item) => item.key === 'theory')?.totalMarks ??
          record?.totalMarks ??
          100,
      ),
      theoryPassingMarks: String(
        existingComponents.find((item) => item.key === 'theory')
          ?.passingMarks ??
          Math.round(
            (Number(record?.totalMarks ?? 100) *
              Number(record?.passingPercentage ?? 40)) /
              100,
          ),
      ),
      practicalEnabled: Boolean(
        existingComponents.find((item) => item.key === 'practical')?.enabled ??
        false,
      ),
      practicalTotalMarks: String(
        existingComponents.find((item) => item.key === 'practical')
          ?.totalMarks ?? 0,
      ),
      practicalPassingMarks: String(
        existingComponents.find((item) => item.key === 'practical')
          ?.passingMarks ?? 0,
      ),
      vivaEnabled: Boolean(
        existingComponents.find((item) => item.key === 'viva')?.enabled ??
        false,
      ),
      vivaTotalMarks: String(
        existingComponents.find((item) => item.key === 'viva')?.totalMarks ?? 0,
      ),
      vivaPassingMarks: String(
        existingComponents.find((item) => item.key === 'viva')?.passingMarks ??
          0,
      ),
      description: String(record?.description ?? ''),
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
  const selectedClassId = form.watch('classId');
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, resource, reset]);

  const submit = form.handleSubmit((values) => {
    const input: AcademicsFormPayload = { ...values };
    if (resource === 'subjects') {
      const markComponents: SubjectMarkComponent[] = [
        {
          key: 'theory',
          label: 'Theory',
          enabled: values.theoryEnabled,
          totalMarks: Number(values.theoryTotalMarks),
          passingMarks: Number(values.theoryPassingMarks),
        },
        {
          key: 'practical',
          label: 'Practical',
          enabled: values.practicalEnabled,
          totalMarks: Number(values.practicalTotalMarks),
          passingMarks: Number(values.practicalPassingMarks),
        },
        {
          key: 'viva',
          label: 'Viva',
          enabled: values.vivaEnabled,
          totalMarks: Number(values.vivaTotalMarks),
          passingMarks: Number(values.vivaPassingMarks),
        },
      ];
      const enabledComponents = markComponents.filter(
        (component) => component.enabled,
      );
      const totalMarks = enabledComponents.reduce(
        (sum, component) => sum + component.totalMarks,
        0,
      );
      const passingMarks = enabledComponents.reduce(
        (sum, component) => sum + component.passingMarks,
        0,
      );
      input.totalMarks = totalMarks;
      input.passingPercentage =
        totalMarks > 0 ? Math.round((passingMarks / totalMarks) * 100) : 0;
      input.markComponents = markComponents;
      delete input.code;
      delete input.department;
    }
    if (resource === 'classes')
      input.sortOrder = values.sortOrder === '' ? 0 : Number(values.sortOrder);
    else delete input.sortOrder;
    if (resource === 'sections')
      input.capacity = values.capacity ? Number(values.capacity) : '';
    else delete input.capacity;
    if (resource !== 'subjects') {
      delete input.department;
      delete input.classIds;
    }
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
    if (resource === 'academic-years')
      input.status = record ? values.status : 'archived';
    onSubmit(input);
  });

  return (
    <form className="student-form academics-form" noValidate onSubmit={submit}>
      <div className="student-form-grid">
        {fieldsByResource[resource].map((field) => {
          const error = form.formState.errors[field.name]?.message;
          const fieldChoices =
            choices[field.name] ??
            (field.name === 'classIds' ? choices.classId : undefined) ??
            field.choices ??
            [];
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
                    <p className="form-help-text">Create a class first.</p>
                  )}
                </div>
                <p className="form-help-text">Used for exam scheduling.</p>
              </FormField>
            );
          }
          if (field.type === 'components') {
            const components = [
              {
                key: 'theory',
                label: 'Theory',
                enabled: 'theoryEnabled' as const,
                total: 'theoryTotalMarks' as const,
                passing: 'theoryPassingMarks' as const,
              },
              {
                key: 'practical',
                label: 'Practical',
                enabled: 'practicalEnabled' as const,
                total: 'practicalTotalMarks' as const,
                passing: 'practicalPassingMarks' as const,
              },
              {
                key: 'viva',
                label: 'Viva',
                enabled: 'vivaEnabled' as const,
                total: 'vivaTotalMarks' as const,
                passing: 'vivaPassingMarks' as const,
              },
            ];
            const enabledTotal = components.reduce(
              (sum, component) =>
                sum +
                (form.watch(component.enabled)
                  ? Number(form.watch(component.total) || 0)
                  : 0),
              0,
            );
            return (
              <FormField
                error={error}
                key={field.name}
                label="Subject mark components"
                name={field.name}
              >
                <div
                  className="academics-subject-components"
                  style={{ display: 'grid', gap: 12 }}
                >
                  {components.map((component) => {
                    const enabled = form.watch(component.enabled);
                    return (
                      <div
                        className="academics-subject-component"
                        key={component.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr',
                          gap: 12,
                          alignItems: 'end',
                          padding: 12,
                          border: '1px solid var(--border-subtle, #d1d5db)',
                          borderRadius: 8,
                        }}
                      >
                        <label className="academics-class-choice">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) =>
                              form.setValue(
                                component.enabled,
                                event.target.checked,
                                { shouldDirty: true, shouldValidate: true },
                              )
                            }
                          />
                          <span>{component.label}</span>
                        </label>
                        <label>
                          Total marks
                          <input
                            type="number"
                            min="0"
                            max="100000"
                            readOnly={!enabled}
                            {...form.register(component.total)}
                          />
                        </label>
                        <label>
                          Passing marks
                          <input
                            type="number"
                            min="0"
                            max="100000"
                            readOnly={!enabled}
                            {...form.register(component.passing)}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
                <p className="form-help-text">
                  Enabled components total: {enabledTotal} marks. Disabled
                  components are not included.
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
                <select
                  id={field.name}
                  disabled={
                    resource === 'subjects' &&
                    field.name === 'classId' &&
                    Boolean(record)
                  }
                  {...form.register(field.name)}
                >
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {visibleChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                {field.name === 'campusId' && fieldChoices.length === 0 && (
                  <p className="form-help-text">
                    Add a campus in Settings first.
                  </p>
                )}
                {field.name === 'campusId' && fieldChoices.length === 1 && (
                  <p className="form-help-text">
                    Campus selected automatically.
                  </p>
                )}
              </FormField>
            );
          }
          if (field.type === 'textarea') {
            return (
              <FormField
                error={error}
                key={field.name}
                label={field.label}
                name={field.name}
              >
                <textarea
                  id={field.name}
                  rows={4}
                  maxLength={1000}
                  placeholder={
                    resource === 'academic-years'
                      ? 'Optional description of the session'
                      : undefined
                  }
                  {...form.register(field.name)}
                />
              </FormField>
            );
          }
          return (
            <FormField
              error={error}
              key={field.name}
              label={field.label}
              maxLength={field.name === 'name' ? 120 : 100}
              placeholder={
                resource === 'academic-years' && field.name === 'name'
                  ? 'e.g., 2026-2027, Fall 2026'
                  : undefined
              }
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
      <div
        className={
          resource === 'subjects'
            ? 'academic-subject-form-actions'
            : 'button-row'
        }
      >
        {(resource === 'subjects' || resource === 'academic-years') &&
          onCancel && (
            <Button
              disabled={isSaving}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              {resource === 'subjects' ? 'Back to Subjects' : 'Cancel'}
            </Button>
          )}
        <Button disabled={isSaving} type="submit" variant="primary">
          {isSaving
            ? 'Saving…'
            : resource === 'subjects'
              ? record
                ? 'Update Subject'
                : 'Add Subject'
              : (submitLabel ?? (record ? 'Save changes' : 'Create record'))}
        </Button>
      </div>
    </form>
  );
}
