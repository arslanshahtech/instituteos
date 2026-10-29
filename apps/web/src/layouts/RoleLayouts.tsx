import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { AppShell } from '../components/layout/AppShell.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { getPlatformOrganizations } from '../pages/platform-api.js';
import { getRoleLayout } from './layoutTypes.js';
import type { RoleLayoutConfig } from './layoutTypes.js';

function RoleLayout({ config }: { config: RoleLayoutConfig }) {
  return <AppShell role={config} />;
}

export function PlatformLayout() {
  const access = useQuery({
    queryKey: ['platform', 'organizations'],
    queryFn: getPlatformOrganizations,
    retry: false,
    staleTime: 30_000,
  });

  if (access.isPending) {
    return (
      <main className="auth-bootstrap">
        <LoadingState message="Verifying platform administrator access…" />
      </main>
    );
  }

  if (access.isError) {
    if (access.error instanceof ApiError && access.error.status === 401) {
      return <Navigate to="/login" replace />;
    }
    if (access.error instanceof ApiError && access.error.status === 403) {
      return (
        <main className="auth-bootstrap">
          <PermissionDeniedState
            title="Platform access required"
            description="This workspace is restricted to authorized InstituteOS platform administrators. Your account has not been granted this role."
          />
          <p>
            <Link to="/dashboard">Return to your assigned workspace</Link>
          </p>
        </main>
      );
    }
    return (
      <main className="auth-bootstrap">
        <ErrorState
          title="Unable to verify platform access"
          description="The access service could not be reached. No platform workspace has been opened. Please try again."
          onRetry={() => void access.refetch()}
        />
      </main>
    );
  }

  return <RoleLayout config={getRoleLayout('platform')} />;
}

export function AdminLayout() {
  return <RoleLayout config={getRoleLayout('admin')} />;
}

export function TeacherLayout() {
  return <RoleLayout config={getRoleLayout('teacher')} />;
}

export function AccountantLayout() {
  return <RoleLayout config={getRoleLayout('accountant')} />;
}

export function StudentLayout() {
  return <RoleLayout config={getRoleLayout('student')} />;
}

export function ParentLayout() {
  return <RoleLayout config={getRoleLayout('parent')} />;
}
