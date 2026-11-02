import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { listStaff } from '../staff/staff-api.js';
import { Button } from '../components/ui/Button.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Dialog } from '../components/ui/Dialog.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import type { TableColumn } from '../components/ui/DataTable.js';
import {
  useAcademicsWorkspace,
  useDeleteAcademicsResource,
  useSaveAcademicsResource,
} from './academics-queries.js';
import type {
  AcademicsFormPayload,
  AcademicsResource,
  AcademicClass,
  AcademicSection,
  AcademicSubject,
  AcademicTerm,
  AcademicYear,
  TeacherAssignment,
} from './academics-api.js';
import { AcademicsForm } from './AcademicsForm.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { ClassEnrollmentPanel } from './ClassEnrollmentPanel.js';
import { ClassesSectionsReferenceView } from './ClassesSectionsReferenceView.js';
import { AcademicOverview } from './AcademicOverview.js';
import { AcademicTimetable } from './AcademicTimetable.js';
import { getAcademicsRosterPermissions } from './academics-permissions.js';

const managerRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
];

const tabs: Array<{ resource: AcademicsResource; label: string }> = [
  { resource: 'academic-years', label: 'Academic years' },
  { resource: 'terms', label: 'Terms' },
  { resource: 'classes', label: 'Classes' },
  { resource: 'sections', label: 'Sections' },
  { resource: 'subjects', label: 'Subjects' },
  { resource: 'teacher-assignments', label: 'Teacher assignments' },
];

const resourceNames: Record<AcademicsResource, string> = {
  'academic-years': 'academic year',
  terms: 'term',
  classes: 'class',
  sections: 'section',
  subjects: 'subject',
  'teacher-assignments': 'teacher assignment',
};

interface AcademicsRow {
  id: string;
  title: string;
  details: string;
  values: Record<string, unknown>;
}

function row(
  record: object & { id: string },
  title: string,
  details: string,
): AcademicsRow {
  return {
    id: record.id,
    title,
    details,
    values: Object.fromEntries(Object.entries(record)),
  };
}

function displayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

function isTeachingStaff(person: {
  designation?: string;
  subjects?: string[];
}): boolean {
  return (
    /\b(teacher|lecturer|professor|instructor|tutor|faculty)\b/i.test(
      person.designation ?? '',
    ) || (person.subjects?.length ?? 0) > 0
  );
}

export function AcademicsDashboard() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const canReadAcademics =
    access.data?.permissions.includes('academics.read') ?? false;
  const canWriteAcademics =
    access.data?.permissions.includes('academics.write') ?? false;
  const canReadStaff = access.data?.permissions.includes('staff.read') ?? false;
  const { canReadStudents, canAddStudents } =
    getAcademicsRosterPermissions(access.data?.permissions ?? []);
  const canAssignTeachers = canWriteAcademics && canReadStaff;
  const canCreateCampuses =
    access.data?.permissions.includes('campus.create') ?? false;
  const canManage =
    managerRoles.includes(access.data?.role ?? '') && canReadAcademics;
  const workspace = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canManage),
  );
  const staff = useQuery({
    queryKey: ['academics', organizationId, 'staff'],
    queryFn: () =>
      listStaff(organizationId, {
        search: '',
        department: '',
        status: 'active',
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(access.data && canManage && canReadStaff),
    retry: false,
  });
  const teacherCandidates = (staff.data?.items ?? []).filter(isTeachingStaff);
  const save = useSaveAcademicsResource(organizationId);
  const remove = useDeleteAcademicsResource(organizationId);
  const [resource, setResource] = useState<AcademicsResource>('classes');
  const canWriteResource =
    canWriteAcademics &&
    (resource !== 'teacher-assignments' || canAssignTeachers);
  const [resourceSearch, setResourceSearch] = useState('');
  const [activeArea, setActiveArea] = useState<
    | 'overview'
    | 'academic-years'
    | 'terms'
    | 'classes'
    | 'subjects'
    | 'teacher-assignments'
    | 'timetable'
  >('overview');
  const [editing, setEditing] = useState<AcademicsRow>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [enrollmentView, setEnrollmentView] = useState<
    'students' | 'add-students' | 'teacher'
  >('students');
  const [enrollmentFocusRequest, setEnrollmentFocusRequest] = useState(0);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [enrollmentSectionId, setEnrollmentSectionId] = useState<
    string | undefined
  >();
  const [enrollmentClassId, setEnrollmentClassId] = useState<
    string | undefined
  >();
  const [newSectionClassId, setNewSectionClassId] = useState<
    string | undefined
  >();
  const enrollmentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showEnrollment)
      enrollmentRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      });
  }, [showEnrollment, enrollmentClassId]);
  const selectedTab = tabs.find((tab) => tab.resource === resource) ?? tabs[0]!;

  const campusNames = new Map(
    (workspace.campuses.data?.campuses ?? []).map((campus) => [
      campus.id,
      campus.name,
    ]),
  );
  const yearNames = new Map(
    (workspace.years.data?.items ?? []).map((year) => [year.id, year.name]),
  );
  const classNames = new Map(
    (workspace.classes.data?.items ?? []).map((item) => [
      item.id,
      `${item.name}${item.programName ? ` · ${item.programName}` : ''} (${item.code})`,
    ]),
  );
  const sectionNames = new Map(
    (workspace.sections.data?.items ?? []).map((item) => [
      item.id,
      `${classNames.get(item.classId) ?? 'Class'} · ${item.name}`,
    ]),
  );
  const subjectNames = new Map(
    (workspace.subjects.data?.items ?? []).map((item) => [item.id, item.name]),
  );
  const staffNames = new Map(
    (staff.data?.items ?? []).map((person) => [
      person.id,
      displayName(person.firstName, person.lastName),
    ]),
  );

  const recordsByResource = (): AcademicsRow[] => {
    switch (resource) {
      case 'academic-years':
        return (workspace.years.data?.items ?? []).map((item: AcademicYear) =>
          row(
            item,
            item.name,
            `${item.startDate} – ${item.endDate} · ${item.status}`,
          ),
        );
      case 'terms':
        return (workspace.terms.data?.items ?? []).map((item: AcademicTerm) =>
          row(
            item,
            item.name,
            `${yearNames.get(item.academicYearId) ?? 'Academic year'} · ${item.startDate} – ${item.endDate}`,
          ),
        );
      case 'classes':
        return (workspace.classes.data?.items ?? []).map(
          (item: AcademicClass) =>
            row(
              item,
              item.name,
              `${item.code} · ${item.studyLevel === 'first_year' ? 'First Year' : item.studyLevel === 'second_year' ? 'Second Year' : item.studyLevel === 'other' ? 'Other level' : 'Study level not set'}${item.programName ? ` · ${item.programName}` : ''} · ${campusNames.get(item.campusId) ?? 'Assigned campus'}`,
            ),
        );
      case 'sections':
        return (workspace.sections.data?.items ?? []).map(
          (item: AcademicSection) =>
            row(
              item,
              item.name,
              `${classNames.get(item.classId) ?? 'Class'} · ${item.capacity ? `Capacity ${item.capacity}` : 'Capacity not set'}`,
            ),
        );
      case 'subjects':
        return (workspace.subjects.data?.items ?? []).map(
          (item: AcademicSubject) =>
            row(
              item,
              item.name,
              `${item.code}${item.department ? ` · ${item.department}` : ''}`,
            ),
        );
      case 'teacher-assignments':
        return (workspace.assignments.data?.items ?? []).map(
          (item: TeacherAssignment) =>
            row(
              item,
              staffNames.get(item.teacherStaffId) ?? 'Teacher',
              `${subjectNames.get(item.subjectId) ?? 'Subject'} · ${classNames.get(item.classId) ?? 'Class'} · ${sectionNames.get(item.sectionId)?.split(' · ').slice(-1)[0] ?? 'Section'} · ${yearNames.get(item.academicYearId) ?? 'Academic year'}`,
            ),
        );
    }
  };

  const activeQuery = {
    'academic-years': workspace.years,
    terms: workspace.terms,
    classes: workspace.classes,
    sections: workspace.sections,
    subjects: workspace.subjects,
    'teacher-assignments': workspace.assignments,
  }[resource];

  const choices: Parameters<typeof AcademicsForm>[0]['choices'] = {
    academicYearId: (workspace.years.data?.items ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
    campusId: (workspace.campuses.data?.campuses ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
    classId: (workspace.classes.data?.items ?? []).map((item) => ({
      value: item.id,
      label: `${item.name}${item.programName ? ` · ${item.programName}` : ''} (${item.code})`,
    })),
    classIds: (workspace.classes.data?.items ?? []).map((item) => ({
      value: item.id,
      label: `${item.name}${item.programName ? ` · ${item.programName}` : ''} (${item.code})`,
    })),
    subjectId: (workspace.subjects.data?.items ?? []).map((item) => ({
      value: item.id,
      label: item.name,
      classIds: item.classIds ?? [],
    })),
    sectionId: (workspace.sections.data?.items ?? []).map((item) => ({
      value: item.id,
      label: `${classNames.get(item.classId) ?? 'Class'} · ${item.name}`,
    })),
    teacherStaffId: teacherCandidates.map((item) => ({
      value: item.id,
      label: displayName(item.firstName, item.lastName),
    })),
  };

  const beginCreate = () => {
    if (!canWriteResource) return;
    save.reset();
    setEditing(undefined);
    setDialogOpen(true);
  };
  const beginEdit = (item: AcademicsRow) => {
    if (!canWriteResource) return;
    save.reset();
    setEditing(item);
    setDialogOpen(true);
  };
  const saveRecord = (input: AcademicsFormPayload) => {
    if (!canWriteResource) return;
    save.mutate(
      { resource, id: editing?.id, data: input },
      { onSuccess: () => setDialogOpen(false) },
    );
  };
  const deleteRecord = (item: AcademicsRow) => {
    if (!canWriteResource) return;
    if (!window.confirm(`Delete ${item.title}?`)) return;
    remove.mutate({ resource, id: item.id });
  };

  if (access.isPending)
    return <LoadingState message="Checking academic workspace access..." />;
  if (access.isError || !access.data) {
    return (
      <ErrorState
        title="Academic workspace unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Organization access could not be verified.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (!canManage) return <PermissionDeniedState />;

  const areaNavigation = (
    <>
      <nav aria-label="Academic centre navigation" className="academics-tabs">
        {(
          [
            ['overview', 'Overview'],
            ['academic-years', 'Academic Years'],
            ['terms', 'Terms'],
            ['classes', 'Classes & Sections'],
            ['subjects', 'Subjects'],
            ['teacher-assignments', 'Teacher Assignments'],
            ['timetable', 'Timetable'],
          ] as const
        ).map(([area, label]) => (
          <button
            aria-current={activeArea === area ? 'page' : undefined}
            className={`academics-tab${activeArea === area ? ' academics-tab-active' : ''}`}
            key={area}
            onClick={() => {
              save.reset();
              remove.reset();
              setActiveArea(area);
              setResourceSearch('');
              // Returning to Classes & Sections must always open its overview,
              // never a previously opened student/teacher assignment panel.
              setShowEnrollment(false);
              setEnrollmentSectionId(undefined);
              setEnrollmentClassId(undefined);
              setEnrollmentView('students');
              if (area === 'classes') setResource('classes');
              else if (
                area === 'academic-years' ||
                area === 'terms' ||
                area === 'subjects' ||
                area === 'teacher-assignments'
              )
                setResource(area);
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {!canWriteAcademics && (
        <p className="academics-readonly-note" role="status">
          You have read-only access to academic setup. Ask the Owner to grant
          academics.write if you need to make changes.
        </p>
      )}
    </>
  );

  if (activeArea === 'overview') {
    return (
      <main className="page-stack academics-page">
        <WorkspacePageHeading
          eyebrow="Organization workspace"
          title="Academics"
          description="Institute ke academic centre ki overall situation aur setup."
        />
        {areaNavigation}
        <AcademicOverview
          years={workspace.years.data?.items ?? []}
          terms={workspace.terms.data?.items ?? []}
          classes={workspace.classes.data?.items ?? []}
          sections={workspace.sections.data?.items ?? []}
          subjects={workspace.subjects.data?.items ?? []}
          assignments={workspace.assignments.data?.items ?? []}
          campuses={workspace.campuses.data?.campuses ?? []}
          onOpen={(area) => {
            setShowEnrollment(false);
            setEnrollmentSectionId(undefined);
            setEnrollmentClassId(undefined);
            setEnrollmentView('students');
            setActiveArea(area);
            setResource(area);
            setResourceSearch('');
          }}
        />
      </main>
    );
  }

  if (activeArea === 'timetable') {
    return (
      <main className="page-stack academics-page">
        <WorkspacePageHeading
          eyebrow="Academic centre"
          title="Timetable"
          description="Teacher-wise weekly periods and assignment schedule."
        />
        {areaNavigation}
        <AcademicTimetable
          organizationId={organizationId}
          teachers={teacherCandidates.map(({ id, firstName, lastName }) => ({
            id,
            firstName,
            lastName,
          }))}
          assignments={workspace.assignments.data?.items ?? []}
          classes={workspace.classes.data?.items ?? []}
          sections={workspace.sections.data?.items ?? []}
          subjects={workspace.subjects.data?.items ?? []}
          years={workspace.years.data?.items ?? []}
          canWrite={canWriteAcademics && canReadStaff}
        />
        {staff.isError && (
          <p className="form-error" role="alert">
            Teacher list unavailable: {apiMessage(staff.error)}
          </p>
        )}
      </main>
    );
  }

  if (activeArea === 'classes') {
    const classWorkspaceQueries = [
      { label: 'classes', query: workspace.classes },
      { label: 'sections', query: workspace.sections },
      { label: 'academic years', query: workspace.years },
      { label: 'campuses', query: workspace.campuses },
      { label: 'subjects', query: workspace.subjects },
      { label: 'teacher assignments', query: workspace.assignments },
    ];
    const failedClassQuery = classWorkspaceQueries.find(
      ({ query }) => query.isError,
    );
    if (classWorkspaceQueries.some(({ query }) => query.isPending)) {
      return (
        <main className="page-stack academics-page">
          {areaNavigation}
          <LoadingState message="Loading classes, sections and academic records…" />
        </main>
      );
    }
    if (failedClassQuery) {
      return (
        <main className="page-stack academics-page">
          {areaNavigation}
          <ErrorState
            title={`Could not load ${failedClassQuery.label}`}
            description={apiMessage(failedClassQuery.query.error)}
            onRetry={() =>
              void Promise.all(
                classWorkspaceQueries.map(({ query }) => query.refetch()),
              )
            }
          />
        </main>
      );
    }
    const openCreate = (
      targetResource: 'classes' | 'sections',
      targetClassId?: string,
    ) => {
      if (!canWriteAcademics) return;
      save.reset();
      remove.reset();
      setResource(targetResource);
      setEditing(undefined);
      setNewSectionClassId(
        targetResource === 'sections' ? targetClassId : undefined,
      );
      setDialogOpen(true);
    };
    const openEdit = (
      targetResource: 'classes' | 'sections',
      record: AcademicClass | AcademicSection,
    ) => {
      if (!canWriteAcademics) return;
      save.reset();
      setResource(targetResource);
      setNewSectionClassId(undefined);
      const details =
        targetResource === 'classes'
          ? `${(record as AcademicClass).code} · ${campusNames.get((record as AcademicClass).campusId) ?? 'Assigned campus'}`
          : `${classNames.get((record as AcademicSection).classId) ?? 'Class'} · ${(record as AcademicSection).capacity ? `Capacity ${(record as AcademicSection).capacity}` : 'Capacity not set'}`;
      setEditing(row(record, record.name, details));
      setDialogOpen(true);
    };
    const deleteAcademicRecord = (
      targetResource: 'classes' | 'sections',
      id: string,
      title: string,
    ) => {
      if (!canWriteAcademics) return;
      if (!window.confirm(`Delete ${title}?`)) return;
      remove.mutate({ resource: targetResource, id });
    };

    return (
      <div className="page-stack academics-page">
        <WorkspacePageHeading
          eyebrow="Organization workspace"
          title="Academics"
          description="Manage classes, sections, student placement and subject-teacher assignments."
        />
        {areaNavigation}
        <ClassesSectionsReferenceView
          classes={workspace.classes.data?.items ?? []}
          sections={workspace.sections.data?.items ?? []}
          years={workspace.years.data?.items ?? []}
          campuses={workspace.campuses.data?.campuses ?? []}
          subjects={workspace.subjects.data?.items ?? []}
          assignments={workspace.assignments.data?.items ?? []}
          teachers={teacherCandidates.map(({ id, firstName, lastName }) => ({
            id,
            firstName,
            lastName,
          }))}
          onCreate={openCreate}
          onCreateSubject={() => {
            if (!canWriteAcademics) return;
            save.reset();
            setSubjectDialogOpen(true);
          }}
          onEdit={openEdit}
          onDelete={deleteAcademicRecord}
          canWriteAcademics={canWriteAcademics}
          canReadStudents={canReadStudents}
          canAddStudents={canAddStudents}
          canAssignTeachers={canAssignTeachers}
          canCreateCampuses={canCreateCampuses}
          onOpenEnrollment={(sectionId, classId, view = 'students') => {
            if (
              (view === 'students' && !canReadStudents) ||
              (view === 'add-students' && !canAddStudents) ||
              (view === 'teacher' && !canAssignTeachers)
            )
              return;
            setEnrollmentSectionId(sectionId);
            setEnrollmentClassId(classId);
            setEnrollmentView(view);
            setShowEnrollment(true);
            // Re-trigger the inner panel scroll even when the same view is already open.
            setEnrollmentFocusRequest((request) => request + 1);
          }}
          onOpenCampusSetup={() =>
            navigate(
              `/admin/organizations/${encodeURIComponent(organizationId)}?tab=campuses`,
            )
          }
        />
        {showEnrollment && (
          <div
            className="academics-page class-enrollment-shell"
            ref={enrollmentRef}
          >
            <div className="class-enrollment-shell-heading">
              <div>
                <strong>
                  {enrollmentView === 'students'
                    ? 'Student Management'
                    : 'Assign Subject Teacher'}
                </strong>
                <p>
                  {enrollmentView === 'students'
                    ? 'View enrolled students, search the roster, add students, or remove selected students.'
                    : 'Choose the academic session, section, subject and teacher for this assignment.'}
                </p>
              </div>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setShowEnrollment(false)}
              >
                Close
              </Button>
            </div>
            <ClassEnrollmentPanel
              key={`${enrollmentClassId ?? 'all'}:${enrollmentSectionId ?? 'none'}`}
              organizationId={organizationId}
              classes={workspace.classes.data?.items ?? []}
              sections={workspace.sections.data?.items ?? []}
              years={workspace.years.data?.items ?? []}
              subjects={workspace.subjects.data?.items ?? []}
              teachers={teacherCandidates.map(
                ({ id, firstName, lastName }) => ({
                  id,
                  firstName,
                  lastName,
                }),
              )}
              teachersLoading={canReadStaff && staff.isFetching}
              teachersError={
                !canReadStaff
                  ? 'Your Admin role does not have staff.read permission.'
                  : staff.isError
                    ? apiMessage(staff.error)
                    : undefined
              }
              onRetryTeachers={() => {
                if (canReadStaff) void staff.refetch();
              }}
              onManageStaff={() =>
                navigate(
                  `/admin/organizations/${encodeURIComponent(organizationId)}/staff`,
                )
              }
              initialSectionId={enrollmentSectionId}
              initialClassId={enrollmentClassId}
              initialView={enrollmentView}
              focusRequest={enrollmentFocusRequest}
              onViewChange={setEnrollmentView}
              onCreateSection={(classId) => openCreate('sections', classId)}
              canWriteAcademics={canWriteAcademics}
              canReadStudents={canReadStudents}
              canAddStudents={canAddStudents}
              canAssignTeachers={canAssignTeachers}
            />
          </div>
        )}
        <Dialog
          description="Add a subject to your organization so it can be assigned to classes, sections and teachers."
          onOpenChange={setSubjectDialogOpen}
          open={subjectDialogOpen}
          title="Add subject"
        >
          <AcademicsForm
            choices={choices}
            isSaving={save.isPending}
            onSubmit={(input) =>
              save.mutate(
                { resource: 'subjects', data: input },
                { onSuccess: () => setSubjectDialogOpen(false) },
              )
            }
            resource="subjects"
            saveError={save.error ? apiMessage(save.error) : undefined}
          />
        </Dialog>
        <Dialog
          description={`${editing ? 'Update' : 'Create'} ${selectedTab.label.toLowerCase()} for this organization.`}
          onOpenChange={(open) => setDialogOpen(open)}
          open={dialogOpen}
          title={`${editing ? 'Edit' : 'Add'} ${resourceNames[resource]}`}
        >
          <AcademicsForm
            choices={choices}
            isSaving={save.isPending}
            onSubmit={saveRecord}
            record={
              editing?.values ??
              (resource === 'sections' && newSectionClassId
                ? { classId: newSectionClassId }
                : undefined)
            }
            resource={resource}
            saveError={save.error ? apiMessage(save.error) : undefined}
          />
        </Dialog>
      </div>
    );
  }

  const rows = recordsByResource();
  const filteredRows = rows.filter((item) =>
    `${item.title} ${item.details}`
      .toLocaleLowerCase()
      .includes(resourceSearch.trim().toLocaleLowerCase()),
  );
  const columns: TableColumn<AcademicsRow>[] = [
    { header: 'Name', render: (item) => <strong>{item.title}</strong> },
    { header: 'Details', render: (item) => item.details },
    ...(canWriteResource
      ? [
          {
            header: 'Actions',
            align: 'right' as const,
            render: (item: AcademicsRow) => (
              <span className="academics-row-actions">
                <Button
                  onClick={() => beginEdit(item)}
                  type="button"
                  variant="quiet"
                >
                  Edit
                </Button>
                <Button
                  disabled={remove.isPending}
                  onClick={() => deleteRecord(item)}
                  type="button"
                  variant="quiet"
                >
                  Delete
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <main className="page-stack academics-page">
      <WorkspacePageHeading
        eyebrow="Organization workspace"
        title="Academics"
        description="Set up academic calendars, class structures, subjects, and teacher assignments."
        aside={
          canWriteResource ? (
            <Button onClick={beginCreate} type="button" variant="primary">
              Add {resourceNames[resource]}
            </Button>
          ) : undefined
        }
      />

      {areaNavigation}

      <section className="panel student-list-panel academics-panel">
        <div className="academics-panel-heading">
          <div>
            <h2>{selectedTab.label}</h2>
            <p>
              Manage {selectedTab.label.toLocaleLowerCase()} for this
              organization.
            </p>
          </div>
          <span className="academic-resource-count">
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        <div className="academic-resource-toolbar">
          <label className="academic-resource-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label={`Search ${selectedTab.label.toLocaleLowerCase()}`}
              onChange={(event) => setResourceSearch(event.target.value)}
              placeholder={`Search ${resourceNames[resource]}...`}
              type="search"
              value={resourceSearch}
            />
          </label>
          <span>
            {filteredRows.length} of {rows.length} shown
          </span>
        </div>
        {activeQuery.isPending ? (
          <LoadingState
            message={`Loading ${selectedTab.label.toLowerCase()}...`}
          />
        ) : activeQuery.isError ? (
          <ErrorState
            title={`${selectedTab.label} unavailable`}
            description={apiMessage(activeQuery.error)}
            onRetry={() => void activeQuery.refetch()}
          />
        ) : (
          <DataTable
            caption={selectedTab.label}
            columns={columns}
            emptyDescription={
              resourceSearch.trim()
                ? `No ${resourceNames[resource]} matches “${resourceSearch.trim()}”. Try another search.`
                : `Add the first ${selectedTab.label.toLowerCase()} record for this organization.`
            }
            emptyTitle={
              resourceSearch.trim()
                ? 'No matching records'
                : `No ${selectedTab.label.toLowerCase()} yet`
            }
            rowKey={(item) => item.id}
            rows={filteredRows}
          />
        )}
        {resource === 'teacher-assignments' && staff.isError && (
          <p className="form-error" role="alert">
            Teacher choices are unavailable: {apiMessage(staff.error)}
          </p>
        )}
        {(save.isError || remove.isError) && (
          <p className="form-error" role="alert">
            {apiMessage(save.error ?? remove.error)}
          </p>
        )}
      </section>

      <Dialog
        description={`${editing ? 'Update' : 'Create'} ${selectedTab.label.toLowerCase()} for this organization.`}
        onOpenChange={(open) => setDialogOpen(open)}
        open={dialogOpen}
        title={`${editing ? 'Edit' : 'Add'} ${resourceNames[resource]}`}
      >
        <AcademicsForm
          choices={choices}
          isSaving={save.isPending}
          onSubmit={saveRecord}
          record={editing?.values}
          resource={resource}
          saveError={save.error ? apiMessage(save.error) : undefined}
        />
      </Dialog>
    </main>
  );
}
