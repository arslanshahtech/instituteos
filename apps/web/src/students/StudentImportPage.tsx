import { useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  UploadCloud,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { getCampuses } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { Campus } from '../organizations/organizations-api.js';
import type { OrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { importStudents, previewStudentImport } from './students-api.js';
import { recordTransferHistory } from '../reporting/reporting-api.js';
import { downloadImportCsv } from '../import-file-utils.js';
import type {
  StudentImportData,
  StudentImportPreviewResponse,
  StudentImportResult,
  StudentImportRowInput,
} from './students-api.js';
import {
  parseStudentImportFile,
  STUDENT_IMPORT_FIELDS,
  suggestStudentImportMappings,
} from './student-import-parser.js';
import type {
  ParsedStudentSheet,
  StudentImportField,
} from './student-import-parser.js';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The request could not be completed. Try again.';
}

const statusLabels: Record<string, string> = {
  ready: 'Ready',
  warning: 'Review',
  duplicate: 'Duplicate',
  error: 'Error',
};

function downloadStudentTemplate() {
  const headers = [
    'firstName',
    'lastName',
    'dateOfBirth',
    'gender',
    'contactEmail',
    'phone',
    'status',
    'guardianName',
    'guardianPhone',
    'guardianEmail',
    'guardianRelationship',
  ];
  const example = [
    'Ayesha',
    'Khan',
    '2014-05-12',
    'female',
    'ayesha.khan@example.com',
    '+923001234567',
    'active',
    'Ahmed Khan',
    '+923009876543',
    'ahmed.khan@example.com',
    'father',
  ];
  downloadImportCsv(
    'instituteos-student-import-template.csv',
    [headers, example],
    false,
  );
}

function downloadStudentImportIssues(
  fileName: string,
  rows: StudentImportResult['rows'],
) {
  const issues = rows.filter((row) => row.outcome !== 'created');
  downloadImportCsv(
    fileName.replace(/\.(xlsx|csv)$/i, '') + '-import-issues.csv',
    [
      ['Source row', 'Outcome', 'Details'],
      ...issues.map((row) => [String(row.rowNumber), row.outcome, row.message]),
    ],
  );
}

export function StudentImportPage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 30_000,
  });
  const campusQuery = useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(access.data?.permissions.includes('campus.read')),
    retry: false,
  });
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState<ParsedStudentSheet | null>(null);
  const [mappings, setMappings] = useState<StudentImportField[]>([]);
  const [campusId, setCampusId] = useState('');
  const [preview, setPreview] = useState<StudentImportPreviewResponse | null>(
    null,
  );
  const [result, setResult] = useState<StudentImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const context = access.data as OrganizationAccessContext | undefined;
  const canCreate = context?.permissions.includes('student.create') ?? false;
  const isCampusAdmin = context?.role === 'campus_admin';
  const allowedCampuses: Campus[] = (campusQuery.data?.campuses ?? []).filter(
    (campus) => !isCampusAdmin || context?.campusIds.includes(campus.id),
  );
  const selectedCampusId =
    campusId ||
    (allowedCampuses.length === 1 ? (allowedCampuses[0]?.id ?? '') : '');

  const mappedRows = (): StudentImportRowInput[] => {
    if (!sheet) return [];
    return sheet.rows.map((row) => {
      const data: StudentImportData = {};
      row.cells.forEach((cell, index) => {
        const field = mappings[index];
        if (field && field !== 'skip' && cell !== '') {
          Reflect.set(
            data,
            field,
            field === 'status' ? cell.toLowerCase() : cell,
          );
        }
      });
      return { rowNumber: row.rowNumber, data };
    });
  };

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    setPreview(null);
    setResult(null);
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseStudentImportFile(file);
      setSheet(parsed);
      setFileName(file.name);
      setMappings(suggestStudentImportMappings(parsed.headers));
    } catch (parseError) {
      setSheet(null);
      setFileName('');
      setMappings([]);
      setError(errorMessage(parseError));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function handlePreview() {
    setError('');
    setResult(null);
    if (!sheet) {
      setError('Pehle Excel ya CSV file select karein.');
      return;
    }
    const hasFullName = mappings.includes('fullName');
    if (
      !hasFullName &&
      (!mappings.includes('firstName') || !mappings.includes('lastName'))
    ) {
      setError(
        'First name aur Last name map karein, ya Full student name select karein.',
      );
      return;
    }
    if (isCampusAdmin && !selectedCampusId) {
      setError('Import se pehle apna assigned campus select karein.');
      return;
    }
    setBusy(true);
    try {
      const response = await previewStudentImport(organizationId, {
        rows: mappedRows(),
        ...(selectedCampusId ? { campusId: selectedCampusId } : {}),
      });
      setPreview(response);
    } catch (previewError) {
      setError(errorMessage(previewError));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!sheet || !preview || preview.summary.importable === 0) return;
    const message = `Import ${preview.summary.importable} student profiles? Parent/guardian details mapped in the same rows will be created and linked to each new student. Duplicate students will be skipped; existing records will not be overwritten.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    try {
      const response = await importStudents(organizationId, {
        rows: mappedRows(),
        ...(selectedCampusId ? { campusId: selectedCampusId } : {}),
      });
      setResult(response);
      setPreview(null);
      await queryClient.invalidateQueries({
        queryKey: ['students', organizationId],
      });
      try {
        await recordTransferHistory(organizationId, {
          direction: 'import',
          dataType: 'students',
          format: fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
          fileName,
          totalRows: response.summary.total,
          createdRows: response.summary.created,
          skippedRows: response.summary.skipped,
          failedRows: response.summary.failed,
          ...(selectedCampusId ? { campusId: selectedCampusId } : {}),
        });
      } catch {
        setError(
          'Students were imported, but the transfer history record could not be saved.',
        );
      }
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setBusy(false);
    }
  }

  if (access.isPending)
    return (
      <main className="page-stack">
        <p>Student import access check ho raha hai…</p>
      </main>
    );
  if (access.isError || !context)
    return (
      <main className="page-stack">
        <h1>Student import unavailable</h1>
        <p>{errorMessage(access.error)}</p>
        <button
          className="button button-secondary"
          onClick={() => void access.refetch()}
        >
          Retry
        </button>
      </main>
    );
  if (!canCreate)
    return (
      <main className="page-stack">
        <h1>Permission required</h1>
        <p>Aapke account ko student create/import permission nahi di gayi.</p>
        <Link
          className="button button-secondary"
          to={`/admin/organizations/${encodeURIComponent(organizationId)}/students`}
        >
          Back to students
        </Link>
      </main>
    );

  return (
    <main className="page-stack student-import-page">
      <header className="student-import-page-header">
        <Link
          className="student-import-back"
          to={`/admin/organizations/${encodeURIComponent(organizationId)}/students`}
          aria-label="Back to students"
          title="Back to students"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="student-import-heading-copy">
          <h1>Import students</h1>
          <p>Upload a spreadsheet to add student records.</p>
        </div>
      </header>

      <section
        className="panel page-stack student-import-panel"
        aria-labelledby="import-file-heading"
      >
        <div className="student-import-file-heading">
          <div>
            <h2 id="import-file-heading">
              <FileSpreadsheet size={18} aria-hidden="true" /> Select
              spreadsheet
            </h2>
            <p>Excel or CSV · Up to 1,000 student rows · 5 MB max</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={downloadStudentTemplate}
          >
            <Download size={15} aria-hidden="true" /> Download template
          </button>
        </div>
        <label className="form-field student-import-file-field">
          <span className="student-import-field-label">Student file</span>
          <span className="student-import-file-picker">
            <span className="student-import-file-icon" aria-hidden="true">
              <UploadCloud size={22} />
            </span>
            <span className="student-import-file-copy">
              <strong>Choose a file</strong>
              <small>Excel or CSV spreadsheet</small>
            </span>
            <span className="button button-secondary student-import-choose-button">
              Choose file
            </span>
            <input
              className="student-import-file-input"
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              disabled={busy}
              aria-label="Student register file"
            />
          </span>
        </label>
        {fileName && (
          <p className="student-import-selected-file" role="status">
            Selected: <strong>{fileName}</strong> · Sheet: {sheet?.sheetName} ·{' '}
            {sheet?.rows.length} student rows
          </p>
        )}
        {campusQuery.isError && (
          <p role="alert">
            Campus list load nahi hui: {errorMessage(campusQuery.error)}
          </p>
        )}
        {allowedCampuses.length === 1 && (
          <p className="student-import-campus-summary">
            Campus <strong>{allowedCampuses[0].name}</strong>
          </p>
        )}
        {(allowedCampuses.length > 1 ||
          (isCampusAdmin && allowedCampuses.length !== 1)) && (
          <label className="form-field student-import-campus-field">
            <span>Campus {isCampusAdmin ? '(required)' : '(optional)'}</span>
            <select
              value={selectedCampusId}
              onChange={(event) => {
                setCampusId(event.target.value);
                setPreview(null);
                setResult(null);
              }}
              disabled={busy || campusQuery.isPending}
              required={isCampusAdmin}
            >
              <option value="">
                {isCampusAdmin ? 'Select campus' : 'All campuses'}
              </option>
              {allowedCampuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {sheet && (
        <section className="panel page-stack" aria-labelledby="mapping-heading">
          <div>
            <h2 id="mapping-heading">2. Match spreadsheet columns</h2>
            <p>
              Har spreadsheet column ka maqsad select karein. Unknown columns ko
              Skip kar sakte hain.
            </p>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File column</th>
                  <th>Import as</th>
                  <th>Example value</th>
                </tr>
              </thead>
              <tbody>
                {sheet.headers.map((header, index) => {
                  const current = mappings[index] ?? 'skip';
                  const usedElsewhere = new Set(
                    mappings.filter(
                      (mapping, mappingIndex) =>
                        mappingIndex !== index && mapping !== 'skip',
                    ),
                  );
                  return (
                    <tr key={`${header}-${index}`}>
                      <td data-label="File column">{header}</td>
                      <td data-label="Import as">
                        <select
                          aria-label={`Map ${header}`}
                          value={current}
                          disabled={busy}
                          onChange={(event) => {
                            const next = event.target
                              .value as StudentImportField;
                            setMappings((previous) =>
                              previous.map((value, mappingIndex) =>
                                mappingIndex === index ? next : value,
                              ),
                            );
                            setPreview(null);
                            setResult(null);
                          }}
                        >
                          <option value="skip">Skip this column</option>
                          {STUDENT_IMPORT_FIELDS.map((field) => (
                            <option
                              key={field.value}
                              value={field.value}
                              disabled={usedElsewhere.has(field.value)}
                            >
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Example value">
                        {sheet.rows[0]?.cells[index] || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted-text student-import-scope-note">
            Dates ambiguous hon to system guess nahi karega. Import se pehle
            warnings aur errors check karein. Parent/guardian details same row
            mein map ki ja sakti hain aur sibling students ke saath shared
            guardian link ho sakta hai. Class placement, fees aur admission/roll
            numbers is import mein shamil nahi hain.
          </p>
          <div className="button-row">
            <button
              className="button button-primary"
              onClick={() => void handlePreview()}
              disabled={busy}
            >
              {busy ? 'Please wait…' : 'Preview rows'}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="panel" role="alert">
          <strong>Import issue</strong>
          <p>{error}</p>
        </div>
      )}

      {preview && (
        <section className="panel page-stack" aria-labelledby="preview-heading">
          <div>
            <h2 id="preview-heading">3. Review before import</h2>
            <p>
              Duplicate records ko automatically skip kiya jayega; existing
              students overwrite nahi honge.
            </p>
          </div>
          <div className="summary-grid">
            <div>
              <span>Total rows</span>
              <strong>{preview.summary.total}</strong>
            </div>
            <div>
              <span>Ready</span>
              <strong>{preview.summary.ready}</strong>
            </div>
            <div>
              <span>Warnings</span>
              <strong>{preview.summary.warnings}</strong>
            </div>
            <div>
              <span>Duplicates</span>
              <strong>{preview.summary.duplicates}</strong>
            </div>
            <div>
              <span>Errors</span>
              <strong>{preview.summary.errors}</strong>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Student</th>
                  <th>Family contact</th>
                  <th>Status</th>
                  <th>Review notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td data-label="Row">{row.rowNumber}</td>
                    <td data-label="Student">
                      {row.firstName || row.input?.firstName || '—'}{' '}
                      {row.lastName || row.input?.lastName || ''}
                    </td>
                    <td data-label="Family contact">
                      {row.guardian
                        ? `${row.guardian.firstName} ${row.guardian.lastName}`
                        : 'Not provided'}
                    </td>
                    <td data-label="Status">
                      <span className={`status-badge status-${row.status}`}>
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td data-label="Review notes">
                      {row.duplicateOf ? `Matches: ${row.duplicateOf}. ` : ''}
                      {row.issues.join(' ') || 'No issues reported.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            <button
              className="button button-secondary"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              Back to mapping
            </button>
            <button
              className="button button-primary"
              onClick={() => void handleImport()}
              disabled={busy || preview.summary.importable === 0}
            >
              {busy
                ? 'Importing…'
                : `Confirm and import ${preview.summary.importable} profiles`}
            </button>
          </div>
        </section>
      )}

      {result && (
        <section
          className="panel page-stack"
          aria-labelledby="result-heading"
          role="status"
        >
          <h2 id="result-heading">4. Import report</h2>
          <div className="summary-grid">
            <div>
              <span>Created</span>
              <strong>{result.summary.created}</strong>
            </div>
            <div>
              <span>Skipped</span>
              <strong>{result.summary.skipped}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{result.summary.failed}</strong>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>Outcome</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td data-label="Source row">{row.rowNumber}</td>
                    <td data-label="Outcome">{row.outcome}</td>
                    <td data-label="Details">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            {(result.summary.skipped > 0 || result.summary.failed > 0) && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  downloadStudentImportIssues(fileName, result.rows)
                }
              >
                <Download size={15} aria-hidden="true" /> Download issue report
              </button>
            )}
            <button
              className="button button-primary"
              onClick={() =>
                navigate(
                  `/admin/organizations/${encodeURIComponent(organizationId)}/students`,
                )
              }
            >
              Open student directory
            </button>
            <button
              className="button button-secondary"
              onClick={() => {
                setSheet(null);
                setFileName('');
                setMappings([]);
                setPreview(null);
                setResult(null);
              }}
            >
              Import another file
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
