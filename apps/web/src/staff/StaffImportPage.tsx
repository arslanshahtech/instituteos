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
import { getCampuses } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { parseStudentImportFile } from '../students/student-import-parser.js';
import type { ParsedStudentSheet } from '../students/student-import-parser.js';
import { createStaff } from './staff-api.js';
import type { StaffInput } from './staff-api.js';
import { recordTransferHistory } from '../reporting/reporting-api.js';
import { downloadImportCsv } from '../import-file-utils.js';
import '../styles/modules/staff-import.css';

const fields = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['employeeCode', 'Employee code'],
  ['staffType', 'Staff type (teacher / other_staff)'],
  ['department', 'Department'],
  ['designation', 'Designation'],
  ['qualification', 'Qualification'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['status', 'Status (active / on_leave / terminated / inactive)'],
  ['gender', 'Gender'],
  ['dateOfBirth', 'Date of birth (YYYY-MM-DD)'],
] as const;
type Field = (typeof fields)[number][0] | 'skip';

function downloadTemplate() {
  const headers = fields.map(([field]) => field);
  const sample = [
    'Ayesha',
    'Khan',
    'EMP-001',
    'teacher',
    'Science',
    'Teacher',
    'MSc',
    'ayesha@example.com',
    '+923001234567',
    'active',
    'female',
    '1995-05-12',
  ];
  downloadImportCsv(
    'instituteos-staff-import-template.csv',
    [headers, sample],
    false,
  );
}

function downloadImportIssues(fileName: string, issues: string[]) {
  downloadImportCsv(
    fileName.replace(/\.(xlsx|csv)$/i, '') + '-import-issues.csv',
    [['Issue'], ...issues.map((issue) => [issue])],
  );
}

export function StaffImportPage() {
  const { organizationId = '' } = useParams();
  const queryClient = useQueryClient();
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const campuses = useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(access.data?.permissions.includes('campus.read')),
    retry: false,
  });
  const [sheet, setSheet] = useState<ParsedStudentSheet | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Field[]>([]);
  const [campusId, setCampusId] = useState('');
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
    failed: number;
    skipped: number;
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
  const isCampusAdmin = context?.role === 'campus_admin';

  async function chooseFile(file?: File) {
    if (!file) return;
    setError('');
    setResult(null);
    setPreview(null);
    setBusy(true);
    try {
      const parsed = await parseStudentImportFile(file);
      setSheet(parsed);
      setFileName(file.name);
      const used = new Set<Field>();
      setMapping(
        parsed.headers.map((header) => {
          const normalized = header.toLowerCase().replace(/[\s_.-]/g, '');
          const found =
            fields.find(([key]) => key.toLowerCase() === normalized)?.[0] ??
            'skip';
          if (found === 'skip' || used.has(found)) return 'skip';
          used.add(found);
          return found;
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

  function buildPreview() {
    if (!sheet) return;
    if (isCampusAdmin && !campusId) {
      setError('Select an assigned campus before previewing staff.');
      return;
    }
    if (!mapping.includes('firstName') || !mapping.includes('lastName')) {
      setError('Map both First name and Last name columns.');
      return;
    }
    const employeeCodes = new Set<string>();
    const emails = new Set<string>();
    const rows = sheet.rows.map((row) => {
      const data: Record<string, string> = {};
      row.cells.forEach((value, index) => {
        const key = mapping[index];
        if (key && key !== 'skip' && value.trim()) data[key] = value.trim();
      });
      let status: 'ready' | 'skipped' | 'failed' = 'ready';
      let issue: string | undefined;
      const employeeCode = (data.employeeCode ?? '').trim().toLowerCase();
      const email = (data.email ?? '').trim().toLowerCase();
      const staffStatus = data.status || 'active';
      const staffType = data.staffType || 'other_staff';
      if (!data.firstName || !data.lastName) {
        status = 'failed';
        issue = 'First and last name are required.';
      } else if (
        (employeeCode && employeeCodes.has(employeeCode)) ||
        (email && emails.has(email))
      ) {
        status = 'skipped';
        issue = 'Duplicate employee code or email in this file.';
      } else if (
        !['active', 'on_leave', 'terminated', 'inactive'].includes(
          staffStatus,
        ) ||
        !['teacher', 'other_staff'].includes(staffType)
      ) {
        status = 'failed';
        issue = 'Status or staff type is invalid.';
      } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status = 'failed';
        issue = 'Email address is invalid.';
      } else if (
        data.dateOfBirth &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth) ||
          Number.isNaN(Date.parse(data.dateOfBirth)) ||
          new Date(data.dateOfBirth).toISOString().slice(0, 10) !==
            data.dateOfBirth)
      ) {
        status = 'failed';
        issue = 'Date of birth must be a valid YYYY-MM-DD date.';
      }
      if (status === 'ready') {
        if (employeeCode) employeeCodes.add(employeeCode);
        if (email) emails.add(email);
      }
      return {
        rowNumber: row.rowNumber,
        data,
        status,
        ...(issue ? { issue } : {}),
      };
    });
    setPreview({
      rows,
      ready: rows.filter((row) => row.status === 'ready').length,
      skipped: rows.filter((row) => row.status === 'skipped').length,
      failed: rows.filter((row) => row.status === 'failed').length,
    });
    setResult(null);
    setError('');
  }

  async function runImport() {
    if (!preview || preview.ready === 0) return;
    if (
      !window.confirm(
        `Import ${preview.ready} staff records? Existing duplicate employee codes or email addresses will be skipped. This action creates staff records and cannot be automatically undone.`,
      )
    )
      return;
    const outcomes = {
      created: 0,
      failed: preview.failed,
      skipped: preview.skipped,
      issues: preview.rows
        .filter((row) => row.issue)
        .map((row) => 'Row ' + row.rowNumber + ': ' + row.issue),
    };
    setBusy(true);
    setError('');
    try {
      for (const row of preview.rows.filter(
        (item) => item.status === 'ready',
      )) {
        const data = row.data;
        const input: StaffInput = {
          firstName: data.firstName!,
          lastName: data.lastName!,
          staffType: (data.staffType ||
            'other_staff') as StaffInput['staffType'],
          status: (data.status || 'active') as StaffInput['status'],
          ...(campusId ? { campusId } : {}),
          ...(data.employeeCode ? { employeeCode: data.employeeCode } : {}),
          ...(data.department ? { department: data.department } : {}),
          ...(data.designation ? { designation: data.designation } : {}),
          ...(data.qualification ? { qualification: data.qualification } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.phone ? { phone: data.phone } : {}),
          ...(data.gender ? { gender: data.gender } : {}),
          ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
        };
        try {
          await createStaff(organizationId, input);
          outcomes.created += 1;
        } catch (cause) {
          const code =
            cause && typeof cause === 'object' && 'code' in cause
              ? String(cause.code)
              : '';
          if (code === 'STAFF_DUPLICATE') {
            outcomes.skipped += 1;
            outcomes.issues.push(
              'Row ' +
                row.rowNumber +
                ': staff member already exists by employee code or email.',
            );
          } else {
            outcomes.failed += 1;
            outcomes.issues.push(
              'Row ' +
                row.rowNumber +
                ': ' +
                (cause instanceof Error
                  ? cause.message
                  : 'Staff record could not be created.'),
            );
          }
        }
      }
      setResult(outcomes);
      await queryClient.invalidateQueries({
        queryKey: ['staff', organizationId],
      });
      try {
        await recordTransferHistory(organizationId, {
          direction: 'import',
          dataType: 'staff',
          format: fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
          fileName,
          totalRows: preview.rows.length,
          createdRows: outcomes.created,
          skippedRows: outcomes.skipped,
          failedRows: outcomes.failed,
          ...(campusId ? { campusId } : {}),
        });
      } catch {
        outcomes.issues.push(
          'Staff import completed, but its history record could not be saved.',
        );
        setResult({ ...outcomes });
      }
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  if (access.isPending)
    return (
      <main className="page-stack">
        <p>Checking staff import access…</p>
      </main>
    );
  if (!context)
    return (
      <main className="page-stack">
        <h1>Staff import unavailable</h1>
        <p>{error || 'Organization access could not be verified.'}</p>
      </main>
    );
  if (!context.permissions.includes('staff.create'))
    return (
      <main className="page-stack">
        <h1>Permission required</h1>
        <p>Your role does not have staff creation permission.</p>
      </main>
    );

  return (
    <main className="page-stack student-import-page">
      <WorkspacePageHeading
        className="student-import-heading"
        eyebrow="People & staff"
        title="Import staff"
        description="Bring your staff register into InstituteOS using a guided spreadsheet mapping workflow."
        aside={
          <Link
            className="button button-secondary"
            to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
          >
            <ArrowLeft size={15} /> Back to staff
          </Link>
        }
      />
      <section className="panel page-stack student-import-panel">
        <div className="staff-import-topline">
          <div>
            <h2>
              <FileSpreadsheet size={18} /> Staff register
            </h2>
            <p>
              Upload an .xlsx or .csv file up to 5 MB. Up to 1,000 staff rows
              per batch.
            </p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={downloadTemplate}
          >
            <Download size={15} /> Download template
          </button>
        </div>
        <label className="form-field student-import-file-field">
          <span className="student-import-field-label">
            Choose staff spreadsheet
          </span>
          <span className="student-import-file-picker">
            <span className="student-import-file-icon">
              <UploadCloud size={22} />
            </span>
            <span className="student-import-file-copy">
              <strong>{fileName || 'Choose an Excel or CSV file'}</strong>
              <small>.xlsx or .csv · 5 MB maximum</small>
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
        {(context.permissions.includes('campus.read') || isCampusAdmin) && (
          <label className="form-field">
            <span>Campus {isCampusAdmin ? '(required)' : '(optional)'}</span>
            <select
              value={campusId}
              onChange={(event) => {
                setCampusId(event.target.value);
                setPreview(null);
                setResult(null);
              }}
              disabled={busy}
            >
              <option value="">
                {isCampusAdmin
                  ? 'Select assigned campus'
                  : 'No campus / organization-wide'}
              </option>
              {allowedCampuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {sheet && (
          <p className="student-import-selected-file" role="status">
            {sheet.rows.length} rows detected in {fileName}.
          </p>
        )}
      </section>
      {sheet && (
        <section className="panel page-stack">
          <div>
            <h2>Match spreadsheet columns</h2>
            <p>
              Map the fields you want to import. Unmapped columns will be
              ignored.
            </p>
          </div>
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
                        {fields.map(([value, label]) => (
                          <option
                            key={value}
                            value={value}
                            disabled={mapping.some(
                              (item, i) => i !== index && item === value,
                            )}
                          >
                            {label}
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
              {busy ? 'Please wait…' : 'Preview staff records'}
            </button>
          </div>
        </section>
      )}
      {preview && (
        <section className="panel page-stack" aria-live="polite">
          <h2>Review staff import</h2>
          <p>
            Only ready rows will be submitted. Existing employee code/email
            duplicates are checked again by the server during import.
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
                  <th>Staff member</th>
                  <th>Employee code</th>
                  <th>Status</th>
                  <th>Review note</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>
                      {[row.data.firstName, row.data.lastName]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </td>
                    <td>{row.data.employeeCode || '—'}</td>
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
                : `Confirm and import ${preview.ready} staff records`}
            </button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="form-error">
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
