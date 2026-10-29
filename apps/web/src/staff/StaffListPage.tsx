import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pagination } from '../components/ui/Pagination.js';
import {
  WorkspaceModuleSection,
  WorkspaceStaffCard,
} from '../components/ui/WorkspacePrimitives.js';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import {
  StaffAccess,
  StaffHeading,
  StaffStatusBadge,
  apiMessage,
  useCampusChoices,
  useOrganizationAccess,
} from './StaffPageShared.js';
import type { StaffStatus } from './staff-api.js';
import { useStaffList } from './staff-queries.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';

const PAGE_SIZE = 20;

export function StaffListPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const academics = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data?.permissions.includes('staff.read')),
  );
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
            description="Browse teachers, their subjects, and assigned classes."
            eyebrow="Staff directory · Subjects & classes"
            organizationId={organizationId}
            title="Staff & teachers"
          />
          <WorkspaceModuleSection className="student-list-panel panel">
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
                        : 'Add new teacher or staff'}
                    </h2>
                    <p>
                      {search || department || status || campusId
                        ? 'Try changing or clearing your search and filters.'
                        : 'Assign subjects and sections'}
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
                      const assignments =
                        academics.assignments.data?.items.filter(
                          (assignment) =>
                            assignment.teacherStaffId === person.id,
                        ) ?? [];
                      const classLabels = assignments
                        .map((assignment) => {
                          const className = academics.classes.data?.items.find(
                            (item) => item.id === assignment.classId,
                          )?.name;
                          const sectionName =
                            academics.sections.data?.items.find(
                              (item) => item.id === assignment.sectionId,
                            )?.name;
                          return className && sectionName
                            ? `${className}-${sectionName}`
                            : '';
                        })
                        .filter(Boolean);
                      const assignedSubjects = assignments
                        .map(
                          (assignment) =>
                            academics.subjects.data?.items.find(
                              (item) => item.id === assignment.subjectId,
                            )?.name,
                        )
                        .filter((subject): subject is string =>
                          Boolean(subject),
                        );
                      const subjects = [
                        ...new Set([
                          ...(person.subjects ?? []),
                          ...assignedSubjects,
                        ]),
                      ];
                      const classes = [...new Set(classLabels)];
                      return (
                        <WorkspaceStaffCard
                          action={
                            <div className="reference-staff-actions">
                              <Link
                                className="reference-outline-button reference-staff-profile-action"
                                to={profilePath}
                              >
                                View Profile
                              </Link>
                              <Link
                                className="reference-outline-button reference-staff-timetable-action"
                                to={`${profilePath}/timetable`}
                              >
                                Timetable
                              </Link>
                            </div>
                          }
                          details={[
                            [...subjects, ...classes].length
                              ? [...subjects, ...classes].join(' · ')
                              : 'Subjects & classes not assigned',
                          ]}
                          initials={
                            `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase() ||
                            'S'
                          }
                          key={person.id}
                          name={
                            <Link
                              className="staff-profile-name"
                              to={profilePath}
                            >
                              {name}
                            </Link>
                          }
                          status={<StaffStatusBadge status={person.status} />}
                          subtitle={null}
                        />
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
          </WorkspaceModuleSection>
        </main>
      )}
    </StaffAccess>
  );
}
