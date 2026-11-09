import { useMemo, useState } from 'react';
import type { StaffRecord } from '../staff/staff-api.js';
import type {
  StaffAttendanceRecord,
  StaffAttendanceStatus,
} from './attendance-api.js';

type StaffFilter =
  'all' | 'present' | 'absent' | 'on-leave' | 'half-day' | 'not-marked';

interface AttendanceStaffWorkspaceProps {
  date: string;
  onDateChange: (date: string) => void;
  staff: StaffRecord[];
  records: StaffAttendanceRecord[];
  canWrite: boolean;
  isSaving: boolean;
  saveError?: string;
  onSave: (
    staffId: string,
    status: StaffAttendanceStatus,
    remarks?: string,
  ) => Promise<void>;
}

const statusLabels: Record<StaffAttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  'half-day': 'Half day',
  'on-leave': 'Leave',
};

function initials(person: StaffRecord) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

function formatTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function AttendanceStaffWorkspace({
  date,
  onDateChange,
  staff,
  records,
  canWrite,
  isSaving,
  saveError,
  onSave,
}: AttendanceStaffWorkspaceProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StaffFilter>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [manualStaffId, setManualStaffId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStatus, setManualStatus] =
    useState<StaffAttendanceStatus>('present');
  const [remarks, setRemarks] = useState('');

  const recordsByStaffId = useMemo(
    () => new Map(records.map((record) => [record.staffId, record])),
    [records],
  );
  const counts = useMemo(() => {
    const statuses = staff.map(
      (person) => recordsByStaffId.get(person.id)?.status ?? '',
    );
    return {
      checkedIn: statuses.filter((status) => status === 'present').length,
      present: statuses.filter((status) => status === 'present').length,
      absent: statuses.filter((status) => status === 'absent').length,
      leave: statuses.filter((status) => status === 'on-leave').length,
    };
  }, [recordsByStaffId, staff]);

  const visibleStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return staff.filter((person) => {
      const record = recordsByStaffId.get(person.id);
      const status = record?.status ?? '';
      const searchable = [
        person.firstName,
        person.lastName,
        person.employeeCode,
        person.designation,
        person.department,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch =
        !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'not-marked' && !record) ||
        status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, recordsByStaffId, search, staff]);

  const pageCount = Math.max(1, Math.ceil(visibleStaff.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart =
    visibleStaff.length === 0 ? 0 : (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, visibleStaff.length);
  const paginatedStaff = visibleStaff.slice(pageStart, pageEnd);

  const manualStaff = staff.find((person) => person.id === manualStaffId);

  async function submitManualMark() {
    if (!manualStaffId) return;
    try {
      await onSave(manualStaffId, manualStatus, remarks.trim() || undefined);
      setManualStaffId('');
      setManualOpen(false);
      setRemarks('');
    } catch {
      // The parent displays the mutation error and keeps this dialog open.
    }
  }

  return (
    <section
      className="attendance-staff-workspace"
      aria-label="Staff attendance"
    >
      <header className="attendance-staff-heading">
        <div>
          <h2>Staff Attendance</h2>
          <p>Team attendance status for the selected day.</p>
        </div>
        <button
          className="attendance-staff-manual attendance-staff-manual-top"
          disabled={!canWrite || isSaving || staff.length === 0}
          onClick={() => {
            setManualStaffId('');
            setManualStatus('present');
            setRemarks('');
            setManualOpen(true);
          }}
          type="button"
        >
          + Manual Mark
        </button>
      </header>

      <div
        className="attendance-staff-metrics"
        aria-label="Staff attendance summary"
      >
        <article className="attendance-staff-metric attendance-staff-metric-checked">
          <span className="attendance-staff-metric-label">Checked In</span>
          <strong>{counts.checkedIn}</strong>
          <span className="attendance-staff-metric-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m5 12 4.2 4.2L19 6.5" />
            </svg>
          </span>
        </article>
        <article className="attendance-staff-metric attendance-staff-metric-present">
          <span className="attendance-staff-metric-label">Present</span>
          <strong>{counts.present}</strong>
          <span className="attendance-staff-metric-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="7.5" />
              <path d="M8.5 12h7" />
            </svg>
          </span>
        </article>
        <article className="attendance-staff-metric attendance-staff-metric-absent">
          <span className="attendance-staff-metric-label">Absent</span>
          <strong>{counts.absent}</strong>
          <span className="attendance-staff-metric-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          </span>
        </article>
        <article className="attendance-staff-metric attendance-staff-metric-leave">
          <span className="attendance-staff-metric-label">On Leave</span>
          <strong>{counts.leave}</strong>
          <span className="attendance-staff-metric-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
        </article>
      </div>

      <div className="attendance-staff-toolbar attendance-staff-filter-panel">
        <label className="attendance-staff-date">
          <span className="attendance-staff-date-icon" aria-hidden="true">
            ▦
          </span>
          <input
            aria-label="Attendance date"
            onChange={(event) => onDateChange(event.target.value)}
            type="date"
            value={date}
          />
        </label>
        <label className="attendance-staff-search">
          <input
            aria-label="Search staff"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search staff by name, ID or role"
            type="search"
            value={search}
          />
          <svg
            className="attendance-staff-search-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m16 16 4.2 4.2" />
          </svg>
        </label>
        <label className="attendance-staff-filter">
          <select
            aria-label="Staff attendance status"
            onChange={(event) => {
              setFilter(event.target.value as StaffFilter);
              setPage(1);
            }}
            value={filter}
          >
            <option value="all">All Staff</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="on-leave">Leave</option>
            <option value="half-day">Half day</option>
            <option value="not-marked">Not checked in</option>
          </select>
        </label>
      </div>

      <div className="attendance-staff-table-card">
        <div className="attendance-staff-table-scroll">
          <table className="attendance-staff-table">
            <thead>
              <tr>
                <th scope="col">Staff</th>
                <th scope="col">Role</th>
                <th scope="col">Check-in</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStaff.map((person) => {
                const record = recordsByStaffId.get(person.id);
                const status = record?.status;
                return (
                  <tr key={person.id}>
                    <td>
                      <div className="attendance-staff-person-cell">
                        <span className="attendance-staff-avatar">
                          {initials(person)}
                        </span>
                        <span className="attendance-staff-person-copy">
                          <strong>
                            {person.firstName} {person.lastName}
                          </strong>
                          <small>
                            {person.employeeCode || 'Employee ID not set'}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong className="attendance-staff-role">
                        {person.designation ||
                          (person.staffType === 'teacher'
                            ? 'Teacher'
                            : 'Staff')}
                      </strong>
                      <small className="attendance-staff-department">
                        {person.department || 'General'}
                      </small>
                    </td>
                    <td className="attendance-staff-time">
                      {status === 'present'
                        ? formatTime(record?.updatedAt)
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`attendance-staff-status attendance-staff-status-${status || 'not-marked'}`}
                      >
                        {status ? statusLabels[status] : 'Not checked in'}
                      </span>
                    </td>
                    <td>
                      <div className="attendance-staff-row-actions">
                        <button
                          className="attendance-staff-checkin"
                          disabled={
                            !canWrite || isSaving || status === 'present'
                          }
                          onClick={() => {
                            void onSave(person.id, 'present').catch(
                              () => undefined,
                            );
                          }}
                          type="button"
                        >
                          {status === 'present' ? 'Checked in' : 'Check-in'}
                        </button>
                        <button
                          className="attendance-staff-manual"
                          disabled={!canWrite || isSaving}
                          onClick={() => {
                            setManualStaffId(person.id);
                            setManualStatus(status || 'present');
                            setRemarks(record?.remarks || '');
                            setManualOpen(true);
                          }}
                          type="button"
                        >
                          Manual Mark
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleStaff.length === 0 && (
                <tr>
                  <td className="attendance-staff-empty" colSpan={5}>
                    No staff match this search or attendance filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer
        className="attendance-staff-pagination"
        aria-label="Staff list pagination"
      >
        <span className="attendance-staff-pagination-summary">
          Showing {pageStart + (visibleStaff.length > 0 ? 1 : 0)}–{pageEnd} of{' '}
          {visibleStaff.length}
        </span>
        <div className="attendance-staff-pagination-controls">
          <span className="attendance-staff-pagination-page">
            Page {currentPage} of {pageCount}
          </span>
          <button
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            aria-label="Next page"
            disabled={currentPage >= pageCount}
            onClick={() =>
              setPage((current) => Math.min(pageCount, current + 1))
            }
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </footer>

      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}

      {manualOpen && (
        <div className="attendance-staff-modal-backdrop">
          <section
            aria-labelledby="attendance-staff-modal-title"
            aria-modal="true"
            className="attendance-staff-modal"
            role="dialog"
          >
            <header>
              <div>
                <p className="attendance-staff-eyebrow">MANUAL ATTENDANCE</p>
                <h3 id="attendance-staff-modal-title">Mark staff attendance</h3>
                <p>
                  {manualStaff
                    ? `${manualStaff.firstName} ${manualStaff.lastName}`
                    : 'Choose a staff member to record attendance.'}
                </p>
              </div>
              <button
                aria-label="Close manual mark"
                className="attendance-staff-modal-close"
                disabled={isSaving}
                onClick={() => setManualOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <label>
              Staff member
              <select
                onChange={(event) => setManualStaffId(event.target.value)}
                value={manualStaffId}
              >
                <option value="">Select staff member</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Attendance status
              <select
                onChange={(event) =>
                  setManualStatus(event.target.value as StaffAttendanceStatus)
                }
                value={manualStatus}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Remarks <span>(optional)</span>
              <textarea
                maxLength={500}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Add a note if needed..."
                rows={3}
                value={remarks}
              />
            </label>
            <footer>
              <button
                className="attendance-staff-manual"
                disabled={isSaving}
                onClick={() => setManualOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="attendance-staff-checkin"
                disabled={!canWrite || isSaving || !manualStaffId}
                onClick={() => void submitManualMark()}
                type="button"
              >
                {isSaving ? 'Saving...' : 'Save Attendance'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
