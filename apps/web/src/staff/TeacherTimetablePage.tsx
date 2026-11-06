import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { getStaff } from './staff-api.js';
import { listTeacherTimetable } from './teacher-timetable-api.js';
import {
  apiMessage,
  StaffAccess,
  useOrganizationAccess,
} from './StaffPageShared.js';

const days = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];

export function TeacherTimetablePage() {
  const { organizationId = '', staffId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canRead = access.data?.permissions.includes('staff.read') ?? false;
  const staff = useQuery({
    queryKey: ['staff', organizationId, staffId],
    queryFn: () => getStaff(organizationId, staffId),
    enabled: canRead && Boolean(staffId),
  });
  const timetable = useQuery({
    queryKey: ['teacher-timetable', organizationId, staffId],
    queryFn: () => listTeacherTimetable(organizationId, staffId),
    enabled: canRead && Boolean(staffId),
  });
  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.read"
    >
      {() => {
        if (staff.isPending)
          return <LoadingState message="Teacher profile load ho rahi hai..." />;
        if (staff.isError || !staff.data)
          return (
            <ErrorState
              title="Teacher unavailable"
              description={apiMessage(staff.error)}
              onRetry={() => void staff.refetch()}
            />
          );
        const teacher = staff.data.staff;
        const entries = timetable.data?.items ?? [];
        return (
          <main className="page-stack student-management-page staff-management-page reference-live-module">
            <WorkspacePageHeading
              className="student-page-heading"
              eyebrow="Teacher & staff"
              title={
                teacher.firstName + ' ' + teacher.lastName + ' — Timetable'
              }
              description="This schedule is generated from the section timetables. Changes made by the academic team appear here automatically."
              aside={
                <div className="student-page-actions">
                  <Link
                    className="button button-secondary"
                    to={
                      '/admin/organizations/' +
                      encodeURIComponent(organizationId) +
                      '/staff/' +
                      encodeURIComponent(staffId)
                    }
                  >
                    View Profile
                  </Link>
                  <Link
                    className="button button-secondary"
                    to={
                      '/admin/organizations/' +
                      encodeURIComponent(organizationId) +
                      '/staff'
                    }
                  >
                    Back to staff
                  </Link>
                </div>
              }
            />
            <section className="student-list-panel panel">
              <div className="student-detail-heading">
                <h2>Weekly timetable</h2>
                <span className="muted-copy">{entries.length} periods</span>
              </div>
              {timetable.isPending ? (
                <LoadingState message="Timetable load ho raha hai..." />
              ) : timetable.isError ? (
                <ErrorState
                  title="Timetable unavailable"
                  description={apiMessage(timetable.error)}
                  onRetry={() => void timetable.refetch()}
                />
              ) : entries.length === 0 ? (
                <p className="muted-copy">
                  Is teacher ke liye abhi section timetable mein koi period
                  assign nahi hua.
                </p>
              ) : (
                <div className="teacher-timetable-list">
                  {days.map((day) => {
                    const dayEntries = entries
                      .filter((entry) => entry.dayOfWeek === day.value)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    if (!dayEntries.length) return null;
                    return (
                      <section
                        className="teacher-timetable-day"
                        key={day.value}
                      >
                        <h3>{day.label}</h3>
                        {dayEntries.map((entry) => (
                          <article
                            className="teacher-timetable-entry"
                            key={entry.id}
                          >
                            <div className="teacher-timetable-time">
                              <strong>
                                {entry.startTime}–{entry.endTime}
                              </strong>
                              <span>{entry.room || 'Room not set'}</span>
                            </div>
                            <div className="teacher-timetable-copy">
                              <strong>
                                {entry.subjectName || 'Scheduled period'}
                              </strong>
                              <span>
                                {entry.sectionName || 'Section'}
                                {entry.academicYearName
                                  ? ' · ' + entry.academicYearName
                                  : ''}
                              </span>
                              {entry.isAdditionalTeacher && (
                                <small>Additional teacher</small>
                              )}
                            </div>
                          </article>
                        ))}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        );
      }}
    </StaffAccess>
  );
}
