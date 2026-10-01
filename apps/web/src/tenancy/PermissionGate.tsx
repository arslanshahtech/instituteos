import type { ReactNode } from 'react';
import { PermissionDeniedState } from '../components/ui/States.js';

export function PermissionGate({
  permissions,
  requiredPermission,
  children,
}: {
  permissions: readonly string[];
  requiredPermission: string;
  children: ReactNode;
}) {
  if (!permissions.includes(requiredPermission))
    return <PermissionDeniedState />;
  return children;
}
