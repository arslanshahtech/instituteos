import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listStaffAttendance } from '../attendance/attendance-api.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { StaffForm } from './StaffForm.js';
import { useOrganizationSettings } from '../settings/settings-api.js';
import type { StaffInput, StaffRecord } from './staff-api.js';
import {
  StaffAccess,
  StaffHeading,
  StaffStatusBadge,
  apiMessage,
  campusName,
  useCampusChoices,
  useOrganizationAccess,
} from './StaffPageShared.js';
import {
  useCreateStaff,
  useSetStaffStatus,
  useStaff,
  useUpdateStaff,
} from './staff-queries.js';

export function StaffDetailPage() {
  const { organizationId = '', staffId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'attendance' | 'leave' | 'salary' | 'documents'
  >('overview');
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const staff = useStaff(
    organizationId,
    staffId,
    Boolean(access.data?.permissions.includes('staff.read')),
  );
  const canUpdate = Boolean(access.data?.permissions.includes('staff.update'));
  const statusMutation = useSetStaffStatus(organizationId);
  const { showToast } = useToast();
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(new Date().getFullYear(), 0, 1)
    .toISOString()
    .slice(0, 10);
  const attendance = useQuery({
    queryKey: ['staff-profile-attendance', organizationId, staffId, dateFrom, dateTo],
    queryFn: () =>
      listStaffAttendance(organizationId, { staffId, dateFrom, dateTo }),
    enabled: Boolean(
      staffId && access.data?.permissions.includes('staff.read'),
    ),
  });

  if (access.isPending)
    return <LoadingState message="Checking staff access..." />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="Staff access could not be verified for this organization."
        onRetry={() => void access.refetch()}
      />
    );
  if (!access.data.permissions.includes('staff.read'))
    return <PermissionDeniedState />;
  if (staff.isPending)
    return <LoadingState message="Loading staff member..." />;
  if (staff.isError)
    return (
      <ErrorState
        title="Staff member unavailable"
        description={apiMessage(staff.error)}
        onRetry={() => void staff.refetch()}
      />
    );

  const person: StaffRecord = staff.data.staff;
  const campusChoices = campuses.data?.campuses ?? [];
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  const initials = `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
  const attendanceItems = attendance.data?.items ?? [];
  const present = attendanceItems.filter((item) => item.status === 'present').length;
  const absent = attendanceItems.filter((item) => item.status === 'absent').length;
  const halfDay = attendanceItems.filter((item) => item.status === 'half-day').length;
  const onLeave = attendanceItems.filter((item) => item.status === 'on-leave').length;
  const marked = present + absent + halfDay + onLeave;
  const attendanceDays = present + absent + halfDay;
  const attendanceRate = attendanceDays
    ? Math.round(((present + halfDay * 0.5) / attendanceDays) * 100)
    : null;
  const monthlyAttendance = new Map<
    string,
    { label: string; present: number; absent: number; halfDay: number; leave: number }
  >();
  for (const item of attendanceItems) {
    const date = new Date(`${item.date.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = monthlyAttendance.get(key) ?? {
      label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date),
      present: 0,
      absent: 0,
      halfDay: 0,
      leave: 0,
    };
    if (item.status === 'present') month.present += 1;
    if (item.status === 'absent') month.absent += 1;
    if (item.status === 'half-day') month.halfDay += 1;
    if (item.status === 'on-leave') month.leave += 1;
    monthlyAttendance.set(key, month);
  }
  const months = [...monthlyAttendance.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, value]) => value);

  const markAsLeft = () => {
    if (
      !window.confirm(
        `Mark ${fullName} as left? This will change the staff status to Terminated.`,
      )
    ) {
      return;
    }
    statusMutation.mutate(
      { staffId, status: 'terminated' },
      {
        onSuccess: () => showToast('Staff member marked as left.'),
        onError: (error) => showToast(apiMessage(error), 'info'),
      },
    );
  };

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) : 'Not added';

  const tabItems = [
    ['overview', 'Overview'],
    ['attendance', 'Attendance'],
    ['leave', 'Leave'],
    ['salary', 'Salary'],
    ['documents', 'Documents'],
  ] as const;

  return (
    <main className="page-stack student-management-page staff-management-page staff-profile-page">
      <div className="staff-profile-page-heading">
        <div className="staff-profile-identity">
          <Link
            className="staff-profile-back"
            to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
            aria-label="Back to all staff"
          >
            <span aria-hidden="true">←</span>
          </Link>
          <div className="staff-profile-avatar" aria-hidden="true">{initials}</div>
          <div className="staff-profile-identity-copy">
            <div className="staff-profile-name-line">
              <h1>{fullName}</h1>
              <StaffStatusBadge status={person.status} />
            </div>
            <p>
              {person.designation || (person.staffType === 'teacher' ? 'Teacher' : 'Other Staff')}
              {person.createdAt ? ` · Profile added ${formatDate(person.createdAt)}` : ''}
              {person.phone ? ` · ${person.phone}` : ''}
            </p>
            {person.email && <span className="staff-profile-email">{person.email}</span>}
          </div>
        </div>
        <div className="staff-profile-header-actions">
          {canUpdate && person.status !== 'terminated' && person.status !== 'inactive' && (
            <button
              className="staff-profile-secondary-action"
              type="button"
              onClick={markAsLeft}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? 'Updating…' : 'Mark as left'}
            </button>
          )}
          {canUpdate && (
            <Link
              className="staff-profile-primary-action"
              to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffId)}/edit`}
            >
              Edit staff
            </Link>
          )}
        </div>
      </div>

      <section className="staff-profile-summary-grid" aria-label="Staff summary">
        <article className="staff-profile-summary-card">
          <div className="staff-profile-summary-label">Monthly salary</div>
          <strong>Not added</strong>
          <p>Salary details have not been set up</p>
        </article>
        <article className="staff-profile-summary-card is-warning">
          <div className="staff-profile-summary-label">Salary owed</div>
          <strong>Not available</strong>
          <p>Payroll records are not configured</p>
        </article>
        <article className="staff-profile-summary-card is-success">
          <div className="staff-profile-summary-label">Attendance</div>
          <strong>
            {attendance.isPending ? '—' : attendanceRate === null ? 'No data' : `${attendanceRate}%`}
          </strong>
          <p>
            {attendance.isError
              ? 'Attendance could not be loaded'
              : marked
                ? `${present} present, ${halfDay} half-days, ${absent} absences, ${onLeave} on leave`
                : 'No attendance records this year'}
          </p>
        </article>
        <article className="staff-profile-summary-card is-leave">
          <div className="staff-profile-summary-label">Leave in {new Date().getFullYear()}</div>
          <strong>Not available</strong>
          <p>Leave balances are not configured</p>
        </article>
      </section>

      <section className="staff-profile-workspace panel">
        <nav className="staff-profile-tabs" role="tablist" aria-label="Staff profile sections">
          {tabItems.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`staff-tab-${id}`}
              aria-controls="staff-profile-tab-panel"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div
          className="staff-profile-tab-panel"
          id="staff-profile-tab-panel"
          role="tabpanel"
          aria-labelledby={`staff-tab-${activeTab}`}
        >
          {activeTab === 'overview' && (
            <div className="staff-profile-overview-grid">
              <section className="staff-profile-info-card">
                <h2>Personal details</h2>
                <dl>
                  <div><dt>Full name</dt><dd>{fullName}</dd></div>
                  <div><dt>Father's name</dt><dd>Not added</dd></div>
                  <div><dt>CNIC number</dt><dd>Not added</dd></div>
                  <div><dt>Blood group</dt><dd>Not added</dd></div>
                  <div className="is-wide"><dt>Email</dt><dd>{person.email || 'Not added'}</dd></div>
                  <div><dt>Date of birth</dt><dd>{formatDate(person.dateOfBirth)}</dd></div>
                  <div><dt>Gender</dt><dd>{person.gender || 'Not added'}</dd></div>
                </dl>
              </section>
              <section className="staff-profile-info-card">
                <h2>Employment</h2>
                <dl>
                  <div><dt>Staff type</dt><dd>{person.staffType === 'teacher' ? 'Teacher' : 'Other Staff'}</dd></div>
                  <div><dt>Record created</dt><dd>{formatDate(person.createdAt)}</dd></div>
                  <div><dt>Experience</dt><dd>Not added</dd></div>
                  <div><dt>Designation</dt><dd>{person.designation || person.role || 'Not added'}</dd></div>
                  <div><dt>Department</dt><dd>{person.department || 'Not added'}</dd></div>
                  <div><dt>Monthly salary</dt><dd>Not added</dd></div>
                  <div><dt>Qualifications</dt><dd>{person.qualification || person.qualifications?.join(', ') || 'Not added'}</dd></div>
                  <div><dt>Subjects / specialization</dt><dd>{person.subjects?.join(', ') || 'Not added'}</dd></div>
                  <div><dt>Campus</dt><dd>{campusName(person.campusId, campusChoices)}</dd></div>
                </dl>
              </section>
              <section className="staff-profile-info-card staff-profile-contact-card">
                <div className="staff-profile-card-heading">
                  <h2>Contact details</h2>
                  <span>Emergency contact details can be added later</span>
                </div>
                <dl>
                  <div><dt>Contact number 1</dt><dd>{person.phone || 'Not added'}</dd></div>
                  <div><dt>Contact number 2</dt><dd>Not added</dd></div>
                  <div><dt>Address</dt><dd>Not added</dd></div>
                </dl>
                <p className="staff-profile-muted-note">No emergency contact details have been added.</p>
              </section>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="staff-profile-tab-content">
              <div className="staff-profile-section-heading">
                <div>
                  <h2>Attendance</h2>
                  <p>Attendance records from 1 January {new Date().getFullYear()} to today.</p>
                </div>
                <Link
                  className="staff-profile-inline-link"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/attendance`}
                >
                  Work calendar →
                </Link>
              </div>
              {attendance.isPending ? (
                <LoadingState message="Loading staff attendance..." />
              ) : attendance.isError ? (
                <ErrorState
                  title="Attendance unavailable"
                  description={apiMessage(attendance.error)}
                  onRetry={() => void attendance.refetch()}
                />
              ) : (
                <>
                  <div className="staff-profile-attendance-stats">
                    <div><span>Present</span><strong>{present}</strong></div>
                    <div><span>Absent</span><strong className="is-danger">{absent}</strong></div>
                    <div><span>Half-day</span><strong className="is-warning">{halfDay}</strong></div>
                    <div><span>On leave</span><strong>{onLeave}</strong></div>
                    <div><span>Not marked</span><strong>—</strong></div>
                  </div>
                  <section className="staff-profile-info-card staff-profile-monthly-card">
                    <div className="staff-profile-card-heading">
                      <div><h2>By month</h2><p>Most recent first.</p></div>
                    </div>
                    {months.length ? (
                      <div className="staff-profile-table-wrap">
                        <table className="staff-profile-data-table">
                          <thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Half-day</th><th>Leave</th><th>Rate</th></tr></thead>
                          <tbody>
                            {months.map((month) => {
                              const total = month.present + month.absent + month.halfDay;
                              const rate = total ? Math.round(((month.present + month.halfDay * 0.5) / total) * 100) : 0;
                              return (
                                <tr key={month.label}>
                                  <th scope="row">{month.label}</th>
                                  <td>{month.present}</td><td>{month.absent || '—'}</td><td>{month.halfDay || '—'}</td><td>{month.leave || '—'}</td>
                                  <td><span className="staff-profile-rate"><span style={{ width: `${rate}%` }} /></span><small>{rate}%</small></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="staff-profile-empty-state compact">
                        <strong>No attendance records yet</strong>
                        <p>Staff attendance will appear here after it is marked.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="staff-profile-tab-content">
              <div className="staff-profile-section-heading">
                <div><h2>Leave</h2><p>Leave balances and requests for this staff member.</p></div>
              </div>
              <div className="staff-profile-empty-state">
                <strong>Leave management is not connected yet</strong>
                <p>InstituteOS does not currently store staff leave balances or leave requests, so no balance is shown here.</p>
              </div>
            </div>
          )}

          {activeTab === 'salary' && (
            <div className="staff-profile-tab-content">
              <div className="staff-profile-section-heading">
                <div><h2>Salary</h2><p>Monthly salary history and payment status.</p></div>
              </div>
              <div className="staff-profile-empty-state">
                <strong>Payroll records are not configured yet</strong>
                <p>Salary, paid amounts and outstanding dues will appear here when staff payroll is added to InstituteOS.</p>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="staff-profile-tab-content">
              <div className="staff-profile-section-heading">
                <div><h2>Documents</h2><p>Staff documents are private and visible only to authorized administrators.</p></div>
              </div>
              <div className="staff-profile-empty-state">
                <strong>Staff document storage is not connected yet</strong>
                <p>Contracts, degrees, CNIC copies and other staff documents cannot be uploaded from this profile yet.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export function StaffCreatePage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const setup = useOrganizationSettings(organizationId, Boolean(access.data?.permissions.includes('organization.read')));
  const campuses = useCampusChoices(organizationId, access.data);
  const mutation = useCreateStaff(organizationId);
  const { showToast } = useToast();

  const submit = (input: StaffInput) => {
    mutation.mutate(input, {
      onSuccess: ({ staff }) => {
        showToast('Staff member created successfully.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staff.id)}`,
        );
      },
    });
  };

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.create"
    >
      {(organizationAccess) => (
        <main className="page-stack student-management-page staff-management-page">
          <StaffHeading
            description="Add an employee or teacher record to this organization."
            organizationId={organizationId}
            backTo={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
            title="Add staff member"
          />
          <section className="student-form-panel panel">
            <StaffForm
              setupOptions={{ departments: setup.data?.settings.staffSetup.departments.filter((item) => item.isActive).map((item) => item.name) ?? [], designations: setup.data?.settings.staffSetup.designations.filter((item) => item.isActive).map((item) => item.name) ?? [], qualifications: setup.data?.settings.staffSetup.qualifications.filter((item) => item.isActive).map((item) => item.name) ?? [] }}
              campusError={
                campuses.isError ? apiMessage(campuses.error) : undefined
              }
              campuses={campuses.data?.campuses ?? []}
              canAssignCampus={organizationAccess.permissions.includes(
                'campus.read',
              )}
              campusRequired={organizationAccess.role === 'campus_admin'}
              isSaving={mutation.isPending}
              onSubmit={submit}
              saveError={
                mutation.isError ? apiMessage(mutation.error) : undefined
              }
            />
          </section>
        </main>
      )}
    </StaffAccess>
  );
}

export function StaffEditPage() {
  const { organizationId = '', staffId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const setup = useOrganizationSettings(organizationId, Boolean(access.data?.permissions.includes('organization.read')));
  const campuses = useCampusChoices(organizationId, access.data);
  const staff = useStaff(
    organizationId,
    staffId,
    Boolean(access.data?.permissions.includes('staff.update')),
  );
  const mutation = useUpdateStaff(organizationId, staffId);
  const { showToast } = useToast();

  const submit = (input: StaffInput) => {
    mutation.mutate(input, {
      onSuccess: () => {
        showToast('Staff changes saved.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffId)}`,
        );
      },
    });
  };

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.update"
    >
      {(organizationAccess) =>
        staff.isPending ? (
          <LoadingState message="Loading staff member..." />
        ) : staff.isError ? (
          <ErrorState
            title="Staff member unavailable"
            description={apiMessage(staff.error)}
            onRetry={() => void staff.refetch()}
          />
        ) : (
          <main className="page-stack student-management-page staff-management-page">
            <StaffHeading
              description="Update this staff profile and employment record."
              organizationId={organizationId}
              backTo={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
              title={`Edit ${staff.data.staff.firstName} ${staff.data.staff.lastName}`}
            />
            <section className="student-form-panel panel">
              <StaffForm
                staff={staff.data.staff}
                setupOptions={{ departments: setup.data?.settings.staffSetup.departments.filter((item) => item.isActive).map((item) => item.name) ?? [], designations: setup.data?.settings.staffSetup.designations.filter((item) => item.isActive).map((item) => item.name) ?? [], qualifications: setup.data?.settings.staffSetup.qualifications.filter((item) => item.isActive).map((item) => item.name) ?? [] }}
                campusError={
                  campuses.isError ? apiMessage(campuses.error) : undefined
                }
                campuses={campuses.data?.campuses ?? []}
                canAssignCampus={organizationAccess.permissions.includes(
                  'campus.read',
                )}
                campusRequired={organizationAccess.role === 'campus_admin'}
                isSaving={mutation.isPending}
                onSubmit={submit}
                saveError={
                  mutation.isError ? apiMessage(mutation.error) : undefined
                }
              />
            </section>
          </main>
        )
      }
    </StaffAccess>
  );
}
