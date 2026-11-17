import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  UploadCloud,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { parseStudentImportFile } from '../students/student-import-parser.js';
import type { ParsedStudentSheet } from '../students/student-import-parser.js';
import {
  listAcademicCampuses,
  listAcademicClasses,
  listAcademicSections,
  listAcademicSubjects,
  saveAcademicsResource,
} from './academics-api.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicSubject,
} from './academics-api.js';
import { recordTransferHistory } from '../reporting/reporting-api.js';
import { downloadImportCsv } from '../import-file-utils.js';
import '../styles/modules/staff-import.css';

type ImportType = 'classes' | 'sections' | 'subjects';
type Field =
  | 'name'
  | 'code'
  | 'sortOrder'
  | 'studyLevel'
  | 'programName'
  | 'classCode'
  | 'capacity'
  | 'totalMarks'
  | 'passingPercentage'
  | 'description'
  | 'classCodes'
  | 'skip';
const fieldOptions: Record<
  ImportType,
  Array<{ value: Field; label: string }>
> = {
  classes: [
    { value: 'name', label: 'Class name' },
    { value: 'code', label: 'Class code' },
    { value: 'sortOrder', label: 'Sort order' },
    { value: 'studyLevel', label: 'Study level' },
    { value: 'programName', label: 'Program name' },
  ],
  sections: [
    { value: 'classCode', label: 'Parent class code' },
    { value: 'name', label: 'Section name' },
    { value: 'capacity', label: 'Capacity' },
  ],
  subjects: [
    { value: 'name', label: 'Subject name' },
    { value: 'code', label: 'Subject code' },
    { value: 'totalMarks', label: 'Total marks' },
    { value: 'passingPercentage', label: 'Passing percentage' },
    { value: 'description', label: 'Description' },
    { value: 'classCodes', label: 'Class codes (comma separated)' },
  ],
};
const resourceLabels: Record<ImportType, string> = {
  classes: 'Classes',
  sections: 'Sections',
  subjects: 'Subjects',
};

function template(type: ImportType) {
  const headers = fieldOptions[type].map((field) => field.value);
  const examples: Record<ImportType, string[]> = {
    classes: ['Class 8', 'CLASS-08', '8', 'other', 'Middle School'],
    sections: ['CLASS-08', 'A', '35'],
    subjects: [
      'Mathematics',
      'MATH-08',
      '100',
      '40',
      'Core mathematics',
      'CLASS-08',
    ],
  };
  downloadImportCsv('instituteos-' + type + '-template.csv', [
    headers,
    examples[type],
  ]);
}

function downloadImportIssues(fileName: string, issues: string[]) {
  downloadImportCsv(
    fileName.replace(/\.(xlsx|csv)$/i, '') + '-import-issues.csv',
    [['Issue'], ...issues.map((issue) => [issue])],
  );
}

export function AcademicImportPage() {
  const { organizationId = '' } = useParams();
  const queryClient = useQueryClient();
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const campuses = useQuery({
    queryKey: ['reporting', organizationId, 'campuses'],
    queryFn: () => listAcademicCampuses(organizationId),
    enabled: Boolean(access.data?.permissions.includes('campus.read')),
    retry: false,
  });
  const classes = useQuery({
    queryKey: ['academics', organizationId, 'classes'],
    queryFn: () => listAcademicClasses(organizationId),
    enabled: Boolean(access.data?.permissions.includes('academics.read')),
    retry: false,
  });
  const sections = useQuery({
    queryKey: ['academics', organizationId, 'sections'],
    queryFn: () => listAcademicSections(organizationId),
    enabled: Boolean(access.data?.permissions.includes('academics.read')),
    retry: false,
  });
  const subjects = useQuery({
    queryKey: ['academics', organizationId, 'subjects'],
    queryFn: () => listAcademicSubjects(organizationId),
    enabled: Boolean(access.data?.permissions.includes('academics.read')),
    retry: false,
  });
  const [type, setType] = useState<ImportType>('classes');
  const [campusId, setCampusId] = useState('');
  const [sheet, setSheet] = useState<ParsedStudentSheet | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    rows: Array<{
      rowNumber: number;
      data: Record<string, string>;
      status: 'ready' | 'skipped' | 'failed';
      issue?: string;
    }>;
    ready: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    failed: number;
    issues: string[];
  } | null>(null);
  const context = access.data;
  const allowedCampuses = useMemo(
    () =>
      (campuses.data?.campuses ?? []).filter(
        (campus) =>
          context?.role !== 'campus_admin' ||
          context.campusIds.includes(campus.id),
      ),
    [campuses.data?.campuses, context],
  );
  const selectedCampusId =
    campusId ||
    (allowedCampuses.length === 1 ? (allowedCampuses[0]?.id ?? '') : '');
  function suggest(header: string): Field {
    const normalized = header.toLowerCase().replace(/[\s_.-]/g, '');
    return (
      fieldOptions[type].find(
        (field) => field.value.toLowerCase() === normalized,
      )?.value ?? 'skip'
    );
  }
  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPreview(null);
    try {
      const parsed = await parseStudentImportFile(file);
      setSheet(parsed);
      setFileName(file.name);
      const used = new Set<Field>();
      setMapping(
        parsed.headers.map((header) => {
          const field = suggest(header);
          if (field === 'skip' || used.has(field)) return 'skip';
          used.add(field);
          return field;
        }),
      );
    } catch (cause) {
      setSheet(null);
      setError(
        cause instanceof Error ? cause.message : 'Could not read this file.',
      );
    } finally {
      setBusy(false);
    }
  }
  function changeType(next: ImportType) {
    setType(next);
    setSheet(null);
    setFileName('');
    setMapping([]);
    setResult(null);
    setPreview(null);
    setError('');
  }
  function buildPreview() {
    if (!sheet) return;
    if ((type === 'classes' || type === 'sections') && !selectedCampusId) {
      setError('Select a campus before previewing classes or sections.');
      return;
    }
    if (classes.isPending || sections.isPending || subjects.isPending) {
      setError(
        'Academic records are still loading. Please try again in a moment.',
      );
      return;
    }
    const rows = sheet.rows.map((row) => {
      const data: Record<string, string> = {};
      row.cells.forEach((value, index) => {
        const field = mapping[index];
        if (field && field !== 'skip' && value.trim())
          data[field] = value.trim();
      });
      return { rowNumber: row.rowNumber, data };
    });
    const existingClasses = classes.data?.items ?? [];
    const existingSections = sections.data?.items ?? [];
    const existingSubjects = subjects.data?.items ?? [];
    const scopedClasses = selectedCampusId
      ? existingClasses.filter((item) => item.campusId === selectedCampusId)
      : existingClasses;
    const classCodes = new Set(
      scopedClasses.map((item) => item.code.toLowerCase()),
    );
    const subjectCodes = new Set(
      existingSubjects.map((item) => item.code.toLowerCase()),
    );
    const sectionKeys = new Set(
      existingSections.map(
        (item) => item.classId + ':' + item.name.toLowerCase(),
      ),
    );
    const seenCodes = new Set<string>();
    const previewRows = rows.map((row) => {
      const data = row.data;
      let status: 'ready' | 'skipped' | 'failed' = 'ready';
      let issue: string | undefined;
      if (type === 'classes') {
        const code = (data.code ?? '').trim().toLowerCase();
        if (!data.name || !code) {
          status = 'failed';
          issue = 'Class name and code are required.';
        } else if (classCodes.has(code) || seenCodes.has(code)) {
          status = 'skipped';
          issue = 'Class code already exists in this campus or import file.';
        } else if (
          data.sortOrder &&
          (!Number.isInteger(Number(data.sortOrder)) ||
            Number(data.sortOrder) < 0)
        ) {
          status = 'failed';
          issue = 'Sort order must be a non-negative whole number.';
        } else if (
          data.studyLevel &&
          !['first_year', 'second_year', 'other'].includes(data.studyLevel)
        ) {
          status = 'failed';
          issue = 'Study level must be first_year, second_year or other.';
        }
        if (status === 'ready') seenCodes.add(code);
      } else if (type === 'sections') {
        const code = (data.classCode ?? '').trim().toLowerCase();
        const parent = scopedClasses.find(
          (item) => item.code.toLowerCase() === code,
        );
        if (!parent || !data.name) {
          status = 'failed';
          issue =
            'A valid class code from the selected campus and section name are required.';
        } else if (
          data.capacity &&
          (!Number.isInteger(Number(data.capacity)) ||
            Number(data.capacity) < 1)
        ) {
          status = 'failed';
          issue = 'Section capacity must be a positive whole number.';
        } else {
          const key = parent.id + ':' + data.name.toLowerCase();
          if (sectionKeys.has(key)) {
            status = 'skipped';
            issue = 'Section already exists in this class or import file.';
          } else {
            sectionKeys.add(key);
          }
        }
      } else {
        const code = (data.code ?? '').trim().toLowerCase();
        const classCodeList = (data.classCodes ?? '')
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
        if (!data.name || !code) {
          status = 'failed';
          issue = 'Subject name and code are required.';
        } else if (subjectCodes.has(code) || seenCodes.has(code)) {
          status = 'skipped';
          issue = 'Subject code already exists or is repeated in this file.';
        } else {
          const unresolved = classCodeList.filter(
            (classCode) =>
              !existingClasses.some(
                (item) => item.code.toLowerCase() === classCode,
              ),
          );
          const ambiguous = classCodeList.filter(
            (classCode) =>
              existingClasses.filter(
                (item) => item.code.toLowerCase() === classCode,
              ).length > 1,
          );
          const totalMarks = data.totalMarks ? Number(data.totalMarks) : 100;
          const passingPercentage = data.passingPercentage
            ? Number(data.passingPercentage)
            : 40;
          if (unresolved.length) {
            status = 'failed';
            issue = 'Unknown class code(s): ' + unresolved.join(', ');
          } else if (ambiguous.length) {
            status = 'failed';
            issue =
              'Class code exists in multiple campuses; use a unique class code: ' +
              ambiguous.join(', ');
          } else if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
            status = 'failed';
            issue = 'Total marks must be greater than zero.';
          } else if (
            !Number.isFinite(passingPercentage) ||
            passingPercentage < 0 ||
            passingPercentage > 100
          ) {
            status = 'failed';
            issue = 'Passing percentage must be between 0 and 100.';
          } else {
            seenCodes.add(code);
          }
        }
      }
      return { ...row, status, ...(issue ? { issue } : {}) };
    });
    setPreview({
      rows: previewRows,
      ready: previewRows.filter((row) => row.status === 'ready').length,
      skipped: previewRows.filter((row) => row.status === 'skipped').length,
      failed: previewRows.filter((row) => row.status === 'failed').length,
    });
    setResult(null);
    setError('');
  }

  async function runImport() {
    if (!sheet || !preview || preview.ready === 0) return;
    if ((type === 'classes' || type === 'sections') && !selectedCampusId) {
      setError('Select a campus before importing classes or sections.');
      return;
    }
    if (
      !window.confirm(
        `Import ${preview.ready} ${resourceLabels[type].toLowerCase()} records? Existing records and duplicates identified in preview will not be overwritten.`,
      )
    )
      return;
    const rows = preview.rows.filter((row) => row.status === 'ready');
    const existingClasses = classes.data?.items ?? [];
    const existingSections = sections.data?.items ?? [];
    const existingSubjects = subjects.data?.items ?? [];
    const scopedClasses = selectedCampusId
      ? existingClasses.filter(
          (item: AcademicClass) => item.campusId === selectedCampusId,
        )
      : existingClasses;
    const knownClassCodes = new Map(
      scopedClasses.map((item: AcademicClass) => [
        item.code.toLowerCase(),
        item,
      ]),
    );
    const createdClassCodes = new Map<string, AcademicClass>();
    const seenClassCodes = new Set<string>();
    const seenSubjectCodes = new Set<string>();
    const seenSectionKeys = new Set<string>();
    const summary = {
      created: 0,
      skipped: preview.skipped,
      failed: preview.failed,
      issues: preview.rows
        .filter((row) => row.issue)
        .map((row) => 'Row ' + row.rowNumber + ': ' + row.issue),
    };
    setBusy(true);
    setError('');
    try {
      for (const row of rows) {
        const data = row.data;
        try {
          if (type === 'classes') {
            const code = (data.code ?? '').toUpperCase();
            if (!data.name || !code)
              throw new Error('Class name and code are required.');
            const sortOrder = data.sortOrder ? Number(data.sortOrder) : 0;
            if (!Number.isInteger(sortOrder) || sortOrder < 0)
              throw new Error(
                'Sort order must be a non-negative whole number.',
              );
            if (
              data.studyLevel &&
              !['first_year', 'second_year', 'other'].includes(data.studyLevel)
            )
              throw new Error(
                'Study level must be first_year, second_year or other.',
              );
            if (
              knownClassCodes.has(code.toLowerCase()) ||
              seenClassCodes.has(code.toLowerCase())
            ) {
              summary.skipped++;
              summary.issues.push(
                'Row ' +
                  row.rowNumber +
                  ': class code already exists in this campus or import file.',
              );
              continue;
            }
            seenClassCodes.add(code.toLowerCase());
            const response = (await saveAcademicsResource(
              organizationId,
              'classes',
              undefined,
              {
                name: data.name,
                code,
                campusId: selectedCampusId,
                sortOrder,
                ...(data.studyLevel ? { studyLevel: data.studyLevel } : {}),
                ...(data.programName ? { programName: data.programName } : {}),
              },
            )) as { item?: AcademicClass; class?: AcademicClass };
            const created = response.item ?? response.class;
            if (created) createdClassCodes.set(code.toLowerCase(), created);
          } else if (type === 'sections') {
            const code = (data.classCode ?? '').toLowerCase();
            const parent =
              knownClassCodes.get(code) ?? createdClassCodes.get(code);
            if (!parent || !data.name)
              throw new Error(
                'A valid existing class code and section name are required.',
              );
            const capacity = data.capacity ? Number(data.capacity) : undefined;
            if (
              capacity !== undefined &&
              (!Number.isInteger(capacity) || capacity < 1)
            )
              throw new Error(
                'Section capacity must be a positive whole number.',
              );
            const sectionKey = parent.id + ':' + data.name.toLowerCase();
            const duplicate = existingSections.some(
              (item: AcademicSection) =>
                item.classId === parent.id &&
                item.name.toLowerCase() === data.name.toLowerCase(),
            );
            if (duplicate || seenSectionKeys.has(sectionKey)) {
              summary.skipped++;
              summary.issues.push(
                'Row ' +
                  row.rowNumber +
                  ': section already exists in this class or import file.',
              );
              continue;
            }
            seenSectionKeys.add(sectionKey);
            await saveAcademicsResource(organizationId, 'sections', undefined, {
              classId: parent.id,
              name: data.name,
              ...(capacity ? { capacity } : {}),
            });
          } else {
            const code = (data.code ?? '').toUpperCase();
            if (!data.name || !code)
              throw new Error('Subject name and code are required.');
            if (
              existingSubjects.some(
                (item: AcademicSubject) =>
                  item.code.toLowerCase() === code.toLowerCase(),
              ) ||
              seenSubjectCodes.has(code.toLowerCase())
            ) {
              summary.skipped++;
              summary.issues.push(
                'Row ' +
                  row.rowNumber +
                  ': subject code already exists or is repeated in this file.',
              );
              continue;
            }
            seenSubjectCodes.add(code.toLowerCase());
            const classCodes = (data.classCodes ?? '')
              .split(',')
              .map((value) => value.trim().toLowerCase())
              .filter(Boolean);
            const unresolvedCodes = classCodes.filter(
              (classCode) =>
                !existingClasses.some(
                  (item: AcademicClass) =>
                    item.code.toLowerCase() === classCode,
                ),
            );
            if (unresolvedCodes.length)
              throw new Error(
                'Unknown class code(s): ' + unresolvedCodes.join(', '),
              );
            const classIds = classCodes.flatMap((classCode) =>
              existingClasses
                .filter(
                  (item: AcademicClass) =>
                    item.code.toLowerCase() === classCode,
                )
                .map((item: AcademicClass) => item.id),
            );
            const totalMarks = data.totalMarks ? Number(data.totalMarks) : 100;
            const passingPercentage = data.passingPercentage
              ? Number(data.passingPercentage)
              : 40;
            if (!Number.isFinite(totalMarks) || totalMarks <= 0)
              throw new Error('Total marks must be greater than zero.');
            if (
              !Number.isFinite(passingPercentage) ||
              passingPercentage < 0 ||
              passingPercentage > 100
            )
              throw new Error('Passing percentage must be between 0 and 100.');
            await saveAcademicsResource(organizationId, 'subjects', undefined, {
              name: data.name,
              code,
              totalMarks,
              passingPercentage,
              ...(data.description ? { description: data.description } : {}),
              ...(classIds.length ? { classIds } : {}),
            });
          }
          summary.created++;
        } catch (cause) {
          summary.failed++;
          summary.issues.push(
            'Row ' +
              row.rowNumber +
              ': ' +
              (cause instanceof Error
                ? cause.message
                : 'Record could not be imported.'),
          );
        }
      }
      setResult(summary);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['academics', organizationId, 'classes'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['academics', organizationId, 'sections'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['academics', organizationId, 'subjects'],
        }),
      ]);
      try {
        await recordTransferHistory(organizationId, {
          direction: 'import',
          dataType: type,
          format: fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
          fileName,
          totalRows: preview.rows.length,
          createdRows: summary.created,
          skippedRows: summary.skipped,
          failedRows: summary.failed,
          ...(selectedCampusId ? { campusId: selectedCampusId } : {}),
        });
      } catch {
        summary.issues.push(
          'Academic import completed, but its history record could not be saved.',
        );
        setResult({ ...summary });
      }
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  if (access.isPending)
    return (
      <main className="page-stack">
        <p>Checking academic import access…</p>
      </main>
    );
  if (!context)
    return (
      <main className="page-stack">
        <h1>Academic import unavailable</h1>
        <p>Organization access could not be verified.</p>
      </main>
    );
  if (
    !context.permissions.includes('academics.write') ||
    !context.permissions.includes('academics.read') ||
    !context.permissions.includes('campus.read')
  )
    return (
      <main className="page-stack">
        <h1>Permission required</h1>
        <p>
          Academic import requires academic read/write and campus read
          permissions so existing records and campus assignments can be checked.
        </p>
      </main>
    );

  return (
    <main className="page-stack student-import-page">
      <WorkspacePageHeading
        className="student-import-heading"
        eyebrow="Academic setup"
        title="Import academic records"
        description="Import classes, sections and subjects using InstituteOS templates. Existing records are skipped; imports never overwrite setup data."
        aside={
          <Link
            className="button button-secondary"
            to={`/admin/organizations/${encodeURIComponent(organizationId)}/reports`}
          >
            <ArrowLeft size={15} /> Back to Import & Export
          </Link>
        }
      />
      <section className="panel page-stack student-import-panel">
        <div className="staff-import-topline">
          <div>
            <h2>
              <FileSpreadsheet size={18} /> Academic register
            </h2>
            <p>
              Choose the data type, download its template and upload up to 1,000
              rows in .xlsx or .csv format.
            </p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => template(type)}
          >
            <Download size={15} /> Download {type} template
          </button>
        </div>
        <label className="form-field">
          <span>Import data type</span>
          <select
            value={type}
            disabled={busy}
            onChange={(event) => changeType(event.target.value as ImportType)}
          >
            {(['classes', 'sections', 'subjects'] as const).map((value) => (
              <option key={value} value={value}>
                {resourceLabels[value]}
              </option>
            ))}
          </select>
        </label>
        {(type === 'classes' || type === 'sections') && (
          <label className="form-field">
            <span>Campus (required)</span>
            <select
              value={selectedCampusId}
              onChange={(event) => {
                setCampusId(event.target.value);
                setPreview(null);
                setResult(null);
              }}
              disabled={busy}
            >
              <option value="">Select campus</option>
              {allowedCampuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-field student-import-file-field">
          <span className="student-import-field-label">Choose spreadsheet</span>
          <span className="student-import-file-picker">
            <span className="student-import-file-icon">
              <UploadCloud size={22} />
            </span>
            <span className="student-import-file-copy">
              <strong>{fileName || 'Choose an Excel or CSV file'}</strong>
              <small>.xlsx or .csv · up to 5 MB</small>
            </span>
            <span className="button button-secondary student-import-choose-button">
              Browse files
            </span>
            <input
              className="student-import-file-input"
              type="file"
              accept=".xlsx,.csv"
              disabled={busy}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </span>
        </label>
      </section>
      {sheet && (
        <section className="panel page-stack">
          <h2>Match spreadsheet columns</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File column</th>
                  <th>Import as</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {sheet.headers.map((header, index) => (
                  <tr key={header + index}>
                    <td>{header}</td>
                    <td>
                      <select
                        aria-label={'Map ' + header}
                        value={mapping[index] ?? 'skip'}
                        disabled={busy}
                        onChange={(event) => {
                          setMapping((current) =>
                            current.map((value, i) =>
                              i === index
                                ? (event.target.value as Field)
                                : value,
                            ),
                          );
                          setPreview(null);
                          setResult(null);
                        }}
                      >
                        <option value="skip">Skip column</option>
                        {fieldOptions[type].map((field) => (
                          <option
                            key={field.value}
                            value={field.value}
                            disabled={mapping.some(
                              (value, i) =>
                                i !== index && value === field.value,
                            )}
                          >
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{sheet.rows[0]?.cells[index] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={buildPreview}
            >
              {busy
                ? 'Please wait…'
                : 'Preview ' + resourceLabels[type].toLowerCase()}
            </button>
          </div>
        </section>
      )}
      {preview && (
        <section className="panel page-stack" aria-live="polite">
          <h2>Review {resourceLabels[type].toLowerCase()} import</h2>
          <p>
            Only ready rows will be submitted. Existing setup records are never
            overwritten. Duplicate checks run again during import.
          </p>
          <div className="reporting-kpi-grid">
            <article className="reporting-kpi">
              <span>Total rows</span>
              <strong>{preview.rows.length}</strong>
            </article>
            <article className="reporting-kpi">
              <span>Ready</span>
              <strong>{preview.ready}</strong>
            </article>
            <article className="reporting-kpi">
              <span>Skipped</span>
              <strong>{preview.skipped}</strong>
            </article>
            <article className="reporting-kpi">
              <span>Errors</span>
              <strong>{preview.failed}</strong>
            </article>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Record</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Review note</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.data.name || '—'}</td>
                    <td>
                      {type === 'sections'
                        ? row.data.classCode || '—'
                        : row.data.code || '—'}
                    </td>
                    <td>
                      <span className={`status-badge status-${row.status}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.issue || 'Ready to import'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Back to mapping
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={busy || preview.ready === 0}
              onClick={() => void runImport()}
            >
              {busy
                ? 'Importing…'
                : `Confirm and import ${preview.ready} ${resourceLabels[type].toLowerCase()}`}
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <section className="panel page-stack" aria-live="polite">
          <h2>Import results</h2>
          <div className="reporting-kpi-grid">
            <article className="reporting-kpi">
              <span>Created</span>
              <strong>{result.created}</strong>
            </article>
            <article className="reporting-kpi">
              <span>Skipped</span>
              <strong>{result.skipped}</strong>
            </article>
            <article className="reporting-kpi">
              <span>Failed</span>
              <strong>{result.failed}</strong>
            </article>
          </div>
          {result.issues.length > 0 && (
            <>
              <div className="button-row">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => downloadImportIssues(fileName, result.issues)}
                >
                  Download issue report
                </button>
              </div>
              <ul>
                {result.issues.map((issue, index) => (
                  <li key={issue + index}>{issue}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
