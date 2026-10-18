import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { LoadingState } from '../components/ui/States.js';
import { getAccessibleOrganizations } from '../organizations/organizations-api.js';
import { getPlatformOrganizations } from './platform-api.js';
import '../styles/workspace-redirect.css';

type RedirectState = { destination: string } | { message: string } | null;

function pathForRole(role: string, organizationId: string) {
  const encodedId = encodeURIComponent(organizationId);
  if (
    [
      'organization_owner',
      'organization_admin',
      'campus_admin',
      'principal_director',
      'academic_coordinator',
    ].includes(role)
  )
    return '/admin/organizations/' + encodedId;
  if (role === 'teacher') return '/teacher/organizations/' + encodedId;
  if (role === 'accountant_finance_officer')
    return '/accountant/organizations/' + encodedId;
  if (role === 'parent_guardian') return '/parent/organizations/' + encodedId;
  if (role === 'student') return '/student/organizations/' + encodedId;
  return null;
}

export function WorkspaceRedirectPage() {
  const [state, setState] = useState<RedirectState>(null);

  useEffect(() => {
    let active = true;
    async function resolve() {
      try {
        await getPlatformOrganizations();
        if (active) setState({ destination: '/super-admin' });
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 403) {
          if (active)
            setState({
              message:
                'We could not verify your workspace permissions. Please try again or contact support.',
            });
          return;
        }
      }
      try {
        const result = await getAccessibleOrganizations();
        const organization = result.organizations.find(
          (item) => item.status === 'active',
        );
        if (organization) {
          const destination = pathForRole(organization.role, organization.id);
          if (destination) {
            if (active) setState({ destination });
            return;
          }
        }
        if (active)
          setState({
            message:
              'Your account is signed in, but no active workspace has been assigned yet. Ask your institute administrator for an invitation.',
          });
      } catch {
        if (active)
          setState({
            message:
              'We could not load your assigned workspace. Please try again.',
          });
      }
    }
    void resolve();
    return () => {
      active = false;
    };
  }, []);

  if (!state)
    return (
      <main className="auth-bootstrap">
        <LoadingState message="Finding your authorized workspace…" />
      </main>
    );
  if ('destination' in state)
    return <Navigate to={state.destination} replace />;
  return (
    <main className="workspace-unassigned">
      <div className="workspace-unassigned-card">
        <span className="workspace-unassigned-mark">I</span>
        <p className="eyebrow">InstituteOS</p>
        <h1>No workspace assigned</h1>
        <p>{state.message}</p>
        <Link className="button button-primary" to="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
