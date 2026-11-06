import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { getAcademicYearSummary } from './academics-api.js';
import {
  listExams,
  listExamSchedules,
} from '../examinations/examinations-api.js';
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
} from './academics-api.js';
import { AcademicsForm } from './AcademicsForm.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { ClassEnrollmentPanel } from './ClassEnrollmentPanel.js';
import { ClassesSectionsReferenceView } from './ClassesSectionsReferenceView.js';
import { AcademicOverview } from './AcademicOverview.js';
import { AcademicTimetable } from './AcademicTimetable.js';
import { getAcademicsRosterPermissions } from './academics-permissions.js';
import { AcademicSessionsReferenceView } from './AcademicSessionsReferenceView.js';
import { AcademicSectionsReferenceView } from './AcademicSectionsReferenceView.js';
import { AcademicSubjectsReferenceView } from './AcademicSubjectsReferenceView.js';
import { useOrganizationSummary } from '../reporting/reporting-api.js';

const managerRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
];

const tabs: Array<{ resource: AcademicsResource; label: string }> = [
  { resource: 'academic-years', label: 'Sessions' },
  { resource: 'terms', label: 'Terms' },
  { resource: 'classes', label: 'Classes' },
  { resource: 'sections', label: 'Sections' },
  { resource: 'subjects', label: 'Subjects' },
];

const resourceNames: Record<AcademicsResource, string> = {
  'academic-years': 'session',
  terms: 'term',
  classes: 'class',
  sections: 'section',
  subjects: 'subject',
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
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const access = useOrganizationAccess(organizationId);
  const canReadAcademics =
    access.data?.permissions.includes('academics.read') ?? false;
  const canWriteAcademics =
    access.data?.permissions.includes('academics.write') ?? false;
  const canReadStaff = access.data?.permissions.includes('staff.read') ?? false;
  const { canReadStudents, canAddStudents } = getAcademicsRosterPermissions(
    access.data?.permissions ?? [],
  );
  const canCreateCampuses =
    access.data?.permissions.includes('campus.create') ?? false;
  const canManage =
    managerRoles.includes(access.data?.role ?? '') && canReadAcademics;
  const workspace = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canManage),
  );
  const sessionSummary = useQuery({
    queryKey: ['academics', organizationId, 'session-summary'],
    queryFn: () => getAcademicYearSummary(organizationId),
    enabled: Boolean(access.data && canManage),
    retry: false,
  });
  const organizationSummary = useOrganizationSummary(
    organizationId,
    undefined,
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
  const canWriteResource = canWriteAcademics;
  const [resourceSearch, setResourceSearch] = useState('');
  const [activeArea, setActiveArea] = useState<
    | 'overview'
    | 'academic-years'
    | 'terms'
    | 'classes'
    | 'sections'
    | 'subjects'
    | 'timetable'
  >('overview');
  useEffect(() => {
    const tabAreas: Record<string, typeof activeArea> = {
      'curriculum-sessions': 'academic-years',
      'curriculum-classes': 'classes',
      'curriculum-sections': 'sections',
      'curriculum-subjects': 'subjects',
      timetable: 'timetable',
    };
    const nextArea = requestedTab ? tabAreas[requestedTab] : undefined;
    if (nextArea) {
      setSubjectFormOpen(false);
      setEditing(undefined);
      setActiveArea(nextArea);
      if (nextArea !== 'timetable')
        setResource(
          nextArea === 'academic-years'
            ? 'academic-years'
            : nextArea === 'classes'
              ? 'classes'
              : nextArea === 'subjects'
                ? 'subjects'
                : nextArea === 'sections'
                  ? 'sections'
                  : 'classes',
        );
    } else if (!requestedTab) {
      setActiveArea('overview');
    }
  }, [requestedTab]);
  const [editing, setEditing] = useState<AcademicsRow>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [enrollmentView, setEnrollmentView] = useState<
    'students' | 'add-students'
  >('students');
  const [enrollmentFocusRequest] = useState(0);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [enrollmentSectionId, setEnrollmentSectionId] = useState<
    string | undefined
  >();
  const [enrollmentClassId, setEnrollmentClassId] = useState<
    string | undefined
  >();
  const activeAcademicYear =
    (workspace.years.data?.items ?? []).find(
      (item) => item.status === 'active',
    ) ?? (workspace.years.data?.items ?? [])[0];
  const subjectAssessments = useQuery({
    queryKey: [
      'academics',
      organizationId,
      'subject-assessments',
      activeAcademicYear?.id,
    ],
    enabled: Boolean(
      canManage && activeArea === 'subjects' && activeAcademicYear?.id,
    ),
    retry: false,
    queryFn: async () => {
      const exams = await listExams(organizationId);
      const sessionExams = exams.items.filter(
        (exam) => exam.academicYearId === activeAcademicYear?.id,
      );
      const schedules = await Promise.all(
        sessionExams.map((exam) => listExamSchedules(organizationId, exam.id)),
      );
      return schedules.flatMap((result) => result.items);
    },
  });
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
          (item: AcademicSubject) => row(item, item.name, item.code),
        );
    }
  };

  const activeQuery = {
    'academic-years': workspace.years,
    terms: workspace.terms,
    classes: workspace.classes,
    sections: workspace.sections,
    subjects: workspace.subjects,
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
            ['academic-years', 'Sessions'],
            ['terms', 'Terms'],
            ['classes', 'Classes & Sections'],
            ['subjects', 'Subjects'],
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
              setSubjectFormOpen(false);
              setEditing(undefined);
              setActiveArea(area);
              setResourceSearch('');
              // Returning to Classes & Sections must always open its overview,
              // never a previously opened student panel.
              setShowEnrollment(false);
              setEnrollmentSectionId(undefined);
              setEnrollmentClassId(undefined);
              setEnrollmentView('students');
              if (area === 'classes') setResource('classes');
              else if (
                area === 'academic-years' ||
                area === 'terms' ||
                area === 'subjects'
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
        <AcademicTimetable
          organizationId={organizationId}
          teachers={teacherCandidates.map(({ id, firstName, lastName }) => ({
            id,
            firstName,
            lastName,
          }))}
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

  if (activeArea === 'sections') {
    if (
      workspace.sections.isPending ||
      workspace.classes.isPending ||
      workspace.years.isPending ||
      sessionSummary.isPending
    )
      return <LoadingState message="Loading sections..." />;
    const failedQuery = [
      workspace.sections,
      workspace.classes,
      workspace.years,
      sessionSummary,
    ].find((query) => query.isError);
    if (failedQuery) {
      return (
        <ErrorState
          title="Sections unavailable"
          description={apiMessage(failedQuery.error)}
          onRetry={() => {
            void workspace.sections.refetch();
            void workspace.classes.refetch();
            void workspace.years.refetch();
            void sessionSummary.refetch();
          }}
        />
      );
    }
    const openSectionCreate = () => {
      if (!canWriteAcademics) return;
      save.reset();
      remove.reset();
      setResource('sections');
      setEditing(undefined);
      setNewSectionClassId(undefined);
      setDialogOpen(true);
    };
    const openSectionEdit = (section: AcademicSection) => {
      if (!canWriteAcademics) return;
      save.reset();
      setResource('sections');
      setNewSectionClassId(undefined);
      setEditing(
        row(section, section.name, classNames.get(section.classId) ?? 'Class'),
      );
      setDialogOpen(true);
    };
    const deleteSection = (section: AcademicSection) => {
      if (!canWriteAcademics || !window.confirm('Delete ' + section.name + '?'))
        return;
      remove.mutate({ resource: 'sections', id: section.id });
    };
    return (
      <>
        <AcademicSectionsReferenceView
          sections={workspace.sections.data?.items ?? []}
          classes={workspace.classes.data?.items ?? []}
          sessions={workspace.years.data?.items ?? []}
          summary={
            sessionSummary.data?.summary ?? {
              totals: { classes: 0, sections: 0, students: 0 },
              bySession: [],
              bySection: [],
            }
          }
          canWrite={canWriteAcademics}
          onCreate={openSectionCreate}
          onEdit={openSectionEdit}
          onDelete={deleteSection}
        />
        {(save.isError || remove.isError) && (
          <p className="form-error" role="alert">
            {apiMessage(save.error ?? remove.error)}
          </p>
        )}
        <Dialog
          description="Create or update a section in the selected class."
          onOpenChange={setDialogOpen}
          open={dialogOpen && resource === 'sections'}
          title={editing ? 'Edit section' : 'Add section'}
        >
          <AcademicsForm
            choices={choices}
            isSaving={save.isPending}
            onSubmit={saveRecord}
            record={editing?.values}
            resource="sections"
            saveError={save.error ? apiMessage(save.error) : undefined}
          />
        </Dialog>
      </>
    );
  }

  if (activeArea === 'classes') {
    const classWorkspaceQueries = [
      { label: 'classes', query: workspace.classes },
      { label: 'sections', query: workspace.sections },
      { label: 'sessions', query: workspace.years },
      { label: 'campuses', query: workspace.campuses },
      { label: 'subjects', query: workspace.subjects },
    ];
    const failedClassQuery = classWorkspaceQueries.find(
      ({ query }) => query.isError,
    );
    if (classWorkspaceQueries.some(({ query }) => query.isPending)) {
      return (
        <main className="page-stack academics-page">
          <LoadingState message="Loading classes, sections and academic records…" />
        </main>
      );
    }
    if (failedClassQuery) {
      return (
        <main className="page-stack academics-page">
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
        <ClassesSectionsReferenceView
          classes={workspace.classes.data?.items ?? []}
          sections={workspace.sections.data?.items ?? []}
          years={workspace.years.data?.items ?? []}
          campuses={workspace.campuses.data?.campuses ?? []}
          subjects={workspace.subjects.data?.items ?? []}
          studentsCount={organizationSummary.data?.summary.activeStudentCount}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={deleteAcademicRecord}
          canWriteAcademics={canWriteAcademics}
          canCreateCampuses={canCreateCampuses}
          onOpenCampusSetup={() =>
            navigate(
              '/admin/organizations/' +
                encodeURIComponent(organizationId) +
                '?tab=campuses',
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
                <strong>Student Management</strong>
                <p>
                  View enrolled students, search the roster, add students, or
                  remove selected students.
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
              initialSectionId={enrollmentSectionId}
              initialClassId={enrollmentClassId}
              initialView={enrollmentView}
              focusRequest={enrollmentFocusRequest}
              onViewChange={setEnrollmentView}
              canReadStudents={canReadStudents}
              canAddStudents={canAddStudents}
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

  if (activeArea === 'subjects') {
    if (
      workspace.subjects.isPending ||
      workspace.classes.isPending ||
      subjectAssessments.isPending
    ) {
      return <LoadingState message="Loading subjects..." />;
    }
    if (
      workspace.subjects.isError ||
      workspace.classes.isError ||
      subjectAssessments.isError
    ) {
      const failed = workspace.subjects.isError
        ? workspace.subjects
        : workspace.classes.isError
          ? workspace.classes
          : subjectAssessments;
      return (
        <ErrorState
          title="Could not load subjects"
          description={apiMessage(failed.error)}
          onRetry={() => {
            void workspace.subjects.refetch();
            void workspace.classes.refetch();
            void subjectAssessments.refetch();
          }}
        />
      );
    }
    const openSubjectCreate = () => {
      if (!canWriteAcademics) return;
      save.reset();
      setEditing(undefined);
      setSubjectFormOpen(true);
    };
    const openSubjectEdit = (subject: AcademicSubject) => {
      if (!canWriteAcademics) return;
      save.reset();
      setEditing(row(subject, subject.name, subject.code));
      setSubjectFormOpen(true);
    };
    const deleteSubject = (subject: AcademicSubject) => {
      if (!canWriteAcademics || !window.confirm('Delete ' + subject.name + '?'))
        return;
      remove.mutate({ resource: 'subjects', id: subject.id });
    };
    const subjectFormRecord = editing?.values;
    return subjectFormOpen ? (
      <main className="page-stack academic-subject-form-page">
        <WorkspacePageHeading
          eyebrow="Curriculum"
          title={editing ? 'Edit Subject' : 'Add Subject'}
          description={
            editing
              ? 'Update subject information'
              : 'Add a new subject to your curriculum'
          }
        />
        <section
          className="academic-subject-form-card"
          aria-labelledby="subject-information-title"
        >
          <header>
            <h2 id="subject-information-title">Subject Information</h2>
            <p>
              {editing
                ? 'Update the details for this subject'
                : 'Enter the details for this subject'}
            </p>
          </header>
          <AcademicsForm
            choices={choices}
            isSaving={save.isPending}
            onCancel={() => {
              setSubjectFormOpen(false);
              setEditing(undefined);
              save.reset();
            }}
            onSubmit={(input) =>
              save.mutate(
                { resource: 'subjects', id: editing?.id, data: input },
                {
                  onSuccess: () => {
                    setSubjectFormOpen(false);
                    setEditing(undefined);
                  },
                },
              )
            }
            record={subjectFormRecord}
            resource="subjects"
            saveError={save.error ? apiMessage(save.error) : undefined}
          />
        </section>
      </main>
    ) : (
      <>
        <AcademicSubjectsReferenceView
          subjects={workspace.subjects.data?.items ?? []}
          classes={workspace.classes.data?.items ?? []}
          schedules={subjectAssessments.data ?? []}
          canWrite={canWriteAcademics}
          onCreate={openSubjectCreate}
          onEdit={openSubjectEdit}
          onDelete={deleteSubject}
        />
        {(save.isError || remove.isError) && (
          <p className="form-error" role="alert">
            {apiMessage(save.error ?? remove.error)}
          </p>
        )}
      </>
    );
  }

  if (activeArea === 'academic-years') {
    if (workspace.years.isPending || sessionSummary.isPending) {
      return <LoadingState message="Loading sessions..." />;
    }
    if (workspace.years.isError || sessionSummary.isError) {
      return (
        <ErrorState
          title="Sessions unavailable"
          description={apiMessage(
            workspace.years.error ?? sessionSummary.error,
          )}
          onRetry={() => {
            void workspace.years.refetch();
            void sessionSummary.refetch();
          }}
        />
      );
    }
    return (
      <>
        <AcademicSessionsReferenceView
          sessions={workspace.years.data?.items ?? []}
          summary={
            sessionSummary.data?.summary ?? {
              totals: { classes: 0, sections: 0, students: 0 },
              bySession: [],
              bySection: [],
            }
          }
          canWrite={canWriteResource}
          onCreate={beginCreate}
          onEdit={(session) =>
            beginEdit(
              row(
                session,
                session.name,
                `${session.startDate} – ${session.endDate} · ${session.status}`,
              ),
            )
          }
          onDelete={(session) =>
            deleteRecord(
              row(
                session,
                session.name,
                `${session.startDate} – ${session.endDate} · ${session.status}`,
              ),
            )
          }
        />
        {(save.isError || remove.isError) && (
          <p className="form-error" role="alert">
            {apiMessage(save.error ?? remove.error)}
          </p>
        )}
        <Dialog
          description={`${editing ? 'Update' : 'Create'} session for this organization.`}
          onOpenChange={(open) => setDialogOpen(open)}
          open={dialogOpen}
          title={`${editing ? 'Edit' : 'Add'} session`}
        >
          <AcademicsForm
            choices={choices}
            isSaving={save.isPending}
            onSubmit={saveRecord}
            record={editing?.values}
            resource="academic-years"
            saveError={save.error ? apiMessage(save.error) : undefined}
          />
        </Dialog>
      </>
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
        description="Set up academic sessions, classes, sections, subjects, and timetables."
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
                ? `No ${resourceNames[resource]} matches "${resourceSearch.trim()}". Try another search.`
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
