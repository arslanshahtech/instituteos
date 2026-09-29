import type { ReactNode } from 'react';
import { CircleAlert, LockKeyhole, RefreshCw } from 'lucide-react';
import { Button } from './Button.js';

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state state-empty">
      <div className="state-icon" aria-hidden="true">
        <span>—</span>
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Try again. If the problem continues, contact support.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon state-icon-error" aria-hidden="true">
        <CircleAlert size={19} />
      </div>
      <div className="state-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function PermissionDeniedState({
  title = 'Access not available',
  description = 'You do not have permission to view this area. Contact your administrator if you need access.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="state state-denied" role="status">
      <div className="state-icon" aria-hidden="true">
        <LockKeyhole size={19} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
