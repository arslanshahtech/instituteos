import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChartNoAxesColumnIncreasing,
  Download,
  Plus,
} from 'lucide-react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import type { RoleLayoutConfig } from '../layouts/layoutTypes.js';
import { DataTable } from '../components/ui/DataTable.js';
import {
  WorkspacePageHeading,
  WorkspaceSearchField,
  WorkspaceFilterSelect,
  WorkspaceModuleSection,
  WorkspaceModuleToolbar,
  WorkspaceStudentCard,
  WorkspaceStaffCard,
} from '../components/ui/WorkspacePrimitives.js';

type DemoAttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

const demoStudents = [
  {
    initials: 'AS',
    name: 'Aarav Sharma',
    className: '8-A',
    roll: 'Roll 08',
    guardian: 'R. Sharma',
    attendance: '94%',
    fee: 'Rs 45,000',
    status: 'Paid',
  },
  {
    initials: 'IV',
    name: 'Ishita Verma',
    className: '9-B',
    roll: 'Roll 12',
    guardian: 'S. Verma',
    attendance: '89%',
    fee: 'Rs 52,000',
    status: 'Due',
  },
  {
    initials: 'KK',
    name: 'Kabir Khan',
    className: '8-A',
    roll: 'Roll 05',
    guardian: 'A. Khan',
    attendance: '96%',
    fee: 'Rs 45,000',
    status: 'Paid',
  },
  {
    initials: 'AG',
    name: 'Ananya Gupta',
    className: '10-A',
    roll: 'Roll 02',
    guardian: 'M. Gupta',
    attendance: '98%',
    fee: 'Rs 58,000',
    status: 'Paid',
  },
  {
    initials: 'RP',
    name: 'Reyansh Patel',
    className: '8-A',
    roll: 'Roll 19',
    guardian: 'K. Patel',
    attendance: '78%',
    fee: 'Rs 25,000',
    status: 'Due',
  },
  {
    initials: 'SM',
    name: 'Saanvi Mehta',
    className: '9-A',
    roll: 'Roll 07',
    guardian: 'P. Mehta',
    attendance: '91%',
    fee: 'Rs 52,000',
    status: 'Paid',
  },
  {
    initials: 'MZ',
    name: 'My Child - Zoya',
    className: '8-A',
    roll: 'Roll 21',
    guardian: 'You',
    attendance: '92%',
    fee: 'Rs 20,000',
    status: 'Due',
  },
  {
    initials: 'AJ',
    name: 'Arjun Singh',
    className: '10-B',
    roll: 'Roll 11',
    guardian: 'D. Singh',
    attendance: '88%',
    fee: 'Rs 58,000',
    status: 'Paid',
  },
];

const demoGuardians = [
  {
    name: 'Rajesh Sharma',
    phone: '+92 98101 22334',
    relation: 'Father',
    children: '2 children',
  },
  {
    name: 'Sunita Verma',
    phone: '+92 98101 22335',
    relation: 'Mother',
    children: '1 child',
  },
  {
    name: 'Arif Khan',
    phone: '+92 98101 22336',
    relation: 'Father',
    children: '1 child',
  },
];

const initialAttendance: Array<{
  name: string;
  roll: string;
  status: DemoAttendanceStatus;
}> = [
  { name: 'Aarav Sharma', roll: 'Roll 08', status: 'Present' },
  { name: 'Ishita Verma', roll: 'Roll 12', status: 'Present' },
  { name: 'Kabir Khan', roll: 'Roll 05', status: 'Absent' },
  { name: 'Ananya Gupta', roll: 'Roll 02', status: 'Present' },
  { name: 'Reyansh Patel', roll: 'Roll 19', status: 'Late' },
  { name: 'Saanvi Mehta', roll: 'Roll 07', status: 'Present' },
];

const demoStaff = [
  {
    initials: 'SR',
    name: 'Dr. Sunita Rao',
    subject: 'Mathematics · 8-A, 9-B',
    phone: '+92 98765 43210',
  },
  {
    initials: 'AC',
    name: 'Amit Chauhan',
    subject: 'Science · 9-A, 10-A',
    phone: '+92 98765 43211',
  },
  {
    initials: 'PN',
    name: 'Priya Nair',
    subject: 'English · 8-A, 8-B',
    phone: '+92 98765 43212',
  },
];

const demoHomework = [
  {
    title: 'Algebra Assignment · Ch 3',
    meta: '8-A · Math · Due 10 Oct',
    status: 'Pending',
    progress: '18/30',
  },
  {
    title: 'Science Lab Report',
    meta: '9-B · Science · Due 11 Oct',
    status: 'Checked',
    progress: '28/32',
  },
  {
    title: 'Unit Test · History',
    meta: '10-A · SST · Due 13 Oct',
    status: 'Pending',
    progress: '—',
  },
];

const demoApplications = [
  {
    name: 'Reyansh Patel',
    className: '8-A',
    date: 'Applied today',
    status: 'Pending',
  },
  {
    name: 'Saanvi Mehta',
    className: '9-A',
    date: 'Applied today',
    status: 'Approved',
  },
  {
    name: 'Kabir Khan',
    className: '8-A',
    date: 'Applied yesterday',
    status: 'Enrolled',
  },
];

const initialConcessions = [
  {
    student: 'Aarav Sharma',
    type: 'Sibling',
    amount: 'Rs 5,000',
    percent: '10%',
    approved: 'Admin · Today',
  },
  {
    student: 'Ananya Gupta',
    type: 'Merit',
    amount: 'Rs 8,700',
    percent: '15%',
    approved: 'Principal · Today',
  },
  {
    student: 'Kabir Khan',
    type: 'Staff',
    amount: 'Rs 9,000',
    percent: '20%',
    approved: 'Admin · Today',
  },
];

const moduleTitles: Record<string, string> = {
  students: 'Students',
  guardians: 'Guardians',
  staff: 'Teachers / Staff',
  attendance: 'Attendance',
  homework: 'Homework & Tests',
  examinations: 'Homework & Tests',
  admissions: 'Admissions',
  finance: 'Finance · Collection',
  fees: 'Fee & financial management',
  concessions: 'Concessions',
  communications: 'Messages',
  messages: 'Messages',
  reports: 'Reports & Export',
  results: 'Published Results',
  settings: 'Settings',
};

export function RoleDemoModulePage() {
  const { role } = useOutletContext<{ role: RoleLayoutConfig }>();
  const { previewModule = '', organizationId = '' } = useParams();
  const location = useLocation();
  const module = previewModule.toLowerCase();
  const demoMode =
    import.meta.env.DEV && location.pathname.includes('/preview/');
  const [search, setSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all');
  const [selectedDemoStudent, setSelectedDemoStudent] = useState<
    (typeof demoStudents)[number] | null
  >(null);
  const [selectedTab, setSelectedTab] = useState('Homework');
  const [notice, setNotice] = useState('');
  const [attendance, setAttendance] = useState(initialAttendance);
  const [concessions, setConcessions] = useState(initialConcessions);
  const [showConcessionForm, setShowConcessionForm] = useState(false);
  const [concessionStudent, setConcessionStudent] = useState('');
  const [concessionAmount, setConcessionAmount] = useState('');
  const [activeThread, setActiveThread] = useState(0);
  const [messageDraft, setMessageDraft] = useState('');
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [settingsTab, setSettingsTab] = useState('Institute Info');
  const [feeStatus, setFeeStatus] = useState([
    'Paid',
    'Due',
    'Paid',
    'Paid',
    'Due',
  ]);
  const [admissionSubmitted, setAdmissionSubmitted] = useState(false);

  const base = organizationId
    ? `/${role.key}/organizations/${encodeURIComponent(organizationId)}`
    : role.key === 'admin'
      ? '/admin/organizations/preview'
      : '/' + role.key + '/organizations/preview';
  const filteredStudents = useMemo(
    () =>
      demoStudents.filter((student) => {
        const matchesSearch = (
          student.name +
          ' ' +
          student.className +
          ' ' +
          student.roll
        )
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus =
          studentStatusFilter === 'all' ||
          student.status.toLowerCase() === studentStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [search, studentStatusFilter],
  );

  if (!demoMode)
    return (
      <Navigate
        to={role.key === 'platform' ? '/platform' : '/' + role.key}
        replace
      />
    );

  const title = moduleTitles[module] ?? 'College workspace';
  const navigateLink = (to: string) => (
    <Link className="button button-primary" to={to}>
      Open module <ArrowUpRight size={14} aria-hidden="true" />
    </Link>
  );

  return (
    <main className="page-stack role-demo-module">
      <WorkspacePageHeading
        eyebrow={`${role.label} · Layout preview`}
        title={title}
        description="Reference-aligned screen with local sample values for visual review."
        aside={<span className="reference-preview-note">SAMPLE DATA · NOT SAVED</span>}
      />

      {notice && (
        <p className="role-demo-notice" role="status">
          {notice}
        </p>
      )}

      {module === 'students' && (
        <WorkspaceModuleSection>
          <WorkspaceModuleToolbar>
            <WorkspaceSearchField
              label="Search students"
              onChange={setSearch}
              placeholder="Search name, class or roll..."
              value={search}
            />
            <WorkspaceFilterSelect
              label="Student fee status"
              onChange={setStudentStatusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'paid', label: 'Paid' },
                { value: 'due', label: 'Due' },
              ]}
              value={studentStatusFilter}
            />
            {role.key === 'admin' && (
              <button
                className="reference-quick-action"
                onClick={() =>
                  setNotice('Student form preview opened; no record was saved.')
                }
                type="button"
              >
                <Plus size={14} /> Add Student
              </button>
            )}
          </WorkspaceModuleToolbar>
          {selectedDemoStudent ? (
            <section className="reference-detail-panel panel">
              <div className="reference-detail-heading">
                <button
                  className="reference-quick-action"
                  onClick={() => setSelectedDemoStudent(null)}
                  type="button"
                >
                  ← Back to students
                </button>
                <span className="reference-preview-note">
                  SAMPLE PROFILE · NOT A REAL RECORD
                </span>
              </div>
              <div className="reference-student-detail-summary">
                <span className="reference-student-avatar">
                  {selectedDemoStudent.initials}
                </span>
                <div>
                  <h2>{selectedDemoStudent.name}</h2>
                  <p>
                    {selectedDemoStudent.className} · {selectedDemoStudent.roll}
                  </p>
                </div>
                <span
                  className={
                    selectedDemoStudent.status === 'Paid'
                      ? 'reference-status reference-status-paid'
                      : 'reference-status reference-status-pending'
                  }
                >
                  Fee {selectedDemoStudent.status}
                </span>
              </div>
              <dl className="reference-student-detail-grid">
                <div>
                  <dt>Class / Section</dt>
                  <dd>{selectedDemoStudent.className}</dd>
                </div>
                <div>
                  <dt>Roll number</dt>
                  <dd>{selectedDemoStudent.roll}</dd>
                </div>
                <div>
                  <dt>Guardian</dt>
                  <dd>{selectedDemoStudent.guardian}</dd>
                </div>
                <div>
                  <dt>Attendance</dt>
                  <dd>{selectedDemoStudent.attendance}</dd>
                </div>
                <div>
                  <dt>Fee amount</dt>
                  <dd>{selectedDemoStudent.fee}</dd>
                </div>
                <div>
                  <dt>Fee status</dt>
                  <dd>{selectedDemoStudent.status}</dd>
                </div>
              </dl>
              <p className="reference-scope-note">
                This page demonstrates the intended profile layout. The sample
                values are not connected to a college record.
              </p>
            </section>
          ) : (
            <div className="reference-student-grid">
              {filteredStudents.map((student) => (
                <WorkspaceStudentCard
                  ariaLabel={`Open sample profile for ${student.name}`}
                  footer={
                    <>
                      <span>{student.guardian}</span>
                      <span>{student.attendance}</span>
                      <b>{student.fee}</b>
                    </>
                  }
                  initials={student.initials}
                  key={student.name}
                  name={student.name}
                  onClick={() => setSelectedDemoStudent(student)}
                  status={student.status}
                  statusClassName={
                    student.status === 'Paid'
                      ? 'reference-status-paid'
                      : 'reference-status-pending'
                  }
                  subtitle={
                    <>
                      {student.className} · {student.roll}
                    </>
                  }
                />
              ))}
              {filteredStudents.length === 0 && (
                <p className="reference-scope-note">
                  No sample students match these filters.
                </p>
              )}
            </div>
          )}
        </WorkspaceModuleSection>
      )}

      {module === 'guardians' && (
        <WorkspaceModuleSection>
          <WorkspaceModuleToolbar>
            <p>Guardians · 298</p>
            <span className="reference-scope-note">
              Visible to authorized college staff
            </span>
          </WorkspaceModuleToolbar>
          <DataTable
            caption="Sample guardians"
            wrapperClassName="reference-table-wrap"
            tableClassName="reference-table"
            columns={[
              { header: 'Name', render: (guardian) => guardian.name },
              { header: 'Phone', render: (guardian) => guardian.phone },
              { header: 'Relation', render: (guardian) => guardian.relation },
              {
                header: 'Children',
                render: (guardian) => (
                  <button
                    className="reference-mini-pill"
                    onClick={() =>
                      setNotice(guardian.name + ' linked children preview.')
                    }
                    type="button"
                  >
                    {guardian.children}
                  </button>
                ),
              },
            ]}
            rowKey={(guardian) => guardian.name}
            rows={demoGuardians}
          />
        </WorkspaceModuleSection>
      )}

      {module === 'staff' && (
        <section className="reference-module-section">
          <div className="reference-module-toolbar">
            <span>Active teachers and staff</span>
            <button
              className="reference-quick-action"
              onClick={() => setNotice('Add teacher form preview opened.')}
              type="button"
            >
              <Plus size={14} /> Add Teacher
            </button>
          </div>
          <div className="reference-staff-grid">
            {demoStaff.map((person) => (
              <WorkspaceStaffCard
                action={
                  <button
                    className="reference-outline-button"
                    onClick={() =>
                      setNotice(person.name + ' timetable preview.')
                    }
                    type="button"
                  >
                    View Timetable
                  </button>
                }
                details={[person.phone]}
                initials={person.initials}
                key={person.name}
                name={person.name}
                subtitle={person.subject}
              />
            ))}
          </div>
        </section>
      )}

      {module === 'attendance' && (
        <section className="reference-module-section">
          <div className="reference-module-toolbar">
            <label>
              Date{' '}
              <input
                aria-label="Attendance date"
                type="date"
                defaultValue="2026-10-17"
              />
            </label>
            <select aria-label="Attendance class" defaultValue="8-A">
              <option>All Classes</option>
              <option>8-A</option>
              <option>9-B</option>
            </select>
          </div>
          <div className="reference-table-wrap">
            <table className="reference-table reference-attendance-table">
              <thead>
                <tr>
                  <th>Student · 8-A</th>
                  <th colSpan={3}>Mark attendance</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((person, index) => (
                  <tr key={person.name}>
                    <td>
                      <strong>{person.name}</strong>
                      <small>{person.roll}</small>
                    </td>
                    <td colSpan={3}>
                      <div className="reference-attendance-options">
                        {(['Present', 'Absent', 'Late', 'Leave'] as const).map(
                          (status) => (
                            <button
                              className={
                                'reference-attendance-option ' +
                                (person.status === status
                                  ? 'is-' + status.toLowerCase()
                                  : '')
                              }
                              key={status}
                              onClick={() =>
                                setAttendance((records) =>
                                  records.map((record, i) =>
                                    i === index
                                      ? { ...record, status }
                                      : record,
                                  ),
                                )
                              }
                              type="button"
                            >
                              {status}
                            </button>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="reference-form-footer">
            <span>Changes stay in this preview only.</span>
            <button
              className="reference-quick-action"
              onClick={() =>
                setNotice(
                  'Attendance preview updated locally; nothing was saved to the college.',
                )
              }
              type="button"
            >
              Save Attendance
            </button>
          </div>
        </section>
      )}

      {(module === 'homework' || module === 'examinations') && (
        <section className="reference-module-section">
          <div className="reference-module-toolbar">
            <div
              className="reference-tabs"
              role="group"
              aria-label="Homework or tests"
            >
              {['Homework', 'Tests'].map((tab) => (
                <button
                  aria-pressed={selectedTab === tab}
                  className={selectedTab === tab ? 'is-active' : ''}
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              className="reference-quick-action"
              onClick={() =>
                setNotice(
                  selectedTab === 'Homework'
                    ? 'Create homework preview opened.'
                    : 'Create test preview opened.',
                )
              }
              type="button"
            >
              <Plus size={14} /> Create
            </button>
          </div>
          <div className="reference-homework-list">
            {(selectedTab === 'Homework'
              ? demoHomework
              : [
                  {
                    title: 'Mathematics · Unit Test',
                    meta: '8-A · Mathematics · 18 Oct',
                    status: 'Upcoming',
                    progress: '86 students',
                  },
                  {
                    title: 'Science · Chapter Review',
                    meta: '9-B · Science · 20 Oct',
                    status: 'Upcoming',
                    progress: '32 students',
                  },
                  {
                    title: 'History · Term Assessment',
                    meta: '10-A · History · 22 Oct',
                    status: 'Draft',
                    progress: '—',
                  },
                ]
            ).map((homework) => (
              <article className="reference-homework-row" key={homework.title}>
                <div>
                  <strong>{homework.title}</strong>
                  <small>{homework.meta}</small>
                </div>
                <span
                  className={
                    'reference-status ' +
                    (homework.status === 'Checked'
                      ? 'reference-status-approved'
                      : 'reference-status-pending')
                  }
                >
                  {homework.status}
                </span>
                <span className="reference-homework-progress">
                  {homework.progress}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {module === 'admissions' && (
        <section className="reference-admissions-grid">
          <form
            className="reference-module-section reference-demo-form"
            onSubmit={(event) => {
              event.preventDefault();
              setAdmissionSubmitted(true);
              setNotice(
                'Application preview submitted locally. No record was saved.',
              );
            }}
          >
            <h2>New Admission Form</h2>
            <input
              aria-label="Student name"
              placeholder="Student Name"
              required
            />
            <div className="reference-form-row">
              <input aria-label="Date of birth" type="date" required />
              <select aria-label="Class interested" defaultValue="8-A">
                <option>8-A</option>
                <option>9-A</option>
                <option>10-A</option>
              </select>
            </div>
            <input
              aria-label="Guardian name and phone"
              placeholder="Guardian Name & Phone"
              required
            />
            <select aria-label="Fee plan" defaultValue="Standard">
              <option>Fee Plan: Standard</option>
              <option>Scholarship</option>
              <option>Sibling plan</option>
            </select>
            <button
              className="reference-quick-action reference-quick-action-full"
              type="submit"
            >
              {admissionSubmitted
                ? 'Submit another application'
                : 'Submit for Approval'}
            </button>
          </form>
          <section className="reference-module-section">
            <div className="reference-panel-heading">
              <h2>Recent Applications</h2>
              <span>Latest</span>
            </div>
            <div className="reference-homework-list">
              {demoApplications.map((application) => (
                <article
                  className="reference-application-row"
                  key={application.name}
                >
                  <div>
                    <strong>{application.name}</strong>
                    <small>
                      {application.className} · {application.date}
                    </small>
                  </div>
                  <span
                    className={
                      'reference-status ' +
                      (application.status === 'Approved' ||
                      application.status === 'Enrolled'
                        ? 'reference-status-approved'
                        : 'reference-status-pending')
                    }
                  >
                    {application.status}
                  </span>
                  <button
                    aria-label={'Open ' + application.name}
                    className="reference-round-action"
                    onClick={() =>
                      setNotice(application.name + ' application preview.')
                    }
                    type="button"
                  >
                    <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {(module === 'finance' || module === 'fees') && (
        <section className="reference-module-section">
          <div className="reference-mini-metrics">
            {[
              ['Collected', 'Rs 12.4L', '82% target'],
              ['Pending', 'Rs 1.8L', '46 students'],
              ['Concessions', 'Rs 45K', '12 active'],
            ].map((metric) => (
              <article className="reference-mini-metric" key={metric[0]}>
                <span>{metric[0]}</span>
                <strong>{metric[1]}</strong>
                <small>{metric[2]}</small>
              </article>
            ))}
          </div>
          <div className="reference-panel-heading">
            <h2>Fee Ledger</h2>
            <div>
              <button
                className="reference-outline-button"
                onClick={() => setNotice('Ledger filter preview opened.')}
                type="button"
              >
                Filter
              </button>{' '}
              <button
                className="reference-quick-action"
                onClick={() => setNotice('CSV export preview ready.')}
                type="button"
              >
                <Download size={13} /> Export
              </button>
            </div>
          </div>
          <div className="reference-table-wrap">
            <table className="reference-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {demoStudents.slice(0, 5).map((student, index) => (
                  <tr key={student.name}>
                    <td>{student.name}</td>
                    <td>{student.className}</td>
                    <td>{student.fee}</td>
                    <td className="reference-money-positive">
                      {feeStatus[index]}
                    </td>
                    <td>
                      {feeStatus[index] === 'Paid' ? 'Rs 0' : 'Rs 22,000'}
                    </td>
                    <td>
                      <button
                        className="reference-mini-pill"
                        onClick={() => {
                          setFeeStatus((rows) =>
                            rows.map((status, i) =>
                              i === index ? 'Paid' : status,
                            ),
                          );
                          setNotice('Payment marked in local preview only.');
                        }}
                        type="button"
                      >
                        {feeStatus[index] === 'Paid' ? 'Receipt' : 'Collect'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {module === 'concessions' && (
        <section className="reference-module-section">
          <div className="reference-module-toolbar">
            <span>Approved fee concessions</span>
            <button
              className="reference-quick-action"
              onClick={() => setShowConcessionForm((open) => !open)}
              type="button"
            >
              <Plus size={14} /> Add Concession
            </button>
          </div>
          {showConcessionForm && (
            <form
              className="reference-concession-form"
              onSubmit={(event) => {
                event.preventDefault();
                setConcessions((rows) => [
                  ...rows,
                  {
                    student: concessionStudent,
                    type: 'Merit',
                    amount: concessionAmount.startsWith('Rs')
                      ? concessionAmount
                      : 'Rs ' + concessionAmount,
                    percent: '10%',
                    approved: 'Preview · Local only',
                  },
                ]);
                setShowConcessionForm(false);
                setConcessionStudent('');
                setConcessionAmount('');
                setNotice(
                  'Concession added to this preview only; no finance record was changed.',
                );
              }}
            >
              <input
                aria-label="Concession student"
                onChange={(event) => setConcessionStudent(event.target.value)}
                placeholder="Student name"
                required
                value={concessionStudent}
              />
              <input
                aria-label="Concession amount"
                onChange={(event) => setConcessionAmount(event.target.value)}
                placeholder="Amount (PKR)"
                required
                value={concessionAmount}
              />
              <button className="reference-quick-action" type="submit">
                Add to preview
              </button>
            </form>
          )}
          <div className="reference-table-wrap">
            <table className="reference-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>%</th>
                  <th>Approved by</th>
                </tr>
              </thead>
              <tbody>
                {concessions.map((concession) => (
                  <tr key={concession.student + concession.amount}>
                    <td>{concession.student}</td>
                    <td>{concession.type}</td>
                    <td>{concession.amount}</td>
                    <td>{concession.percent}</td>
                    <td>{concession.approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(module === 'communications' || module === 'messages') && (
        <section className="reference-message-inbox">
          <div className="reference-message-list">
            <div className="reference-panel-heading">
              <h2>Inbox · {3 + sentMessages.length}</h2>
              <span>Admin view</span>
            </div>
            {[
              'Parent · Rajesh Sharma',
              'Accountant · Meena',
              'Teacher · Sunita Rao',
            ].map((thread, index) => (
              <button
                className={
                  activeThread === index
                    ? 'reference-message-thread is-active'
                    : 'reference-message-thread'
                }
                key={thread}
                onClick={() => setActiveThread(index)}
                type="button"
              >
                <strong>{thread}</strong>
                <small>
                  {
                    [
                      'Admission query',
                      'Daily collection report',
                      'Attendance issue · 9-B',
                    ][index]
                  }
                </small>
                <span>{['Privacy', 'Finance', 'Academic'][index]}</span>
              </button>
            ))}
          </div>
          <div className="reference-message-conversation">
            <div className="reference-panel-heading">
              <h2>
                {
                  [
                    'Parent · Rajesh Sharma',
                    'Accountant · Meena',
                    'Teacher · Sunita Rao',
                  ][activeThread]
                }
              </h2>
              <span>Private thread preview</span>
            </div>
            <div className="reference-chat-bubble reference-chat-in">
              {
                [
                  'Hello, I wanted to check about the admission query.',
                  'The daily collection report is ready for review.',
                  'Could we discuss the attendance issue in class 9-B?',
                ][activeThread]
              }
            </div>
            <div className="reference-chat-bubble reference-chat-out">
              {sentMessages.length
                ? sentMessages[sentMessages.length - 1]
                : 'Thanks for reaching out. We will review this and reply within today.'}
            </div>
            <form
              className="reference-message-compose"
              onSubmit={(event) => {
                event.preventDefault();
                if (messageDraft.trim()) {
                  setSentMessages((rows) => [...rows, messageDraft.trim()]);
                  setMessageDraft('');
                  setNotice('Message sent in local preview only.');
                }
              }}
            >
              <input
                aria-label="Write message"
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Write a message..."
                value={messageDraft}
              />
              <button className="reference-quick-action" type="submit">
                Send
              </button>
            </form>
          </div>
        </section>
      )}

      {module === 'reports' && (
        <section className="reference-report-grid">
          {[
            ['Student Report', 'Full directory, guardian linkage'],
            ['Attendance Report', 'Class-wise, weekly/monthly'],
            ['Fee Collection Report', 'Collected, pending, daily'],
            ['Defaulter Report', '>30 days pending'],
            ['Admission Report', 'Pending, approved, enrolled'],
            ['Performance Report', 'Marks, average, subject-wise'],
          ].map((report) => (
            <article className="reference-report-card" key={report[0]}>
              <span className="reference-report-icon">
                <ChartNoAxesColumnIncreasing size={16} />
              </span>
              <strong>{report[0]}</strong>
              <small>{report[1]}</small>
              <div>
                <button
                  className="reference-outline-button"
                  onClick={() => setNotice(report[0] + ' preview opened.')}
                  type="button"
                >
                  Preview
                </button>
                <button
                  className="reference-quick-action"
                  onClick={() => {
                    const csv =
                      'Report,Status\r\n' + report[0] + ',Preview only\r\n';
                    const blob = new Blob([csv], {
                      type: 'text/csv;charset=utf-8',
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'sample-report-preview.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                    setNotice(
                      'Sample CSV downloaded from the preview; no college records were exported.',
                    );
                  }}
                  type="button"
                >
                  <Download size={12} /> Export
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {(module === 'settings' || module === 'results') && (
        <section className="reference-module-section">
          {module === 'settings' ? (
            <>
              <div
                className="reference-tabs"
                role="group"
                aria-label="Settings section"
              >
                {[
                  'Institute Info',
                  'Classes & Sections',
                  'Fee Structure',
                  'Roles & Permissions',
                ].map((tab) => (
                  <button
                    aria-pressed={settingsTab === tab}
                    className={settingsTab === tab ? 'is-active' : ''}
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    type="button"
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <form
                className="reference-settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNotice(
                    settingsTab +
                      ' preview changes are local only and were not saved.',
                  );
                }}
              >
                <label>
                  Institute name
                  <input defaultValue="Sunrise Public School" />
                </label>
                <label>
                  Address
                  <input defaultValue="Punjab, Pakistan" />
                </label>
                <div className="reference-form-row">
                  <label>
                    Academic year
                    <input defaultValue="2026-27" />
                  </label>
                  <label>
                    Contact
                    <input defaultValue="+92 300 0000000" />
                  </label>
                </div>
                <div className="reference-form-footer">
                  <span>Preview values only.</span>
                  <button className="reference-quick-action" type="submit">
                    Save Preview
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="reference-result-list">
              {[
                ['Mathematics', '92 / 100', 'A'],
                ['Science', '88 / 100', 'A'],
                ['English', '90 / 100', 'A'],
              ].map((result) => (
                <article className="reference-result-row" key={result[0]}>
                  <strong>{result[0]}</strong>
                  <span>{result[1]}</span>
                  <b>{result[2]}</b>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {module !== 'students' &&
        module !== 'guardians' &&
        module !== 'staff' &&
        module !== 'attendance' &&
        module !== 'homework' &&
        module !== 'examinations' &&
        module !== 'admissions' &&
        module !== 'finance' &&
        module !== 'fees' &&
        module !== 'concessions' &&
        module !== 'communications' &&
        module !== 'messages' &&
        module !== 'reports' &&
        module !== 'settings' &&
        module !== 'results' && (
          <section className="reference-module-section">
            <h2>Workspace module</h2>
            <p>
              This route is part of the UI preview plan. No records are loaded
              or saved.
            </p>
            {navigateLink(base)}
          </section>
        )}

      <p className="reference-preview-footnote">
        Development preview only. These sample interactions do not call the
        college API or save records.
      </p>
    </main>
  );
}
