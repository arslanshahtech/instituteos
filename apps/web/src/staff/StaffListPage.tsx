import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pagination } from '../components/ui/Pagination.js';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import {
  StaffAccess,
  StaffHeading,
  StaffStatusBadge,
  apiMessage,
  campusName,
  useCampusChoices,
  useOrganizationAccess,
} from './StaffPageShared.js';
import type { StaffStatus } from './staff-api.js';
import { useStaffList } from './staff-queries.js';

const PAGE_SIZE = 20;

export function StaffListPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState<StaffStatus | ''>('');
  const [campusId, setCampusId] = useState('');
  const [page, setPage] = useState(1);

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
      status: status || undefined,
      campusId: campusId || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    Boolean(access.data?.permissions.includes('staff.read')),
  );
  const canCreate = access.data?.permissions.includes('staff.create') ?? false;
  const campusesData = campuses.data?.campuses ?? [];
  const campusFilterAvailable =
    access.data?.permissions.includes('campus.read') ?? false;

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.read"
    >
      {(organizationAccess) => (
        <main className="page-stack student-management-page staff-management-page reference-live-module">
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
            description="Search and manage staff and teachers in this organization."
            organizationId={organizationId}
            title="Staff & teachers"
          />
          <section className="student-list-panel panel">
            <div className="staff-filters">
              <label className="student-search-field">
                <span>Search staff</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Name, email, employee code"
                  type="search"
                  value={searchInput}
                />
              </label>
              <label className="student-search-field">
                <span>Department</span>
                <input
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Any department"
                  value={department}
                />
              </label>
              <label className="student-search-field">
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
                  <option value="terminated">Terminated</option>
                  <option value="inactive">Inactive (legacy)</option>
                </select>
              </label>
              {campusFilterAvailable && (
                <label className="student-search-field">
                  <span>Campus</span>
                  <select
                    onChange={(event) => {
                      setCampusId(event.target.value);
                      setPage(1);
                    }}
                    value={campusId}
                  >
                    <option value="">All assigned campuses</option>
                    {campusesData.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {campusFilterAvailable && campuses.isError && (
              <p className="form-error" role="alert">
                Campus filters are unavailable: {apiMessage(campuses.error)}
              </p>
            )}
            {staff.isPending ? (
              <LoadingState message="Loading staff..." />
            ) : staff.isError ? (
              <ErrorState
                title="Staff unavailable"
                description={apiMessage(staff.error)}
                onRetry={() => void staff.refetch()}
              />
            ) : (
              <>
                {staff.data.items.length === 0 ? (
                  <section className="staff-empty-grid">
                    <div className="staff-empty-mark" aria-hidden="true">
                      S
                    </div>
                    <h2>
                      {search || department || status || campusId
                        ? 'No staff match these filters'
                        : 'No staff records yet'}
                    </h2>
                    <p>
                      {search || department || status || campusId
                        ? 'Try changing or clearing your search and filters.'
                        : 'Create the first staff record for this organization.'}
                    </p>
                    {canCreate &&
                      !search &&
                      !department &&
                      !status &&
                      !campusId && (
                        <Link
                          className="button button-primary"
                          to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/new`}
                        >
                          Add first staff member
                        </Link>
                      )}
                  </section>
                ) : (
                  <div
                    className="reference-staff-grid"
                    aria-label="Staff and teachers"
                  >
                    {staff.data.items.map((person) => {
                      const name =
                        `${person.firstName} ${person.lastName}`.trim();
                      const profilePath = `/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(person.id)}`;
                      return (
                        <article
                          className="reference-staff-card"
                          key={person.id}
                        >
                          <span
                            className="reference-staff-avatar"
                            aria-hidden="true"
                          >
                            {`${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase() ||
                              'S'}
                          </span>
                          <div className="reference-staff-copy">
                            <strong>
                              <Link
                                className="staff-profile-name"
                                to={profilePath}
                              >
                                {name}
                              </Link>
                            </strong>
                            <small>
                              {person.designation ??
                                person.role ??
                                'Staff member'}
                            </small>
                            <span>
                              {person.department || 'Department not set'}
                            </span>
                            <span>
                              {campusName(person.campusId, campusesData)}
                            </span>
                            <span>
                              {person.phone ||
                                person.email ||
                                'Contact not provided'}
                            </span>
                            <StaffStatusBadge status={person.status} />
                          </div>
                          <Link
                            className="reference-outline-button"
                            to={profilePath}
                          >
                            View profile
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                )}
                <Pagination
                  currentPage={staff.data.page}
                  onPageChange={setPage}
                  pageSize={staff.data.pageSize}
                  totalItems={staff.data.total}
                />
              </>
            )}
            {organizationAccess.role === 'campus_admin' &&
              !organizationAccess.campusIds.length && (
                <p className="muted-copy">
                  No campus access is assigned to this account.
                </p>
              )}
          </section>
        </main>
      )}
    </StaffAccess>
  );
}
