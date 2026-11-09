import { useEffect, useState } from 'react';
import {
  Archive,
  CalendarDays,
  Download,
  Eye,
  Pencil,
  Printer,
  Users,
  CheckCircle2,
  Clock3,
  UserX,
  ArrowUpRight,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Pagination } from '../components/ui/Pagination.js';
import { WorkspaceModuleSection } from '../components/ui/WorkspacePrimitives.js';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import {
  StaffAccess,
  StaffHeading,
  StaffStatusBadge,
  apiMessage,
  useOrganizationAccess,
} from './StaffPageShared.js';
import { listStaff } from './staff-api.js';
import type { StaffRecord, StaffStatus, StaffType } from './staff-api.js';
import { useSetStaffStatus, useStaffList } from './staff-queries.js';

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;

function csvValue(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[=+@-]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

async function getAllFilteredStaff(
  organizationId: string,
  filters: {
    search: string;
    department: string;
    staffType?: StaffType;
    status?: StaffStatus;
  },
): Promise<StaffRecord[]> {
  const firstPage = await listStaff(organizationId, {
    ...filters,
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
  });
  const records = [...firstPage.items];
  const pageCount = Math.ceil(firstPage.total / EXPORT_PAGE_SIZE);
  for (let page = 2; page <= pageCount; page += 1) {
    const nextPage = await listStaff(organizationId, {
      ...filters,
      page,
      pageSize: EXPORT_PAGE_SIZE,
    });
    records.push(...nextPage.items);
  }
  return records;
}

function downloadStaffCsv(records: StaffRecord[]) {
  const headers = [
    'Employee ID',
    'Employee name',
    'Designation',
    'Staff Type',
    'Department',
    'Status',
  ];
  const rows = records.map((person) => [
    person.employeeCode,
    `${person.firstName} ${person.lastName}`.trim(),
    person.designation,
    person.staffType === 'teacher' ? 'Teacher' : 'Other Staff',
    person.department,
    person.status.replace('_', ' '),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvValue).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `instituteos-staff-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printStaffReport(records: StaffRecord[], reportWindow: Window) {
  reportWindow.opener = null;
  const bodyRows = records
    .map(
      (person) => `
    <tr>
      <td>${escapeHtml(person.employeeCode || '—')}</td>
      <td>${escapeHtml(`${person.firstName} ${person.lastName}`.trim())}</td>
      <td>${escapeHtml(person.designation || '—')}</td>
      <td>${escapeHtml(person.department || '—')}</td>
      <td>${escapeHtml(person.status.replace('_', ' '))}</td>
    </tr>`,
    )
    .join('');
  reportWindow.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>InstituteOS Staff Directory</title>
    <style>
      body{font-family:Arial,sans-serif;color:#18243a;padding:28px}
      header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px}
      h1{font-size:22px;margin:0 0 5px}p{color:#65748b;font-size:12px;margin:0}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th,td{padding:9px 7px;border-bottom:1px solid #e4e9f0;text-align:left}
      th{background:#f3f6fa;color:#52627a;text-transform:uppercase;font-size:9px}
      @media print{body{padding:0}tr{break-inside:avoid}}
    </style></head><body><header><div><h1>Staff Directory</h1><p>InstituteOS · Generated ${escapeHtml(new Date().toLocaleString())}</p></div><p>${records.length} staff records</p></header>
    <table><thead><tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Status</th></tr></thead><tbody>${bodyRows}</tbody></table>
    <script>window.addEventListener('load',()=>window.print());</script></body></html>`);
  reportWindow.document.close();
  reportWindow.opener = null;
}

export function StaffListPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [staffType, setStaffType] = useState<StaffType | ''>('');
  const [status, setStatus] = useState<StaffStatus | ''>('');
  const [page, setPage] = useState(1);
  const [exportBusy, setExportBusy] = useState(false);
  const [overviewCounts, setOverviewCounts] = useState({ total: 0, active: 0, onLeave: 0, inactive: 0 });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const statusMutation = useSetStaffStatus(organizationId);
  const { showToast } = useToast();

  useEffect(() => {
    if (!access.data?.permissions.includes('staff.read')) return;
    let cancelled = false;
    setOverviewLoading(true);
    Promise.all([
      listStaff(organizationId, { page: 1, pageSize: 1 }),
      listStaff(organizationId, { status: 'active', page: 1, pageSize: 1 }),
      listStaff(organizationId, { status: 'on_leave', page: 1, pageSize: 1 }),
      listStaff(organizationId, { status: 'inactive', page: 1, pageSize: 1 }),
    ]).then(([all, active, onLeave, inactive]) => {
      if (!cancelled) setOverviewCounts({ total: all.total, active: active.total, onLeave: onLeave.total, inactive: inactive.total });
    }).catch(() => {
      if (!cancelled) setOverviewCounts({ total: 0, active: 0, onLeave: 0, inactive: 0 });
    }).finally(() => { if (!cancelled) setOverviewLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId, access.data?.permissions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const staff = useStaffList(
    organizationId,
    {
      search,
      department: department.trim(),
      staffType: staffType || undefined,
      status: status || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    Boolean(access.data?.permissions.includes('staff.read')),
  );

  const canCreate = access.data?.permissions.includes('staff.create') ?? false;
  const canUpdate = access.data?.permissions.includes('staff.update') ?? false;
  const hasFilters = Boolean(searchInput || department || staffType || status);

  const exportDirectory = async (format: 'csv' | 'pdf') => {
    const reportWindow =
      format === 'pdf' ? window.open('about:blank', '_blank') : null;
    if (format === 'pdf' && !reportWindow) {
      showToast('Please allow pop-ups to create the PDF report.');
      return;
    }
    setExportBusy(true);
    try {
      const records = await getAllFilteredStaff(organizationId, {
        search,
        department: department.trim(),
        staffType: staffType || undefined,
        status: status || undefined,
      });
      if (format === 'csv') downloadStaffCsv(records);
      else if (reportWindow) printStaffReport(records, reportWindow);
      showToast(
        `${records.length} staff records prepared for ${format.toUpperCase()} export.`,
      );
    } catch (error) {
      reportWindow?.close();
      showToast(
        error instanceof Error
          ? error.message
          : 'Staff export could not be completed.',
      );
    } finally {
      setExportBusy(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setDepartment('');
    setStaffType('');
    setStatus('');
    setPage(1);
  };

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.read"
    >
      {(organizationAccess) => (
        <main className="page-stack student-management-page staff-management-page staff-directory-page">
          <StaffHeading
            action={
              canCreate ? (
                <Link
                  className="button button-primary"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/new`}
                >
                  Add staff member
                </Link>
              ) : undefined
            }
            description="Manage your school's teachers and employees from one directory."
            eyebrow="People · Staff management"
            organizationId={organizationId}
            showDirectoryLink={false}
            title="All staff members"
          />

          <section className="staff-directory-overview" aria-label="Staff overview">
            {[
              { key: 'all', label: 'Total staff', value: overviewCounts.total, note: 'All employees in your school', icon: Users, tone: 'blue', filter: '' },
              { key: 'active', label: 'Active staff', value: overviewCounts.active, note: 'Currently working', icon: CheckCircle2, tone: 'green', filter: 'active' },
              { key: 'leave', label: 'On leave', value: overviewCounts.onLeave, note: 'Temporarily away', icon: Clock3, tone: 'violet', filter: 'on_leave' },
              { key: 'inactive', label: 'Inactive staff', value: overviewCounts.inactive, note: 'Not currently active', icon: UserX, tone: 'amber', filter: 'inactive' },
            ].map((card) => {
              const Icon = card.icon;
              const selected = status === card.filter && (card.filter !== '' || !status);
              return (
                <button key={card.key} type="button" className={`staff-overview-card staff-overview-${card.tone}${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => { setStatus(card.filter as StaffStatus | ''); setPage(1); }}>
                  <span className="staff-overview-card-top"><span>{card.label}</span><span className="staff-overview-icon"><Icon size={18} aria-hidden="true" /></span></span>
                  <strong>{overviewLoading ? '?' : card.value.toLocaleString()}</strong>
                  <span className="staff-overview-card-bottom"><span>{card.note}</span><ArrowUpRight size={16} aria-hidden="true" /></span>
                </button>
              );
            })}
          </section>

          <section className="staff-directory-filter-box" aria-label="Staff search and filters">
            <div className="staff-directory-filters">
              <label className="staff-directory-search">
                <span>Search staff</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Name, employee ID or designation"
                  type="search"
                  value={searchInput}
                />
              </label>
              <label>
                <span>Staff Type</span>
                <select
                  onChange={(event) => {
                    setStaffType(event.target.value as StaffType | '');
                    setPage(1);
                  }}
                  value={staffType}
                >
                  <option value="">All staff types</option>
                  <option value="teacher">Teacher</option>
                  <option value="other_staff">Other Staff</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  onChange={(event) => {
                    setStatus(event.target.value as StaffStatus | '');
                    setPage(1);
                  }}
                  value={status}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="on_leave">On leave</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </label>
              {hasFilters && (
                <button className="staff-directory-clear" onClick={clearFilters} type="button">
                  Clear filters
                </button>
              )}
            </div>
          </section>

          <WorkspaceModuleSection className="panel staff-directory-panel">
            <div className="staff-directory-toolbar">
              <div className="staff-directory-heading">
                <div className="staff-directory-title-group">
                  <h2>All Staff</h2>
                  {!staff.isPending && !staff.isError && (
                    <span className="staff-directory-count">
                      {staff.data.total.toLocaleString()}
                    </span>
                  )}
                </div>
                {!staff.isPending && !staff.isError && (
                  <div className="staff-directory-tools">
                    <button
                      className="staff-directory-export"
                      disabled={exportBusy || staff.data.total === 0}
                      onClick={() => void exportDirectory('csv')}
                      type="button"
                    >
                      <Download aria-hidden="true" size={15} />
                      Export CSV
                    </button>
                    <button
                      className="staff-directory-export staff-directory-export-primary"
                      disabled={exportBusy || staff.data.total === 0}
                      onClick={() => void exportDirectory('pdf')}
                      type="button"
                    >
                      <Printer aria-hidden="true" size={15} />
                      Save PDF
                    </button>
                  </div>
                )}
              </div>



              {statusMutation.isError && (
                <p className="form-error" role="alert">
                  Staff status could not be updated:{' '}
                  {apiMessage(statusMutation.error)}
                </p>
              )}
            </div>

            {staff.isPending ? (
              <LoadingState message="Loading staff members..." />
            ) : staff.isError ? (
              <ErrorState
                title="Staff directory unavailable"
                description={apiMessage(staff.error)}
                onRetry={() => void staff.refetch()}
              />
            ) : staff.data.items.length === 0 ? (
              <section className="staff-directory-empty">
                <span className="staff-directory-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-5a4 4 0 0 1 0 7.75M22 20v-1.5a4.5 4.5 0 0 0-3-4.25"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <h2>
                  {hasFilters
                    ? 'No matching staff members'
                    : 'No staff members yet'}
                </h2>
                <p>
                  {hasFilters
                    ? 'Try another search or clear the filters to see all staff.'
                    : 'Add your first teacher or employee to start building the staff directory.'}
                </p>
                <div className="staff-directory-empty-actions">
                  {hasFilters && (
                    <button
                      className="button button-secondary"
                      onClick={clearFilters}
                      type="button"
                    >
                      Clear filters
                    </button>
                  )}
                  {!hasFilters && canCreate && (
                    <Link
                      className="button button-primary"
                      to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/new`}
                    >
                      Add first staff member
                    </Link>
                  )}
                </div>
              </section>
            ) : (
              <>
                <div
                  className="staff-directory-table-wrap"
                  role="region"
                  aria-label="Staff members table"
                  tabIndex={0}
                >
                  <table className="staff-directory-table">
                    <thead>
                      <tr>
                        <th scope="col">Employee</th>
                        <th scope="col">Employee ID</th>
                        <th scope="col">Designation</th>
                        <th scope="col">Staff Type</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.data.items.map((person) => {
                        const name =
                          `${person.firstName} ${person.lastName}`.trim();
                        const profilePath = `/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(person.id)}`;
                        const initials =
                          `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase() ||
                          'S';
                        return (
                          <tr key={person.id}>
                            <td data-label="Employee">
                              <div className="staff-directory-person">
                                <span
                                  className="staff-directory-avatar"
                                  aria-hidden="true"
                                >
                                  {initials}
                                </span>
                                <span className="staff-directory-person-copy">
                                  <Link
                                    className="staff-directory-person-name"
                                    to={profilePath}
                                  >
                                    {name}
                                  </Link>
                                </span>
                              </div>
                            </td>
                            <td data-label="Employee ID">
                              <span className="staff-directory-code">
                                {person.employeeCode || '—'}
                              </span>
                            </td>
                            <td data-label="Designation">
                              {person.designation || '—'}
                            </td>
                            <td data-label="Staff Type">
                              {person.staffType === 'teacher' ? 'Teacher' : 'Other Staff'}
                            </td>
                            <td data-label="Status">
                              <StaffStatusBadge status={person.status} />
                            </td>
                            <td data-label="Actions">
                              <div
                                className="staff-directory-actions"
                                aria-label={'Actions for ' + name}
                              >
                                <Link
                                  className="staff-directory-icon-action"
                                  aria-label={'View profile for ' + name}
                                  title="View profile"
                                  to={profilePath}
                                >
                                  <Eye aria-hidden="true" size={16} />
                                </Link>
                                <Link
                                  className="staff-directory-icon-action"
                                  aria-label={'View timetable for ' + name}
                                  title="View timetable"
                                  to={profilePath + '/timetable'}
                                >
                                  <CalendarDays aria-hidden="true" size={16} />
                                </Link>
                                {canUpdate && (
                                  <Link
                                    className="staff-directory-icon-action"
                                    aria-label={'Edit ' + name}
                                    title="Edit staff"
                                    to={profilePath + '/edit'}
                                  >
                                    <Pencil aria-hidden="true" size={16} />
                                  </Link>
                                )}
                                {canUpdate &&
                                  (person.status === 'active' ||
                                    person.status === 'on_leave') && (
                                    <button
                                      className="staff-directory-icon-action staff-directory-archive-action"
                                      aria-label={'Archive ' + name}
                                      title="Archive staff (keeps attendance and history)"
                                      disabled={statusMutation.isPending}
                                      onClick={() => {
                                        const confirmed = window.confirm(
                                          'Archive ' +
                                            name +
                                            '? The employee record, attendance and history will be retained.',
                                        );
                                        if (!confirmed) return;
                                        statusMutation.mutate(
                                          {
                                            staffId: person.id,
                                            status: 'inactive',
                                          },
                                          {
                                            onSuccess: () =>
                                              showToast(
                                                name +
                                                  ' has been archived. The staff record is retained.',
                                              ),
                                          },
                                        );
                                      }}
                                      type="button"
                                    >
                                      <Archive aria-hidden="true" size={16} />
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="staff-directory-pagination">
                  <Pagination
                    currentPage={staff.data.page}
                    onPageChange={setPage}
                    pageSize={staff.data.pageSize}
                    totalItems={staff.data.total}
                  />
                </div>
              </>
            )}

            {organizationAccess.role === 'campus_admin' &&
              !organizationAccess.campusIds.length && (
                <p className="muted-copy">
                  No campus access is assigned to this account.
                </p>
              )}
          </WorkspaceModuleSection>
        </main>
      )}
    </StaffAccess>
  );
}
