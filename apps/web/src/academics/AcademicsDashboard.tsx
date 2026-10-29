import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export function AcademicsDashboard() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const canManage = managerRoles.includes(access.data?.role ?? '');
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
    enabled: Boolean(access.data && canManage),
    retry: false,
  });
  const save = useSaveAcademicsResource(organizationId);
  const remove = useDeleteAcademicsResource(organizationId);
  const [resource, setResource] = useState<AcademicsResource>('classes');
  const [editing, setEditing] = useState<AcademicsRow>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [enrollmentView, setEnrollmentView] = useState<'students' | 'teacher'>(
    'students',
  );
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
      `${item.name} (${item.code})`,
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
              `${item.code} · ${campusNames.get(item.campusId) ?? 'Assigned campus'}`,
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
      label: `${item.name} (${item.code})`,
    })),
    subjectId: (workspace.subjects.data?.items ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
    sectionId: (workspace.sections.data?.items ?? []).map((item) => ({
      value: item.id,
      label: `${classNames.get(item.classId) ?? 'Class'} · ${item.name}`,
    })),
    teacherStaffId: (staff.data?.items ?? []).map((item) => ({
      value: item.id,
      label: displayName(item.firstName, item.lastName),
    })),
  };

  const beginCreate = () => {
    save.reset();
    setEditing(undefined);
    setDialogOpen(true);
  };
  const beginEdit = (item: AcademicsRow) => {
    save.reset();
    setEditing(item);
    setDialogOpen(true);
  };
  const saveRecord = (input: AcademicsFormPayload) => {
    save.mutate(
      { resource, id: editing?.id, data: input },
      { onSuccess: () => setDialogOpen(false) },
    );
  };
  const deleteRecord = (item: AcademicsRow) => {
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

  if (resource === 'classes' || resource === 'sections') {
    const openCreate = (
      targetResource: 'classes' | 'sections',
      targetClassId?: string,
    ) => {
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
      if (!window.confirm(`Delete ${title}?`)) return;
      remove.mutate({ resource: targetResource, id });
    };

    return (
      <>
        <ClassesSectionsReferenceView
          classes={workspace.classes.data?.items ?? []}
          sections={workspace.sections.data?.items ?? []}
          years={workspace.years.data?.items ?? []}
          campuses={workspace.campuses.data?.campuses ?? []}
          subjects={workspace.subjects.data?.items ?? []}
          assignments={workspace.assignments.data?.items ?? []}
          teachers={(staff.data?.items ?? []).map(
            ({ id, firstName, lastName }) => ({
              id,
              firstName,
              lastName,
            }),
          )}
          onCreate={openCreate}
          onCreateSubject={() => {
            save.reset();
            setSubjectDialogOpen(true);
          }}
          onEdit={openEdit}
          onDelete={deleteAcademicRecord}
          onOpenEnrollment={(sectionId, classId, view = 'students') => {
            setEnrollmentSectionId(sectionId);
            setEnrollmentClassId(classId);
            setEnrollmentView(view);
            setShowEnrollment(true);
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
              teachers={(staff.data?.items ?? []).map(
                ({ id, firstName, lastName }) => ({
                  id,
                  firstName,
                  lastName,
                }),
              )}
              teachersLoading={staff.isPending}
              teachersError={
                staff.isError ? apiMessage(staff.error) : undefined
              }
              initialSectionId={enrollmentSectionId}
              initialClassId={enrollmentClassId}
              initialView={enrollmentView}
              onViewChange={setEnrollmentView}
              onCreateSection={(classId) => openCreate('sections', classId)}
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
      </>
    );
  }

  const rows = recordsByResource();
  const columns: TableColumn<AcademicsRow>[] = [
    { header: 'Name', render: (item) => <strong>{item.title}</strong> },
    { header: 'Details', render: (item) => item.details },
    {
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <span className="academics-row-actions">
          <Button onClick={() => beginEdit(item)} type="button" variant="quiet">
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
  ];

  return (
    <main className="page-stack academics-page">
      <WorkspacePageHeading
        eyebrow="Organization workspace"
        title="Academics"
        description="Set up academic calendars, class structures, subjects, and teacher assignments."
        aside={
          <Button onClick={beginCreate} type="button" variant="primary">
            Add {resourceNames[resource]}
          </Button>
        }
      />

      <nav aria-label="Academic management areas" className="academics-tabs">
        {tabs.map((tab) => (
          <button
            aria-current={resource === tab.resource ? 'page' : undefined}
            className={`academics-tab${resource === tab.resource ? ' academics-tab-active' : ''}`}
            key={tab.resource}
            onClick={() => {
              save.reset();
              remove.reset();
              setResource(tab.resource);
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="panel student-list-panel academics-panel">
        <div className="academics-panel-heading">
          <div>
            <h2>{selectedTab.label}</h2>
            <p>
              {rows.length} {rows.length === 1 ? 'record' : 'records'}
            </p>
          </div>
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
            emptyDescription={`Add the first ${selectedTab.label.toLowerCase()} record for this organization.`}
            emptyTitle={`No ${selectedTab.label.toLowerCase()} yet`}
            rowKey={(item) => item.id}
            rows={rows}
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
