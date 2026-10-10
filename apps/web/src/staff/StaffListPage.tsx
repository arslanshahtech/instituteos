import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../components/ui/DataTable.js';
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
        <main className="page-stack student-management-page staff-management-page">
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
                <DataTable
                  caption="Staff and teachers"
                  columns={[
                    {
                      header: 'Staff member',
                      render: (person) => (
                        <Link
                          className="student-name-link"
                          to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(person.id)}`}
                        >
                          {person.firstName} {person.lastName}
                        </Link>
                      ),
                    },
                    {
                      header: 'Role / department',
                      render: (person) => (
                        <span>
                          {person.designation ?? person.role ?? '—'}
                          {person.department ? ` · ${person.department}` : ''}
                        </span>
                      ),
                    },
                    {
                      header: 'Contact',
                      render: (person) => person.email || person.phone || '—',
                    },
                    {
                      header: 'Campus',
                      render: (person) =>
                        campusName(person.campusId, campusesData),
                    },
                    {
                      header: 'Status',
                      render: (person) => (
                        <StaffStatusBadge status={person.status} />
                      ),
                    },
                  ]}
                  emptyDescription={
                    search || department || status || campusId
                      ? 'Try changing or clearing your search and filters.'
                      : 'Create the first staff record for this organization.'
                  }
                  emptyTitle={
                    search || department || status || campusId
                      ? 'No staff match these filters'
                      : 'No staff records yet'
                  }
                  rowKey={(person) => person.id}
                  rows={staff.data.items}
                />
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
