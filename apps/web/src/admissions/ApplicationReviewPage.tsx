import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getCampuses } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { useApplication, useReviewApplication } from './admissions-queries.js';
import type { ApplicationStatus } from './admissions-api.js';

const reviewActions: Partial<
  Record<ApplicationStatus, { status: ApplicationStatus; label: string }[]>
> = {
  draft: [
    { status: 'submitted', label: 'Submit for review' },
    { status: 'rejected', label: 'Reject application' },
  ],
  submitted: [
    { status: 'in_review', label: 'Start review' },
    { status: 'approved', label: 'Approve application' },
    { status: 'rejected', label: 'Reject application' },
  ],
  in_review: [
    { status: 'approved', label: 'Approve application' },
    { status: 'rejected', label: 'Reject application' },
  ],
  approved: [{ status: 'admitted', label: 'Mark as admitted' }],
};

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.requestId
      ? `${error.message} (Reference: ${error.requestId})`
      : error.message;
  }
  return 'The request could not be completed. Try again.';
}

function statusLabel(status: ApplicationStatus) {
  const labels: Record<ApplicationStatus, string> = {
    draft: 'Draft',
    submitted: 'Pending',
    in_review: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
    admitted: 'Admitted',
  };
  return labels[status];
}

export function ApplicationReviewPage() {
  const { organizationId = '', applicationId = '' } = useParams();
  const { showToast } = useToast();
  const [decisionReason, setDecisionReason] = useState('');
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const campuses = useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(access.data?.permissions.includes('campus.read')),
    retry: false,
  });
  const canRead = access.data?.permissions.includes('admission.read') ?? false;
  const canReview =
    access.data?.permissions.includes('admission.review') ?? false;
  const application = useApplication(
    organizationId,
    applicationId,
    Boolean(canRead),
  );
  const review = useReviewApplication(organizationId, applicationId);

  if (access.isPending)
    return <LoadingState message="Checking admissions access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description={apiMessage(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;
  if (application.isPending)
    return <LoadingState message="Loading application…" />;
  if (application.isError || !application.data)
    return (
      <ErrorState
        title="Could not load application"
        description={apiMessage(application.error)}
        onRetry={() => void application.refetch()}
      />
    );

  const record = application.data.application;
  const canCreateStudent = access.data.permissions.includes('student.create');
  const actions = canReview
    ? record.status === 'approved' && !record.convertedStudentId && canCreateStudent
      ? [{ status: 'approved' as ApplicationStatus, label: 'Create missing student record' }]
      : (reviewActions[record.status] ?? []).filter(
          (action) => action.status !== 'approved' || canCreateStudent,
        )
    : [];
  const needsCampusForApproval = actions.some((action) => action.status === 'approved');
  const assignedCampusId = selectedCampusId || record.campusId;
  const studentPath = record.convertedStudentId
    ? `/admin/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(record.convertedStudentId)}`
    : undefined;

  function transition(status: ApplicationStatus) {
    review.mutate(
      {
        status,
        ...(status === 'approved' && assignedCampusId ? { campusId: assignedCampusId } : {}),
        ...(decisionReason.trim()
          ? { decisionReason: decisionReason.trim() }
          : {}),
      },
      {
        onSuccess: (result) => {
          showToast(
            status === 'approved'
              ? 'Application approved and student record created.'
              : `Application marked ${statusLabel(status).toLowerCase()}.`,
          );
          if (status === 'approved' && result.student) {
            setDecisionReason('');
          }
        },
      },
    );
  }

  return (
    <main className="page-stack student-management-page reference-live-module">
      <WorkspacePageHeading
        className="student-page-heading"
        eyebrow="Application review"
        title={`${record.firstName} ${record.lastName}`}
        description="Review applicant information and record an admissions decision."
        aside={(
          <div className="student-page-actions">
            <Link
              className="button button-secondary"
              to={`/admin/organizations/${encodeURIComponent(organizationId)}/admissions`}
            >
              Back to admissions
            </Link>
          </div>
        )}
      />

      <section className="student-detail-panel panel">
        <div className="student-detail-heading">
          <h2>Applicant information</h2>
          <span className="status-badge">{statusLabel(record.status)}</span>
        </div>
        <dl className="student-details">
          <div>
            <dt>Applicant</dt>
            <dd>
              {record.firstName} {record.lastName}
            </dd>
          </div>
          <div>
            <dt>Contact email</dt>
            <dd>{record.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{record.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Program / grade</dt>
            <dd>{record.program ?? '—'}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{record.dateOfBirth ?? '—'}</dd>
          </div>
          <div>
            <dt>Guardian</dt>
            <dd>{record.guardianName ?? '—'}</dd>
          </div>
          <div>
            <dt>Guardian phone</dt>
            <dd>{record.guardianPhone ?? '—'}</dd>
          </div>
          <div>
            <dt>Fee plan</dt>
            <dd>{record.feePlan ?? '—'}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd className="admissions-campus-tag">
              {!record.campusId
                ? '—'
                : (campuses.data?.campuses.find(
                    (campus) => campus.id === record.campusId,
                  )?.name ?? 'Assigned campus')}
            </dd>
          </div>
          <div>
            <dt>Application received</dt>
            <dd>{new Date(record.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt>Applicant notes</dt>
            <dd>{record.notes || '—'}</dd>
          </div>
          {record.decisionReason && (
            <div>
              <dt>Decision note</dt>
              <dd>{record.decisionReason}</dd>
            </div>
          )}
        </dl>
        {studentPath && (
          <p>
            <Link className="student-name-link" to={studentPath}>
              View converted student
            </Link>
          </p>
        )}
      </section>

      {canReview && actions.length > 0 && (
        <section className="student-form-panel panel">
          <div className="student-detail-heading">
            <h2>Review decision</h2>
          </div>
          {needsCampusForApproval && (
            <label className="form-field" htmlFor="approvalCampusId">
              <span>Assign campus before approval</span>
              <select
                id="approvalCampusId"
                value={assignedCampusId ?? ''}
                onChange={(event) => setSelectedCampusId(event.target.value)}
                required
              >
                <option value="">Select campus</option>
                {(campuses.data?.campuses ?? []).map((campus) => (
                  <option key={campus.id} value={campus.id}>{campus.name}</option>
                ))}
              </select>
              <small className="muted-copy">Approval creates the student record in this campus. Other missing profile details can be completed later.</small>
              {campuses.isError && <span className="field-error" role="alert">{apiMessage(campuses.error)}</span>}
            </label>
          )}
          <label className="form-field" htmlFor="decisionReason">
            <span>Decision note (optional)</span>
            <textarea
              id="decisionReason"
              maxLength={400}
              onChange={(event) => setDecisionReason(event.target.value)}
              value={decisionReason}
              rows={3}
            />
          </label>
          {review.isError && (
            <p className="form-error" role="alert">
              {apiMessage(review.error)}
            </p>
          )}
          <div className="button-row">
            {actions.map((action) => (
              <Button
                disabled={review.isPending || (action.status === 'approved' && !assignedCampusId)}
                key={action.status}
                onClick={() => transition(action.status)}
                variant={action.status === 'rejected' ? 'danger' : 'primary'}
              >
                {review.isPending ? 'Saving…' : action.label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
