import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import { useAuth } from '../auth/AuthProvider.js';
import { PermissionGate } from '../tenancy/PermissionGate.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';

export function OrganizationContextPage() {
  const { organizationId = '' } = useParams();
  const auth = useAuth();
  const context = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });

  if (context.isPending)
    return <LoadingState message="Checking organization access…" />;
  if (context.isError || !context.data)
    return (
      <ErrorState
        title="Organization context unavailable"
        description="This organization context could not be loaded for your account."
      />
    );

  return (
    <main className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Organization access</p>
          <h1>Current organization context</h1>
          <p className="page-description">
            Signed in as {auth.user?.displayName ?? 'current user'}.
          </p>
        </div>
      </section>
      <PermissionGate
        permissions={context.data.permissions}
        requiredPermission="organization.read"
      >
        <section className="foundation-note" aria-label="Organization context">
          <p>Role: {context.data.role.replaceAll('_', ' ')}</p>
          <p>Organization: {context.data.organizationId}</p>
          <p>
            Permissions shown here guide the interface only. The API verifies
            membership and permissions for every protected operation.
          </p>
        </section>
      </PermissionGate>
    </main>
  );
}
