import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgePercent, Search, Users } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { useFinanceWorkspace } from './finance-queries.js';
import { StudentConcessionModal } from './StudentConcessionModal.js';

export function FeeConcessionsPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canRead = access.data?.permissions.includes('finance.read') ?? false;
  const canWrite = access.data?.permissions.includes('finance.write') ?? false;
  const academics = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const finance = useFinanceWorkspace(
    organizationId,
    Boolean(access.data && canRead),
    {},
  );
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const classes = academics.classes.data?.items ?? [];
  const invoices = finance.invoices.data?.items ?? [];
  const students = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; name: string; classId: string; invoiceCount: number }
    >();
    for (const invoice of invoices) {
      const current = byId.get(invoice.studentId);
      if (current) {
        current.invoiceCount += 1;
      } else {
        byId.set(invoice.studentId, {
          id: invoice.studentId,
          name: invoice.studentName,
          classId: invoice.classId,
          invoiceCount: 1,
        });
      }
    }
    return [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [invoices]);
  const filteredStudents = students.filter((student) => {
    const classLabel =
      classes.find((item) => item.id === student.classId)?.name ?? '';
    const matchesSearch = `${student.name} ${classLabel}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matchesSearch && (!classFilter || student.classId === classFilter);
  });

  if (access.isPending)
    return <LoadingState message="Checking finance access..." />;
  if (access.error || !access.data) {
    return (
      <ErrorState
        title="Finance workspace unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Finance access could not be verified.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (!canRead) return <PermissionDeniedState />;

  const error = finance.invoices.error ?? academics.classes.error;
  if (error) {
    return (
      <ErrorState
        title="Fee concession records could not be loaded"
        description={apiMessage(error)}
        onRetry={() => {
          void finance.invoices.refetch();
          void academics.classes.refetch();
        }}
      />
    );
  }

  return (
    <main className="page-stack finance-concessions-live-page reference-live-module">
      <WorkspacePageHeading
        eyebrow="Finance workspace"
        title="Fee concessions"
        description="Review students with fee accounts and manage their scholarships, sibling discounts, and approved waivers."
        aside={
          <div className="concession-count">
            <BadgePercent size={17} aria-hidden="true" />
            <strong>{students.length}</strong>
            <span>students with fee accounts</span>
          </div>
        }
      />

      <section className="panel fee-concessions-panel">
        <div className="panel-heading">
          <div>
            <h2>Student concessions</h2>
            <p>
              Concessions are recorded against the student and can be reviewed
              in their fee profile.
            </p>
          </div>
        </div>
        <div className="fee-concessions-filters">
          <label className="fee-concessions-search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search students"
              placeholder="Search student or class..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="visually-hidden">Filter by class</span>
            <select
              aria-label="Filter by class"
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value="">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {finance.invoices.isPending || academics.classes.isPending ? (
          <LoadingState message="Loading students with fee records..." />
        ) : students.length === 0 ? (
          <EmptyState
            title="No fee accounts found"
            description="Generate invoices first. Students with finance records will appear here so their concessions can be managed."
          />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="No matching students"
            description="Try a different search or clear the class filter."
          />
        ) : (
          <div className="table-scroll fee-concessions-table-scroll">
            <table className="fee-concessions-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Fee records</th>
                  <th>Concession management</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.name}</strong>
                    </td>
                    <td>
                      {classes.find((item) => item.id === student.classId)
                        ?.name ?? 'Class not available'}
                    </td>
                    <td>
                      <span className="fee-concessions-record-count">
                        <Users size={13} aria-hidden="true" />
                        {student.invoiceCount}
                      </span>
                    </td>
                    <td>
                      <span className="muted-text">
                        Review or assign a benefit
                      </span>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!canWrite}
                        onClick={() =>
                          setSelectedStudent({
                            id: student.id,
                            name: student.name,
                          })
                        }
                      >
                        {canWrite ? 'Manage' : 'View access required'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!canWrite && (
        <p className="parent-explainer">
          Your role is read-only in finance. Ask an administrator for permission
          to create or remove concessions.
        </p>
      )}
      {selectedStudent && (
        <StudentConcessionModal
          organizationId={organizationId}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          isOpen
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </main>
  );
}
