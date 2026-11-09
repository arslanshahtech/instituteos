import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Layers,
  Pencil,
  Settings,
  Trash2,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';
import {
  listAcademicClasses,
  listAcademicSections,
  listAcademicYears,
} from '../academics/academics-api.js';
import { placeStudent } from '../attendance/attendance-api.js';
import {
  WorkspacePageHeading,
  WorkspaceSearchField,
  WorkspaceFilterSelect,
  WorkspaceModuleSection,
  WorkspaceModuleToolbar,
} from '../components/ui/WorkspacePrimitives.js';
import { ApiError } from '../api/client.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Pagination } from '../components/ui/Pagination.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getCampuses } from '../organizations/organizations-api.js';
import type { Campus } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { OrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { listInvoices } from '../finance/finance-api.js';
import type { StudentInvoice } from '../finance/finance-api.js';
import {
  useSetStudentPreviousDues,
  useStudentFeeLedger,
} from '../finance/finance-queries.js';
import { StudentForm } from './StudentForm.js';
import { ChildPickupPanel } from './ChildPickupPanel.js';
import { StudentFamilyContactsSection } from '../families/FamilyContactsPages.js';
import {
  getFamilyContact,
  listStudentFamilyContacts,
} from '../families/family-contacts-api.js';
import {
  getStudentExamReport,
  listExams,
} from '../examinations/examinations-api.js';
import {
  listStudentAttendance,
  removeStudentFromSection,
} from '../attendance/attendance-api.js';
import { listStudents, updateStudent } from './students-api.js';
import type {
  StudentInput,
  StudentStatus,
  StudentRecord,
} from './students-api.js';
import { getStudentSummary, listStudentPlacements } from './students-api.js';
import {
  useCreateStudent,
  useStudent,
  useStudents,
  useUpdateStudent,
} from './student-queries.js';

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_STUDENTS = 10_000;

function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  // Prevent spreadsheet formula execution when staff opens exported CSV files.
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function studentCsv(students: StudentRecord[]): string {
  const columns: Array<[string, (student: StudentRecord) => unknown]> = [
    ['First name', (student) => student.firstName],
    ['Last name', (student) => student.lastName],
    ['Registration number', (student) => student.registrationNumber],
    ['Parent mobile', (student) => student.parentMobile],
    ['Preferred name', (student) => student.preferredName],
    ['Date of birth', (student) => student.dateOfBirth?.slice(0, 10)],
    ['Gender', (student) => student.gender],
    ['Email', (student) => student.contactEmail],
    ['Phone', (student) => student.phone],
    ['Status', (student) => student.status],
  ];
  return [
    columns.map(([label]) => csvCell(label)).join(','),
    ...students.map((student) =>
      columns.map(([, getValue]) => csvCell(getValue(student))).join(','),
    ),
  ].join('\r\n');
}

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The request could not be completed. Try again.';
}

function useOrganizationAccess(organizationId: string) {
  return useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 30_000,
  });
}

function useCampusChoices(
  organizationId: string,
  access?: OrganizationAccessContext,
) {
  return useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(access?.permissions.includes('campus.read')),
    retry: false,
  });
}

function AccessState({
  loading,
  error,
  access,
  requiredPermission,
  children,
  onRetry,
}: {
  loading: boolean;
  error: Error | null;
  access?: OrganizationAccessContext;
  requiredPermission: string;
  children: ReactNode;
  onRetry: () => void;
}) {
  if (loading) return <LoadingState message="Checking student access…" />;
  if (error || !access)
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          error
            ? apiMessage(error)
            : 'Student access could not be verified for this organization.'
        }
        onRetry={onRetry}
      />
    );
  if (!access.permissions.includes(requiredPermission))
    return <PermissionDeniedState />;
  return children;
}

function StudentPageHeading({
  title,
  description,
  organizationId,
  action,
  referenceLayout = false,
}: {
  title: string;
  description: string;
  organizationId: string;
  action?: ReactNode;
  referenceLayout?: boolean;
}) {
  return (
    <WorkspacePageHeading
      className="student-page-heading"
      eyebrow={
        referenceLayout
          ? 'College admin · Layout preview'
          : 'Organization workspace'
      }
      title={title}
      description={description}
      aside={
        referenceLayout ? (
          action
        ) : (
          <div className="student-page-actions">
            <Link
              className="button button-secondary"
              to={`/admin/organizations/${encodeURIComponent(organizationId)}/students`}
            >
              Student list
            </Link>
            {action}
          </div>
        )
      }
    />
  );
}

function StudentCampusName({
  campusId,
  campuses,
}: {
  campusId?: string;
  campuses: Campus[];
}) {
  if (!campusId) return <>—</>;
  return (
    <>
      {campuses.find((campus) => campus.id === campusId)?.name ??
        'Assigned campus'}
    </>
  );
}

export function StudentsListPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StudentStatus | ''>('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isRegistrationSettingsOpen, setIsRegistrationSettingsOpen] =
    useState(false);
  const [registrationPopoverPosition, setRegistrationPopoverPosition] =
    useState({ top: 0, left: 0 });
  const [registrationPrefix, setRegistrationPrefix] = useState('REG');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const students = useStudents(
    organizationId,
    {
      search,
      status: status || undefined,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    Boolean(access.data?.permissions.includes('student.read')),
  );
  const summary = useQuery({
    queryKey: ['student-summary', organizationId],
    queryFn: () => getStudentSummary(organizationId),
    enabled: Boolean(access.data?.permissions.includes('student.read')),
    retry: false,
  });
  const academicClasses = useQuery({
    queryKey: ['academics', organizationId, 'classes'],
    queryFn: () => listAcademicClasses(organizationId),
    enabled: Boolean(
      access.data?.permissions.includes('academics.read') ||
      access.data?.permissions.includes('academics.write'),
    ),
    retry: false,
  });
  const academicSections = useQuery({
    queryKey: ['academics', organizationId, 'sections'],
    queryFn: () => listAcademicSections(organizationId),
    enabled: Boolean(
      access.data?.permissions.includes('academics.read') ||
      access.data?.permissions.includes('academics.write'),
    ),
    retry: false,
  });
  const academicYears = useQuery({
    queryKey: ['academics', organizationId, 'years'],
    queryFn: () => listAcademicYears(organizationId),
    enabled: Boolean(
      access.data?.permissions.includes('academics.read') ||
      access.data?.permissions.includes('academics.write'),
    ),
    retry: false,
  });
  const visibleStudentIds = (students.data?.items ?? []).map(
    (student) => student.id,
  );
  const placements = useQuery({
    queryKey: ['student-placements', organizationId, visibleStudentIds],
    queryFn: () => listStudentPlacements(organizationId, visibleStudentIds),
    enabled: Boolean(
      access.data?.permissions.includes('student.read') &&
      visibleStudentIds.length,
    ),
    retry: false,
  });
  const placementByStudent = new Map(
    (placements.data?.items ?? []).map((placement) => [
      placement.studentId,
      placement,
    ]),
  );
  const canCreate =
    access.data?.permissions.includes('student.create') ?? false;
  const canUpdate =
    access.data?.permissions.includes('student.update') ?? false;
  const exportStudents = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const firstPage = await listStudents(organizationId, {
        search: search || undefined,
        status: status || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
      });
      if (firstPage.total > MAX_EXPORT_STUDENTS) {
        showToast(
          `Export is limited to ${MAX_EXPORT_STUDENTS.toLocaleString()} matching students. Narrow the search and try again.`,
          'info',
        );
        return;
      }
      const allStudents = [...firstPage.items];
      for (
        let currentPage = 2;
        currentPage <= Math.ceil(firstPage.total / EXPORT_PAGE_SIZE);
        currentPage += 1
      ) {
        const result = await listStudents(organizationId, {
          search: search || undefined,
          status: status || undefined,
          classId: classId || undefined,
          sectionId: sectionId || undefined,
          page: currentPage,
          pageSize: EXPORT_PAGE_SIZE,
        });
        allStudents.push(...result.items);
      }
      const blob = new Blob([`\uFEFF${studentCsv(allStudents)}`], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported ${allStudents.length} student record(s).`);
    } catch (error) {
      showToast(apiMessage(error), 'info');
    } finally {
      setIsExporting(false);
    }
  };
  const withdrawStudent = async (student: StudentRecord) => {
    const fullName = `${student.firstName} ${student.lastName}`;
    if (
      !window.confirm(
        `Withdraw ${fullName}? The student will remain in historical records; this does not permanently erase academic or fee data.`,
      )
    )
      return;
    try {
      await updateStudent(organizationId, student.id, {
        firstName: student.firstName,
        lastName: student.lastName,
        preferredName: student.preferredName,
        registrationNumber: student.registrationNumber,
        fatherName: student.fatherName,
        motherName: student.motherName,
        parentMobile: student.parentMobile,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        contactEmail: student.contactEmail,
        phone: student.phone,
        campusId: student.campusId,
        nationality: student.nationality,
        religion: student.religion,
        birthPlace: student.birthPlace,
        nationalId: student.nationalId,
        specialNeeds: student.specialNeeds,
        status: 'withdrawn',
      });
      await students.refetch();
      showToast(`${fullName} marked as withdrawn.`);
    } catch (error) {
      showToast(apiMessage(error), 'info');
    }
  };
  const canReadFinance =
    access.data?.permissions.includes('finance.read') ?? false;
  const invoices = useQuery({
    queryKey: ['finance', organizationId, 'student-directory-invoices'],
    queryFn: () => listInvoices(organizationId),
    enabled: Boolean(access.data && canReadFinance),
    retry: false,
  });
  const canReadAttendance =
    access.data?.permissions.includes('attendance.read') ?? false;
  const attendance = useQuery({
    queryKey: ['attendance', organizationId, 'student-directory-summary'],
    queryFn: () => {
      const dateTo = new Date();
      const dateFrom = new Date(dateTo);
      dateFrom.setDate(dateTo.getDate() - 89);
      return listStudentAttendance(organizationId, {
        dateFrom: dateFrom.toISOString().slice(0, 10),
        dateTo: dateTo.toISOString().slice(0, 10),
      });
    },
    enabled: Boolean(access.data && canReadAttendance),
    retry: false,
    staleTime: 60_000,
  });
  const attendanceByStudent = new Map<
    string,
    { attended: number; recorded: number }
  >();
  for (const record of attendance.data?.items ?? []) {
    const counts = attendanceByStudent.get(record.studentId) ?? {
      attended: 0,
      recorded: 0,
    };
    if (record.status !== 'leave') {
      counts.recorded += 1;
      if (record.status === 'present' || record.status === 'late')
        counts.attended += 1;
    }
    attendanceByStudent.set(record.studentId, counts);
  }
  const invoicesByStudent = new Map<string, StudentInvoice[]>();
  for (const invoice of invoices.data?.items ?? []) {
    const current = invoicesByStudent.get(invoice.studentId) ?? [];
    current.push(invoice);
    invoicesByStudent.set(invoice.studentId, current);
  }
  const visibleFamilyContactIds = Array.from(
    new Set(
      (students.data?.items ?? []).flatMap((student) => student.guardianIds),
    ),
  );
  const guardianDetailsQueries = useQueries({
    queries: visibleFamilyContactIds.map((guardianId) => ({
      queryKey: ['family-contact-detail', organizationId, guardianId],
      queryFn: () => getFamilyContact(organizationId, guardianId),
      enabled: Boolean(access.data?.permissions.includes('guardian.read')),
      staleTime: 60_000,
    })),
  });
  const primaryFamilyContactByStudent = new Map<
    string,
    { name: string; phone?: string }
  >();
  for (const guardianQuery of guardianDetailsQueries) {
    const detail = guardianQuery.data;
    if (!detail) continue;
    for (const relation of detail.students) {
      const guardianName = `${detail.guardian.firstName} ${detail.guardian.lastName}`;
      if (
        !primaryFamilyContactByStudent.has(relation.student.id) ||
        relation.isPrimary
      ) {
        primaryFamilyContactByStudent.set(relation.student.id, {
          name: guardianName,
          phone: detail.guardian.phone,
        });
      }
    }
  }

  return (
    <AccessState
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="student.read"
    >
      <main className="page-stack student-management-page reference-live-module">
        <StudentPageHeading
          action={
            canCreate ? (
              <div className="student-page-actions student-reference-actions">
                <div className="student-reg-settings-anchor">
                  <button
                    aria-expanded={isRegistrationSettingsOpen}
                    aria-haspopup="dialog"
                    className="button button-secondary"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const width = Math.min(420, window.innerWidth - 32);
                      const estimatedHeight = 410;
                      const left = Math.max(
                        16,
                        Math.min(
                          rect.right - width,
                          window.innerWidth - width - 16,
                        ),
                      );
                      const top =
                        rect.bottom + estimatedHeight + 12 <= window.innerHeight
                          ? rect.bottom + 10
                          : Math.max(16, rect.top - estimatedHeight - 10);
                      setRegistrationPopoverPosition({ top, left });
                      setIsRegistrationSettingsOpen((open) => !open);
                    }}
                    type="button"
                  >
                    <Settings size={15} /> Reg-No Settings
                  </button>
                  {isRegistrationSettingsOpen &&
                    createPortal(
                      <section
                        aria-labelledby="student-reg-settings-title"
                        className="student-reg-settings"
                        role="dialog"
                        style={{
                          top: registrationPopoverPosition.top,
                          left: registrationPopoverPosition.left,
                        }}
                      >
                        <header className="student-reg-settings-header">
                          <span className="student-reg-settings-icon">
                            <Settings size={18} />
                          </span>
                          <div>
                            <h2 id="student-reg-settings-title">
                              Registration number settings
                            </h2>
                            <p>
                              Set the prefix used for automatically generated
                              student registration numbers.
                            </p>
                          </div>
                          <button
                            aria-label="Close registration settings"
                            className="student-reg-settings-close"
                            onClick={() => setIsRegistrationSettingsOpen(false)}
                            type="button"
                          >
                            ×
                          </button>
                        </header>
                        <div className="student-reg-settings-body">
                          <label
                            className="student-reg-settings-label"
                            htmlFor="student-reg-prefix"
                          >
                            Registration prefix
                          </label>
                          <input
                            autoComplete="off"
                            className="student-reg-prefix-input"
                            id="student-reg-prefix"
                            maxLength={8}
                            onChange={(event) =>
                              setRegistrationPrefix(
                                event.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, ''),
                              )
                            }
                            placeholder="REG"
                            value={registrationPrefix}
                          />
                          <div className="student-reg-preview">
                            <span className="student-reg-preview-label">
                              NUMBER FORMAT PREVIEW
                            </span>
                            <strong>
                              {registrationPrefix || 'REG'}-
                              {new Date().getFullYear()}-0001
                            </strong>
                            <small>
                              Year and running counter are managed
                              automatically.
                            </small>
                          </div>
                          <p className="student-reg-settings-note">
                            The current counter is not connected to this screen
                            yet. Saving a prefix will be enabled after
                            registration-number settings are supported by the
                            organization settings API.
                          </p>
                        </div>
                        <footer className="student-reg-settings-footer">
                          <button
                            className="button button-secondary"
                            onClick={() => {
                              setRegistrationPrefix('REG');
                              setIsRegistrationSettingsOpen(false);
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="button button-primary"
                            disabled
                            title="Registration prefix persistence is not available yet"
                            type="button"
                          >
                            Save changes
                          </button>
                        </footer>
                      </section>,
                      document.body,
                    )}
                </div>
                <Link
                  className="button button-secondary"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/import`}
                >
                  <Upload size={15} /> Bulk Upload
                </Link>
                <Link
                  className="button button-primary"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/admissions/enroll`}
                >
                  <Users size={15} /> Enroll Student
                </Link>
              </div>
            ) : undefined
          }
          description="Manage all students in your institute"
          organizationId={organizationId}
          referenceLayout
          title="Students"
        />

        <section
          className="student-summary-grid"
          aria-label="Student overview statistics"
        >
          <article>
            <span>STUDENTS</span>
            <strong>
              {summary.data?.summary.total.toLocaleString('en-PK') ?? '—'}
            </strong>
            <small>Registered student records</small>
            <span className="student-summary-icon">
              <Users size={18} />
            </span>
          </article>
          <article>
            <span>CLASSES</span>
            <strong>
              {academicClasses.data?.items.length.toLocaleString('en-PK') ??
                '—'}
            </strong>
            <small>In current session</small>
            <span className="student-summary-icon">
              <BookOpen size={18} />
            </span>
          </article>
          <article>
            <span>SECTIONS</span>
            <strong>
              {academicSections.data?.items.length.toLocaleString('en-PK') ??
                '—'}
            </strong>
            <small>In current session</small>
            <span className="student-summary-icon">
              <Layers size={18} />
            </span>
          </article>
          <article>
            <span>SESSIONS</span>
            <strong>
              {academicYears.data?.items.length.toLocaleString('en-PK') ?? '—'}
            </strong>
            <small>Academic year periods</small>
            <span className="student-summary-icon">
              <CalendarDays size={18} />
            </span>
          </article>
        </section>
        <WorkspaceModuleSection className="student-filter-panel panel">
          <WorkspaceModuleToolbar className="student-filters">
            <WorkspaceSearchField
              label="Search students"
              onChange={setSearchInput}
              placeholder="Search by name or ID..."
              value={searchInput}
            />
            <WorkspaceFilterSelect
              label="Class"
              value={classId}
              onChange={(value) => {
                setClassId(value);
                setSectionId('');
                setPage(1);
              }}
              options={[
                { value: '', label: 'All classes' },
                ...(academicClasses.data?.items ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
            <WorkspaceFilterSelect
              label="Section"
              value={sectionId}
              disabled={!classId}
              onChange={(value) => {
                setSectionId(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All sections' },
                ...(academicSections.data?.items ?? [])
                  .filter((item) => item.classId === classId)
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <WorkspaceFilterSelect
              label="Student status"
              onChange={(value) => {
                setStatus(value as StudentStatus | '');
                setPage(1);
              }}
              options={[
                { value: 'active', label: 'Active' },
                { value: '', label: 'All statuses' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'withdrawn', label: 'Withdrawn' },
              ]}
              value={status}
            />
          </WorkspaceModuleToolbar>
        </WorkspaceModuleSection>
        <WorkspaceModuleSection className="student-directory-panel panel">
          <div className="student-directory-heading">
            <h2>
              All Students (
              {students.data?.total.toLocaleString('en-PK') ?? '—'})
            </h2>
            <div className="student-export-actions">
              <button
                className="button button-secondary"
                disabled={isExporting || !students.data?.total}
                onClick={() => void exportStudents()}
                type="button"
              >
                <Download size={14} /> {isExporting ? 'Exporting…' : 'CSV'}
              </button>
              <button
                className="button button-secondary"
                disabled={!students.data?.total}
                onClick={() => window.print()}
                type="button"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
          {students.isPending ? (
            <LoadingState message="Loading students…" />
          ) : students.isError ? (
            <ErrorState
              title="Students unavailable"
              description={apiMessage(students.error)}
              onRetry={() => void students.refetch()}
            />
          ) : (
            <>
              {students.data.items.length === 0 ? (
                <DataTable
                  caption="Students"
                  columns={[
                    {
                      header: 'Student',
                      render: (student) => (
                        <Link
                          className="student-name-link"
                          to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`}
                        >
                          {student.firstName} {student.lastName}
                        </Link>
                      ),
                    },
                  ]}
                  emptyDescription={
                    search || status || classId || sectionId
                      ? 'Try changing or clearing your search and filters.'
                      : 'Create the first student record for this organization.'
                  }
                  emptyTitle={
                    search || status || classId || sectionId
                      ? 'No students match these filters'
                      : 'No students yet'
                  }
                  rowKey={(student) => student.id}
                  rows={students.data.items}
                />
              ) : (
                <DataTable
                  caption="Student directory"
                  wrapperClassName="student-reference-table"
                  columns={[
                    {
                      header: 'Select',
                      headerRender: () => (
                        <input
                          aria-label="Select all students on this page"
                          checked={
                            students.data.items.length > 0 &&
                            students.data.items.every((student) =>
                              selectedStudentIds.includes(student.id),
                            )
                          }
                          onChange={(event) => {
                            const visibleIds = students.data.items.map(
                              (student) => student.id,
                            );
                            setSelectedStudentIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, ...visibleIds])]
                                : current.filter(
                                    (id) => !visibleIds.includes(id),
                                  ),
                            );
                          }}
                          type="checkbox"
                        />
                      ),
                      render: (student) => (
                        <input
                          aria-label={`Select ${student.firstName} ${student.lastName}`}
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={(event) =>
                            setSelectedStudentIds((current) =>
                              event.target.checked
                                ? [...current, student.id]
                                : current.filter((id) => id !== student.id),
                            )
                          }
                          type="checkbox"
                        />
                      ),
                    },
                    {
                      header: 'Student',
                      render: (student) => (
                        <div className="student-table-person">
                          <span className="student-avatar">
                            <UserRound size={19} />
                          </span>
                          <div className="student-table-identity">
                            <Link
                              className="student-name-link"
                              to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`}
                            >
                              {student.firstName} {student.lastName}
                            </Link>
                            <small>
                              {student.registrationNumber ??
                                'Registration pending'}
                            </small>
                          </div>
                        </div>
                      ),
                    },
                    {
                      header: 'Parent',
                      render: (student) => {
                        const parent = primaryFamilyContactByStudent.get(
                          student.id,
                        );
                        return (
                          <div className="student-table-identity">
                            <strong>
                              {parent?.name ??
                                (student.guardianIds.length
                                  ? `${student.guardianIds.length} linked guardians`
                                  : 'Not linked')}
                            </strong>
                            <small>
                              {parent?.phone ?? student.parentMobile ?? '—'}
                            </small>
                          </div>
                        );
                      },
                    },
                    {
                      header: 'Family #',
                      render: (student) => (
                        <span className="student-family-number">
                          {placementByStudent.get(student.id)?.familyNumber ??
                            '—'}
                        </span>
                      ),
                    },
                    {
                      header: 'Class / Section',
                      render: (student) => {
                        const placement = placementByStudent.get(student.id);
                        return (
                          <div className="student-table-identity">
                            <strong>
                              {placement?.className ?? 'Not assigned'}
                            </strong>
                            <small>
                              {placement?.sectionName ?? 'No section'}
                            </small>
                          </div>
                        );
                      },
                    },
                    {
                      header: 'Monthly fee',
                      render: (student) => {
                        const amount =
                          placementByStudent.get(student.id)?.monthlyFee ?? 0;
                        return (
                          <span className="student-monthly-fee">
                            {amount
                              ? `PKR ${amount.toLocaleString('en-PK')}`
                              : '—'}
                          </span>
                        );
                      },
                    },
                    {
                      header: 'Actions',
                      render: (student) => (
                        <div className="student-row-actions">
                          <Link
                            aria-label={`View ${student.firstName} ${student.lastName}`}
                            title="View student"
                            to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`}
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            aria-label={`Edit ${student.firstName} ${student.lastName}`}
                            title="Edit student"
                            to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}/edit`}
                          >
                            <Pencil size={16} />
                          </Link>
                          <button
                            aria-label={`Withdraw ${student.firstName} ${student.lastName}`}
                            disabled={!canUpdate}
                            onClick={() => void withdrawStudent(student)}
                            title="Withdraw student and preserve academic, attendance and fee history"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  rowKey={(student) => student.id}
                  rows={students.data.items}
                  emptyTitle="No students yet"
                  emptyDescription="Create the first student record for this organization."
                />
              )}
              <Pagination
                currentPage={students.data.page}
                onPageChange={setPage}
                pageSize={students.data.pageSize}
                totalItems={students.data.total}
              />
            </>
          )}
        </WorkspaceModuleSection>
      </main>
    </AccessState>
  );
}

export function StudentCreatePage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const mutation = useCreateStudent(organizationId);
  const { showToast } = useToast();

  const submit = (input: StudentInput) => {
    mutation.mutate(input, {
      onSuccess: ({ student }) => {
        showToast('Student created successfully.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`,
        );
      },
    });
  };

  return (
    <AccessState
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="student.create"
    >
      <main className="page-stack student-management-page reference-live-module">
        <StudentPageHeading
          description="Add a student record to this organization."
          organizationId={organizationId}
          title="Add student"
        />
        <section className="student-form-panel panel">
          <StudentForm
            campusError={
              campuses.isError ? apiMessage(campuses.error) : undefined
            }
            campuses={campuses.data?.campuses ?? []}
            canAssignCampus={
              access.data?.permissions.includes('campus.read') ?? false
            }
            campusRequired={access.data?.role === 'campus_admin'}
            isSaving={mutation.isPending}
            onSubmit={submit}
            saveError={
              mutation.isError ? apiMessage(mutation.error) : undefined
            }
          />
        </section>
      </main>
    </AccessState>
  );
}

function StudentPreviousDuesSection({
  organizationId,
  studentId,
  canWrite,
}: {
  organizationId: string;
  studentId: string;
  canWrite: boolean;
}) {
  const [duesInput, setDuesInput] = useState('');
  const [duesMessage, setDuesMessage] = useState<string | null>(null);
  const ledger = useStudentFeeLedger(organizationId, studentId);
  const setPreviousDues = useSetStudentPreviousDues(organizationId);

  useEffect(() => {
    if (ledger.data) {
      setDuesInput(String(ledger.data.previousDues ?? 0));
    }
  }, [ledger.data]);

  const formatMoney = (val: number) =>
    `Rs. ${Number(val || 0).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <section className="student-detail-panel panel">
      <div className="student-detail-heading">
        <h2>Fee dues</h2>
      </div>
      {ledger.isPending ? (
        <LoadingState message="Loading fee duesâ€¦" />
      ) : ledger.isError || !ledger.data ? (
        <p role="alert" style={{ color: '#b91c1c' }}>
          Fee dues could not be loaded for this student.
        </p>
      ) : (
        <>
          <dl className="student-details">
            <div>
              <dt>Previous dues (pehla baqaya)</dt>
              <dd>{formatMoney(ledger.data.previousDues ?? 0)}</dd>
            </div>
            <div>
              <dt>Total outstanding (kul baqaya)</dt>
              <dd>{formatMoney(ledger.data.outstandingBalance)}</dd>
            </div>
          </dl>
          <p>
            Previous dues agli nayi invoice me shamil honge. Invoice banne ke
            baad baqaya us invoice me rehta hai jab tak poori payment na ho
            jaye. Invoice delete hone par bacha hua baqaya wapas previous dues
            me aa jata hai.
          </p>
          {canWrite && (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const amount = Number(duesInput);
                if (!Number.isFinite(amount) || amount < 0) {
                  setDuesMessage('Enter a valid amount of zero or more.');
                  return;
                }
                try {
                  await setPreviousDues.mutateAsync({ studentId, amount });
                  setDuesMessage('Previous dues saved.');
                } catch {
                  setDuesMessage('Could not save previous dues.');
                }
              }}
              style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                marginTop: '1rem',
              }}
            >
              <label>
                Previous dues (Rs.){' '}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={duesInput}
                  onChange={(event) => setDuesInput(event.target.value)}
                  style={{
                    padding: '0.4rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                  }}
                />
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={setPreviousDues.isPending}
              >
                Save previous dues
              </button>
              {duesMessage && <span role="status">{duesMessage}</span>}
            </form>
          )}
        </>
      )}
    </section>
  );
}

export function StudentDetailPage() {
  const { organizationId = '', studentId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const student = useStudent(
    organizationId,
    studentId,
    Boolean(access.data?.permissions.includes('student.read')),
  );
  const campuses = useCampusChoices(organizationId, access.data);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'fees'
    | 'attendance'
    | 'results'
    | 'documents'
    | 'behaviour'
    | 'history'
  >('overview');
  const [changeClassOpen, setChangeClassOpen] = useState(false);
  const [movementType, setMovementType] = useState('Promote');
  const [targetClassId, setTargetClassId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [targetYearId, setTargetYearId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [movementReason, setMovementReason] = useState('');
  const [changingClass, setChangingClass] = useState(false);
  const [markingLeft, setMarkingLeft] = useState(false);
  const { showToast } = useToast();
  const classesQuery = useQuery({
    queryKey: ['student-profile-classes', organizationId],
    queryFn: () => listAcademicClasses(organizationId),
    enabled: changeClassOpen,
    retry: false,
  });
  const sectionsQuery = useQuery({
    queryKey: ['student-profile-sections', organizationId],
    queryFn: () => listAcademicSections(organizationId),
    enabled: changeClassOpen,
    retry: false,
  });
  const yearsQuery = useQuery({
    queryKey: ['student-profile-years', organizationId],
    queryFn: () => listAcademicYears(organizationId),
    enabled: changeClassOpen,
    retry: false,
  });
  const canReadFinance =
    access.data?.permissions.includes('finance.read') ?? false;
  const canReadAttendance =
    access.data?.permissions.includes('attendance.read') ?? false;
  const canReadExams =
    access.data?.permissions.includes('examination.read') ?? false;
  const placementQuery = useQuery({
    queryKey: ['student-placements', organizationId, studentId],
    queryFn: () => listStudentPlacements(organizationId, [studentId]),
    enabled: Boolean(
      access.data?.permissions.includes('student.read') && studentId,
    ),
    retry: false,
  });
  const invoiceQuery = useQuery({
    queryKey: ['student-profile-invoices', organizationId, studentId],
    queryFn: () => listInvoices(organizationId),
    enabled: Boolean(
      canReadFinance && (activeTab === 'fees' || activeTab === 'overview'),
    ),
    retry: false,
  });
  const attendanceQuery = useQuery({
    queryKey: ['student-profile-attendance', organizationId, studentId],
    queryFn: () => {
      const to = new Date();
      const from = new Date(to);
      from.setFullYear(to.getFullYear() - 1);
      return listStudentAttendance(organizationId, {
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
      });
    },
    enabled: Boolean(
      canReadAttendance &&
      (activeTab === 'attendance' || activeTab === 'overview'),
    ),
    retry: false,
  });
  const guardianQuery = useQuery({
    queryKey: ['student-profile-family-contacts', organizationId, studentId],
    queryFn: () => listStudentFamilyContacts(organizationId, studentId),
    enabled: Boolean(
      access.data?.permissions.includes('guardian.read') &&
      activeTab === 'overview',
    ),
    retry: false,
  });
  const examsQuery = useQuery({
    queryKey: ['student-profile-exams', organizationId],
    queryFn: () => listExams(organizationId),
    enabled: Boolean(
      canReadExams && (activeTab === 'results' || activeTab === 'overview'),
    ),
    retry: false,
  });
  const publishedExams = (examsQuery.data?.items ?? []).filter((exam) =>
    Boolean(exam.resultsPublishedAt),
  );
  const reportQueries = useQueries({
    queries: publishedExams.map((exam) => ({
      queryKey: ['student-exam-report', organizationId, exam.id, studentId],
      queryFn: () => getStudentExamReport(organizationId, exam.id, studentId),
      enabled: Boolean(
        canReadExams && (activeTab === 'results' || activeTab === 'overview'),
      ),
      retry: false,
    })),
  });

  if (access.isPending)
    return <LoadingState message="Checking student access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="Student access could not be verified for this organization."
        onRetry={() => void access.refetch()}
      />
    );
  if (!access.data.permissions.includes('student.read'))
    return <PermissionDeniedState />;
  if (student.isPending) return <LoadingState message="Loading student…" />;
  if (student.isError)
    return (
      <ErrorState
        title="Student unavailable"
        description={apiMessage(student.error)}
        onRetry={() => void student.refetch()}
      />
    );

  const record = student.data.student;
  const placement = placementQuery.data?.items.find(
    (item) => item.studentId === studentId,
  );
  const invoices = (invoiceQuery.data?.items ?? [])
    .filter((invoice) => invoice.studentId === studentId)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const outstanding = invoices.reduce(
    (sum, invoice) =>
      sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
    0,
  );
  const attendanceRecords = (attendanceQuery.data?.items ?? []).filter(
    (item) => item.studentId === studentId,
  );
  const present = attendanceRecords.filter(
    (item) => item.status === 'present' || item.status === 'late',
  ).length;
  const absent = attendanceRecords.filter(
    (item) => item.status === 'absent',
  ).length;
  const attendanceDays = attendanceRecords.filter(
    (item) => item.status !== 'leave',
  ).length;
  const attendanceRate = attendanceDays
    ? Math.round((present / attendanceDays) * 100)
    : null;
  const latestReport = reportQueries
    .map((query) => query.data?.report)
    .filter(Boolean)
    .sort((a, b) => b!.exam.endDate.localeCompare(a!.exam.endDate))[0];
  const money = (amount: number) => `PKR ${amount.toLocaleString('en-PK')}`;
  const tabs = [
    ['overview', 'Overview'],
    ['fees', 'Fees'],
    ['attendance', 'Attendance'],
    ['results', 'Results'],
    ['documents', 'Documents'],
    ['behaviour', 'Behaviour'],
    ['history', 'History'],
  ] as const;
  const canUpdate = access.data.permissions.includes('student.update');
  const openAdmissionForm = () => {
    const rows: Array<[string, string]> = [
      ['Student name', `${record.firstName} ${record.lastName}`],
      [
        'Registration number',
        record.registrationNumber || placement?.registrationNumber || '',
      ],
      ['Father name', record.fatherName || ''],
      ['Mother name', record.motherName || ''],
      ['Date of birth', record.dateOfBirth?.slice(0, 10) || ''],
      ['Gender', record.gender || ''],
      ['B-Form / CNIC', record.nationalId || ''],
      ['Phone', record.phone || record.parentMobile || ''],
      ['Email', record.contactEmail || ''],
      ['Class', placement?.className || ''],
      ['Section', placement?.sectionName || ''],
      ['Session', placement?.academicYearName || ''],
      [
        'Address',
        [
          record.address?.line1,
          record.address?.line2,
          record.address?.city,
          record.address?.region,
        ]
          .filter(Boolean)
          .join(', '),
      ],
    ];
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      showToast('Please allow pop-ups to download the admission form.');
      return;
    }
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (char) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[char] ?? char,
      );
    popup.document.write(
      `<!doctype html><html><head><title>Admission Form - ${escape(record.firstName)} ${escape(record.lastName)}</title><style>body{font:14px Arial,sans-serif;color:#172033;margin:36px}h1{text-align:center;margin:0}p{text-align:center;color:#667085}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:28px}.row{padding:12px 4px;border-bottom:1px solid #d9dee8}.label{display:block;color:#667085;font-size:11px;text-transform:uppercase;margin-bottom:5px}.sign{display:flex;justify-content:space-between;margin-top:80px}@media print{button{display:none}}</style></head><body><h1>Student Admission Form</h1><p>${escape(placement?.academicYearName || 'InstituteOS')}</p><div class="grid">${rows.map(([label, value]) => `<div class="row"><span class="label">${escape(label)}</span><strong>${escape(value || '—')}</strong></div>`).join('')}</div><div class="sign"><span>Parent / Family contact Signature: __________</span><span>Office Stamp: __________</span></div><script>window.onload=()=>window.print()</script></body></html>`,
    );
    popup.document.close();
  };
  const submitClassChange = async () => {
    if (
      !placement?.classId ||
      !placement.sectionId ||
      !placement.academicYearId ||
      !record.campusId ||
      !targetClassId ||
      !targetSectionId ||
      !targetYearId
    ) {
      showToast('Select a class, section and academic session first.');
      return;
    }
    setChangingClass(true);
    try {
      await placeStudent(organizationId, {
        studentId,
        classId: targetClassId,
        sectionId: targetSectionId,
        academicYearId: targetYearId,
        campusId: record.campusId,
      });
      await Promise.all([student.refetch(), placementQuery.refetch()]);
      setChangeClassOpen(false);
      showToast(`Student moved successfully (${movementType}).`);
    } catch (error) {
      showToast(apiMessage(error));
    } finally {
      setChangingClass(false);
    }
  };
  const markStudentLeft = async () => {
    if (
      !window.confirm(
        `Mark ${record.firstName} ${record.lastName} as left? The student will no longer be active.`,
      )
    )
      return;
    setMarkingLeft(true);
    try {
      if (placement && record.campusId)
        await removeStudentFromSection(organizationId, studentId, {
          classId: placement.classId,
          sectionId: placement.sectionId,
          academicYearId: placement.academicYearId,
          campusId: record.campusId,
        });
      await updateStudent(organizationId, studentId, {
        status: 'withdrawn',
      } as StudentInput);
      await student.refetch();
      showToast('Student marked as left.');
    } catch (error) {
      showToast(apiMessage(error));
    } finally {
      setMarkingLeft(false);
    }
  };

  return (
    <main className="page-stack student-management-page reference-live-module student-profile-page">
      <div className="student-profile-top">
        <Link
          className="student-profile-back"
          to={`/admin/organizations/${encodeURIComponent(organizationId)}/students`}
          aria-label="Back to students"
        >
          ←
        </Link>
        <div className="student-profile-avatar">
          <UserRound size={28} />
        </div>
        <div className="student-profile-identity">
          <div className="student-profile-name-row">
            <h1>
              {record.firstName} {record.lastName}
            </h1>
            <span
              className={`status-badge ${record.status === 'active' ? 'status-positive' : 'status-negative'}`}
            >
              {record.status}
            </span>
          </div>
          <p>
            {placement
              ? `${placement.className}, ${placement.sectionName}`
              : 'Class / section not assigned'}{' '}
            · {placement?.academicYearName ?? 'Academic session unavailable'}
            {placement?.familyNumber
              ? ` · Family ${placement.familyNumber}`
              : ''}
          </p>
          <span className="student-profile-reg">
            {record.registrationNumber ||
              placement?.registrationNumber ||
              'Registration pending'}
          </span>
        </div>
      </div>
      <div className="student-profile-actions">
        {canUpdate && (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setTargetClassId('');
              setTargetSectionId('');
              setTargetYearId(placement?.academicYearId || '');
              setChangeClassOpen(true);
            }}
          >
            Change class
          </button>
        )}
        {canUpdate && record.status === 'active' && (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void markStudentLeft()}
            disabled={markingLeft}
          >
            {markingLeft ? 'Updating…' : 'Mark as left'}
          </button>
        )}
        <button
          className="button button-secondary"
          type="button"
          onClick={openAdmissionForm}
        >
          <Download size={15} /> Admission form
        </button>
        {canUpdate && (
          <Link
            className="button button-primary"
            to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}/edit`}
          >
            <Pencil size={15} /> Edit student
          </Link>
        )}
      </div>
      <section className="student-profile-stats">
        <article>
          <span>FEES OWED</span>
          <strong>
            {canReadFinance
              ? invoiceQuery.isPending
                ? 'Loading…'
                : money(outstanding)
              : 'Restricted'}
          </strong>
          <small>
            {canReadFinance
              ? outstanding
                ? 'Outstanding balance'
                : 'No outstanding invoices'
              : 'Finance permission required'}
          </small>
        </article>
        <article>
          <span>ATTENDANCE</span>
          <strong>
            {canReadAttendance
              ? attendanceRate === null
                ? '—'
                : `${attendanceRate}%`
              : 'Restricted'}
          </strong>
          <small>
            {canReadAttendance
              ? `${present} present · ${absent} absent`
              : 'Attendance permission required'}
          </small>
        </article>
        <article>
          <span>LATEST RESULT</span>
          <strong>
            {latestReport?.percentage == null
              ? '—'
              : `${latestReport.percentage.toFixed(1)}%`}
          </strong>
          <small>
            {latestReport?.exam.name ??
              (canReadExams
                ? 'No published result'
                : 'Examination permission required')}
          </small>
        </article>
        <article>
          <span>MONTHLY FEE</span>
          <strong>
            {placement?.monthlyFee ? money(placement.monthlyFee) : '—'}
          </strong>
          <small>
            {placement ? 'Current class placement' : 'Fee not assigned'}
          </small>
        </article>
      </section>
      <nav
        className="student-profile-tabs"
        aria-label="Student profile sections"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'active' : ''}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => setActiveTab(id)}
          >
            {label}
            {id === 'results' && publishedExams.length ? (
              <small>{publishedExams.length}</small>
            ) : null}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <>
          <div className="student-profile-columns">
            <section className="student-detail-panel panel">
              <h2>Student details</h2>
              <p className="page-description">Personal details</p>
              <dl className="student-details">
                <div>
                  <dt>Full name</dt>
                  <dd>
                    {record.firstName} {record.lastName}
                  </dd>
                </div>
                <div>
                  <dt>Father's name</dt>
                  <dd>{record.fatherName || '—'}</dd>
                </div>
                <div>
                  <dt>Mother's name</dt>
                  <dd>{record.motherName || '—'}</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>{record.gender || '—'}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>{record.dateOfBirth?.slice(0, 10) || '—'}</dd>
                </div>
                <div>
                  <dt>Age</dt>
                  <dd>
                    {record.dateOfBirth
                      ? `${Math.max(0, Math.floor((Date.now() - new Date(record.dateOfBirth).getTime()) / 31557600000))} years`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Place of birth</dt>
                  <dd>{record.birthPlace || '—'}</dd>
                </div>
                <div>
                  <dt>Nationality</dt>
                  <dd>{record.nationality || '—'}</dd>
                </div>
                <div>
                  <dt>Religion</dt>
                  <dd>{record.religion || '—'}</dd>
                </div>
                <div>
                  <dt>B-Form / CNIC</dt>
                  <dd>{record.nationalId || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{record.contactEmail || '—'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{record.phone || '—'}</dd>
                </div>
              </dl>
            </section>
            <section className="student-detail-panel panel">
              <h2>Admission</h2>
              <dl className="student-details">
                <div>
                  <dt>Class</dt>
                  <dd>{placement?.className || '—'}</dd>
                </div>
                <div>
                  <dt>Section</dt>
                  <dd>{placement?.sectionName || '—'}</dd>
                </div>
                <div>
                  <dt>Session</dt>
                  <dd>{placement?.academicYearName || '—'}</dd>
                </div>
                <div>
                  <dt>Admitted on</dt>
                  <dd>{record.createdAt?.slice(0, 10) || '—'}</dd>
                </div>
                <div>
                  <dt>Registration number</dt>
                  <dd>
                    {record.registrationNumber ||
                      placement?.registrationNumber ||
                      '—'}
                  </dd>
                </div>
                <div>
                  <dt>Campus</dt>
                  <dd>
                    <StudentCampusName
                      campusId={record.campusId}
                      campuses={campuses.data?.campuses ?? []}
                    />
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <section className="student-detail-panel panel">
            <h2>Family</h2>
            <p className="page-description">
              Family number: {placement?.familyNumber || 'Not assigned'}
            </p>
            {guardianQuery.isPending ? (
              <p className="page-description">Loading parent details…</p>
            ) : guardianQuery.isError ? (
              <p className="page-description">
                Parent details could not be loaded.
              </p>
            ) : guardianQuery.data?.relations.length ? (
              <div className="student-profile-parents">
                {guardianQuery.data.relations.map((relation) => (
                  <article key={relation.id}>
                    <span>{relation.relationship}</span>
                    <strong>
                      {relation.guardian.firstName} {relation.guardian.lastName}
                    </strong>
                    <small>
                      {relation.guardian.phone || 'No phone number'}
                    </small>
                    {relation.isPrimary && <em>Main contact</em>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="page-description">
                No parent or guardian is linked to this student yet.
              </p>
            )}
          </section>
          {access.data.permissions.includes('guardian.read') && (
            <StudentFamilyContactsSection
              canRead
              canUpdate={
                canUpdate && access.data.permissions.includes('guardian.update')
              }
              organizationId={organizationId}
              studentId={studentId}
            />
          )}
          <section className="student-detail-panel panel">
            <h2>Address</h2>
            <dl className="student-details">
              <div>
                <dt>House / street</dt>
                <dd>
                  {[record.address?.line1, record.address?.line2]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{record.address?.city || '—'}</dd>
              </div>
              <div>
                <dt>Province</dt>
                <dd>{record.address?.region || '—'}</dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>{record.address?.country || '—'}</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {activeTab === 'fees' && (
        <>
          {canReadFinance && (
            <StudentPreviousDuesSection
              organizationId={organizationId}
              studentId={studentId}
              canWrite={access.data.permissions.includes('finance.write')}
            />
          )}
          <section className="student-detail-panel panel">
            <div className="student-detail-heading">
              <div>
                <h2>Fee challans</h2>
                <p className="page-description">
                  Invoices and payments recorded for this student.
                </p>
              </div>
            </div>
            {!canReadFinance ? (
              <PermissionDeniedState />
            ) : invoiceQuery.isPending ? (
              <LoadingState message="Loading student fees…" />
            ) : invoiceQuery.isError ? (
              <ErrorState
                title="Fees unavailable"
                description={apiMessage(invoiceQuery.error)}
                onRetry={() => void invoiceQuery.refetch()}
              />
            ) : invoices.length ? (
              <div className="student-profile-table-wrap">
                <table className="student-profile-table">
                  <thead>
                    <tr>
                      <th>Fee</th>
                      <th>Due date</th>
                      <th>Amount</th>
                      <th>Still owed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          {invoice.billingCycle || invoice.feeStructureName}
                        </td>
                        <td>{invoice.dueDate.slice(0, 10)}</td>
                        <td>{money(invoice.totalAmount)}</td>
                        <td>
                          {money(
                            Math.max(
                              0,
                              invoice.totalAmount - invoice.paidAmount,
                            ),
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${invoice.status === 'paid' ? 'status-positive' : 'status-negative'}`}
                          >
                            {invoice.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="page-description">
                No fee challans found for this student.
              </p>
            )}
          </section>
        </>
      )}

      {activeTab === 'attendance' && (
        <section className="student-detail-panel panel">
          <div className="student-detail-heading">
            <div>
              <h2>Attendance</h2>
              <p className="page-description">
                Attendance records from the last 12 months.
              </p>
            </div>
          </div>
          {!canReadAttendance ? (
            <PermissionDeniedState />
          ) : attendanceQuery.isPending ? (
            <LoadingState message="Loading attendance…" />
          ) : attendanceQuery.isError ? (
            <ErrorState
              title="Attendance unavailable"
              description={apiMessage(attendanceQuery.error)}
              onRetry={() => void attendanceQuery.refetch()}
            />
          ) : (
            <>
              <div className="student-profile-attendance-stats">
                <article>
                  <span>Present / Late</span>
                  <strong>{present}</strong>
                </article>
                <article>
                  <span>Absent</span>
                  <strong>{absent}</strong>
                </article>
                <article>
                  <span>On leave</span>
                  <strong>
                    {
                      attendanceRecords.filter(
                        (item) => item.status === 'leave',
                      ).length
                    }
                  </strong>
                </article>
                <article>
                  <span>Attendance rate</span>
                  <strong>
                    {attendanceRate === null ? '—' : `${attendanceRate}%`}
                  </strong>
                </article>
              </div>
              <div className="student-profile-table-wrap">
                <table className="student-profile-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((item) => (
                        <tr key={item.id}>
                          <td>{item.date}</td>
                          <td>{item.status}</td>
                          <td>{item.remarks || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === 'results' && (
        <section className="student-detail-panel panel">
          <h2>Exam results</h2>
          <p className="page-description">
            Published examination reports for this student.
          </p>
          {!canReadExams ? (
            <PermissionDeniedState />
          ) : examsQuery.isPending ? (
            <LoadingState message="Loading examinations…" />
          ) : examsQuery.isError ? (
            <ErrorState
              title="Results unavailable"
              description={apiMessage(examsQuery.error)}
              onRetry={() => void examsQuery.refetch()}
            />
          ) : reportQueries.some((query) => query.isPending) ? (
            <LoadingState message="Loading published results…" />
          ) : publishedExams.length &&
            reportQueries.some((query) => query.data) ? (
            <div className="student-profile-results">
              {reportQueries.map((query, index) =>
                query.data?.report ? (
                  <article key={publishedExams[index].id}>
                    <div>
                      <h3>{query.data.report.exam.name}</h3>
                      <p>{query.data.report.exam.startDate.slice(0, 10)}</p>
                    </div>
                    <strong>
                      {query.data.report.percentage == null
                        ? '—'
                        : `${query.data.report.percentage.toFixed(1)}%`}
                    </strong>
                    <span>{query.data.report.overallGrade || '—'}</span>
                    <div className="student-profile-table-wrap">
                      <table className="student-profile-table">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Marks</th>
                            <th>Total</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {query.data.report.results.map((result) => (
                            <tr key={result.schedule.id}>
                              <td>{result.subjectName}</td>
                              <td>
                                {result.mark?.marksObtained ??
                                  (result.mark?.isAbsent ? 'Absent' : '—')}
                              </td>
                              <td>{result.schedule.totalMarks}</td>
                              <td>{result.mark?.grade || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ) : null,
              )}
            </div>
          ) : (
            <p className="page-description">
              No published exam results are available for this student.
            </p>
          )}
        </section>
      )}

      {activeTab === 'documents' && (
        <section className="student-detail-panel panel">
          <h2>Documents</h2>
          <p className="page-description">
            Student document records are not yet connected to this profile view.
            No documents are being displayed until the document storage API is
            available.
          </p>
        </section>
      )}
      {activeTab === 'behaviour' && (
        <section className="student-detail-panel panel">
          <h2>Behaviour</h2>
          <p className="page-description">
            Behaviour notes and entries are not yet connected to this student
            profile. No sample records are shown.
          </p>
        </section>
      )}
      {activeTab === 'history' && (
        <section className="student-detail-panel panel">
          <h2>Student history</h2>
          <p className="page-description">
            Current status: {record.status}. Current placement:{' '}
            {placement
              ? `${placement.className} - ${placement.sectionName} (${placement.academicYearName})`
              : 'No active placement'}
            .
          </p>
          <p className="page-description">
            Class movement history is not yet stored by the placement service;
            this screen will not fabricate previous movements.
          </p>
        </section>
      )}
      {changeClassOpen && (
        <div
          className="student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChangeClassOpen(false);
          }}
        >
          <section
            className="student-change-class-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-change-class-title"
          >
            <header>
              <div>
                <h2 id="student-change-class-title">Change student class</h2>
                <p className="page-description">
                  Move this student to a new class, section and academic
                  session.
                </p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setChangeClassOpen(false)}
              >
                ×
              </button>
            </header>
            <label>
              Movement type
              <select
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
              >
                <option>Promote</option>
                <option>Demote</option>
                <option>Repeat class</option>
                <option>Transfer</option>
                <option>Graduate</option>
              </select>
            </label>
            <label>
              Academic session
              <select
                value={targetYearId}
                onChange={(event) => setTargetYearId(event.target.value)}
              >
                <option value="">Select session</option>
                {(yearsQuery.data?.items ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              New class
              <select
                value={targetClassId}
                onChange={(event) => {
                  setTargetClassId(event.target.value);
                  setTargetSectionId('');
                }}
              >
                <option value="">Select class</option>
                {(classesQuery.data?.items ?? [])
                  .filter(
                    (item) =>
                      !record.campusId || item.campusId === record.campusId,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              New section
              <select
                value={targetSectionId}
                onChange={(event) => setTargetSectionId(event.target.value)}
              >
                <option value="">Select section</option>
                {(sectionsQuery.data?.items ?? [])
                  .filter((item) => item.classId === targetClassId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Effective date
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </label>
            <label>
              Reason (optional)
              <textarea
                value={movementReason}
                onChange={(event) => setMovementReason(event.target.value)}
                rows={3}
                placeholder="Add a reason for this class movement"
              />
            </label>
            <footer>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setChangeClassOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={
                  changingClass ||
                  !targetClassId ||
                  !targetSectionId ||
                  !targetYearId
                }
                onClick={() => void submitClassChange()}
              >
                {changingClass ? 'Moving…' : 'Move student'}
              </button>
            </footer>
          </section>
        </div>
      )}
      <ChildPickupPanel
        organizationId={organizationId}
        studentId={studentId}
        userRole={access.data.role}
      />
    </main>
  );
}

export function StudentEditPage() {
  const { organizationId = '', studentId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const student = useStudent(
    organizationId,
    studentId,
    Boolean(access.data?.permissions.includes('student.update')),
  );
  const campuses = useCampusChoices(organizationId, access.data);
  const mutation = useUpdateStudent(organizationId, studentId);
  const { showToast } = useToast();

  const submit = (input: StudentInput) => {
    mutation.mutate(input, {
      onSuccess: () => {
        showToast('Student changes saved.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(studentId)}`,
        );
      },
    });
  };

  return (
    <AccessState
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="student.update"
    >
      {student.isPending ? (
        <LoadingState message="Loading student…" />
      ) : student.isError ? (
        <ErrorState
          title="Student unavailable"
          description={apiMessage(student.error)}
          onRetry={() => void student.refetch()}
        />
      ) : (
        <main className="page-stack student-management-page reference-live-module">
          <StudentPageHeading
            description="Update the student's record."
            organizationId={organizationId}
            title="Edit student"
          />
          <section className="student-form-panel panel">
            <StudentForm
              campusError={
                campuses.isError ? apiMessage(campuses.error) : undefined
              }
              campuses={campuses.data?.campuses ?? []}
              canAssignCampus={
                access.data?.permissions.includes('campus.read') ?? false
              }
              campusRequired={access.data?.role === 'campus_admin'}
              isSaving={mutation.isPending}
              onSubmit={submit}
              saveError={
                mutation.isError ? apiMessage(mutation.error) : undefined
              }
              student={student.data.student}
            />
          </section>
        </main>
      )}
    </AccessState>
  );
}
