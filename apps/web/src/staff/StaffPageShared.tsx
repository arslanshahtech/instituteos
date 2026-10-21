import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { ApiError } from '../api/client.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { getCampuses } from '../organizations/organizations-api.js';
import type { Campus } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { OrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { StaffStatus } from './staff-api.js';

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const rows = error.details?.rows ?? [];
    if (rows.length) {
      return `${error.message} ${rows.map((row) => `Row ${row.row} (${row.field}): ${row.message}`).join(' ')}`;
    }
    return error.message;
  }
  return 'The request could not be completed. Try again.';
}

export function useOrganizationAccess(organizationId: string) {
  return useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
}

export function useCampusChoices(
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

export function StaffAccess({
  loading,
  error,
  access,
  requiredPermission,
  onRetry,
  children,
}: {
  loading: boolean;
  error: Error | null;
  access?: OrganizationAccessContext;
  requiredPermission: string;
  onRetry: () => void;
  children: (access: OrganizationAccessContext) => ReactNode;
}) {
  if (loading) return <LoadingState message="Checking staff access..." />;
  if (error || !access)
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          error
            ? apiMessage(error)
            : 'Staff access could not be verified for this organization.'
        }
        onRetry={onRetry}
      />
    );
  if (!access.permissions.includes(requiredPermission))
    return <PermissionDeniedState />;
  return children(access);
}

export function StaffHeading({
  title,
  description,
  organizationId,
  action,
  eyebrow = 'Organization workspace',
}: {
  title: string;
  description: string;
  organizationId: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <WorkspacePageHeading
      className="student-page-heading"
      eyebrow={eyebrow}
      title={title}
      description={description}
      aside={
        <div className="student-page-actions">
          <Link
            className="button button-secondary"
            to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
          >
            Staff directory
          </Link>
          {action}
        </div>
      }
    />
  );
}

export function campusName(campusId: string | undefined, campuses: Campus[]) {
  if (!campusId) return 'Organization-wide';
  return (
    campuses.find((campus) => campus.id === campusId)?.name ?? 'Assigned campus'
  );
}

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span
      className={`status-badge ${status === 'active' ? 'status-positive' : 'status-negative'}`}
    >
      {status === 'on_leave'
        ? 'On leave'
        : status === 'inactive'
          ? 'Inactive'
          : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
