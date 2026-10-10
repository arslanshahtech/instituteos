import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { StaffForm } from './StaffForm.js';
import type { StaffInput, StaffRecord } from './staff-api.js';
import {
  StaffAccess,
  StaffHeading,
  StaffStatusBadge,
  apiMessage,
  campusName,
  useCampusChoices,
  useOrganizationAccess,
} from './StaffPageShared.js';
import { useCreateStaff, useStaff, useUpdateStaff } from './staff-queries.js';

export function StaffDetailPage() {
  const { organizationId = '', staffId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const staff = useStaff(
    organizationId,
    staffId,
    Boolean(access.data?.permissions.includes('staff.read')),
  );

  if (access.isPending)
    return <LoadingState message="Checking staff access..." />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="Staff access could not be verified for this organization."
        onRetry={() => void access.refetch()}
      />
    );
  if (!access.data.permissions.includes('staff.read'))
    return <PermissionDeniedState />;
  if (staff.isPending)
    return <LoadingState message="Loading staff member..." />;
  if (staff.isError)
    return (
      <ErrorState
        title="Staff member unavailable"
        description={apiMessage(staff.error)}
        onRetry={() => void staff.refetch()}
      />
    );

  const person: StaffRecord = staff.data.staff;
  const canUpdate = access.data.permissions.includes('staff.update');
  const campusChoices = campuses.data?.campuses ?? [];

  return (
    <main className="page-stack student-management-page staff-management-page">
      <StaffHeading
        action={
          canUpdate ? (
            <Link
              className="button button-primary"
              to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffId)}/edit`}
            >
              Edit staff member
            </Link>
          ) : undefined
        }
        description="Staff profile, contact and employment information."
        organizationId={organizationId}
        title={`${person.firstName} ${person.lastName}`}
      />
      <section className="student-detail-panel panel">
        <div className="student-detail-heading">
          <h2>Profile & employment</h2>
          <StaffStatusBadge status={person.status} />
        </div>
        <dl className="student-details staff-details">
          <div>
            <dt>Employee code</dt>
            <dd>{person.employeeCode || '—'}</dd>
          </div>
          <div>
            <dt>Designation / role</dt>
            <dd>{person.designation ?? person.role ?? '—'}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{person.department || '—'}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName(person.campusId, campusChoices)}</dd>
          </div>
          <div>
            <dt>Contact email</dt>
            <dd>{person.email || '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{person.phone || '—'}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{person.dateOfBirth?.slice(0, 10) || '—'}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{person.gender || '—'}</dd>
          </div>
          <div>
            <dt>Qualification</dt>
            <dd>{person.qualification || '—'}</dd>
          </div>
          <div>
            <dt>Additional qualifications</dt>
            <dd>{person.qualifications?.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Subjects / specialization</dt>
            <dd>{person.subjects?.join(', ') || '—'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export function StaffCreatePage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const mutation = useCreateStaff(organizationId);
  const { showToast } = useToast();

  const submit = (input: StaffInput) => {
    mutation.mutate(input, {
      onSuccess: ({ staff }) => {
        showToast('Staff member created successfully.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staff.id)}`,
        );
      },
    });
  };

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.create"
    >
      {(organizationAccess) => (
        <main className="page-stack student-management-page staff-management-page">
          <StaffHeading
            description="Add an employee or teacher record to this organization."
            organizationId={organizationId}
            title="Add staff member"
          />
          <section className="student-form-panel panel">
            <StaffForm
              campusError={
                campuses.isError ? apiMessage(campuses.error) : undefined
              }
              campuses={campuses.data?.campuses ?? []}
              canAssignCampus={organizationAccess.permissions.includes(
                'campus.read',
              )}
              campusRequired={organizationAccess.role === 'campus_admin'}
              isSaving={mutation.isPending}
              onSubmit={submit}
              saveError={
                mutation.isError ? apiMessage(mutation.error) : undefined
              }
            />
          </section>
        </main>
      )}
    </StaffAccess>
  );
}

export function StaffEditPage() {
  const { organizationId = '', staffId = '' } = useParams();
  const navigate = useNavigate();
  const access = useOrganizationAccess(organizationId);
  const campuses = useCampusChoices(organizationId, access.data);
  const staff = useStaff(
    organizationId,
    staffId,
    Boolean(access.data?.permissions.includes('staff.update')),
  );
  const mutation = useUpdateStaff(organizationId, staffId);
  const { showToast } = useToast();

  const submit = (input: StaffInput) => {
    mutation.mutate(input, {
      onSuccess: () => {
        showToast('Staff changes saved.');
        navigate(
          `/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffId)}`,
        );
      },
    });
  };

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.update"
    >
      {(organizationAccess) =>
        staff.isPending ? (
          <LoadingState message="Loading staff member..." />
        ) : staff.isError ? (
          <ErrorState
            title="Staff member unavailable"
            description={apiMessage(staff.error)}
            onRetry={() => void staff.refetch()}
          />
        ) : (
          <main className="page-stack student-management-page staff-management-page">
            <StaffHeading
              description="Update this staff profile and employment record."
              organizationId={organizationId}
              title={`Edit ${staff.data.staff.firstName} ${staff.data.staff.lastName}`}
            />
            <section className="student-form-panel panel">
              <StaffForm
                staff={staff.data.staff}
                campusError={
                  campuses.isError ? apiMessage(campuses.error) : undefined
                }
                campuses={campuses.data?.campuses ?? []}
                canAssignCampus={organizationAccess.permissions.includes(
                  'campus.read',
                )}
                campusRequired={organizationAccess.role === 'campus_admin'}
                isSaving={mutation.isPending}
                onSubmit={submit}
                saveError={
                  mutation.isError ? apiMessage(mutation.error) : undefined
                }
              />
            </section>
          </main>
        )
      }
    </StaffAccess>
  );
}
