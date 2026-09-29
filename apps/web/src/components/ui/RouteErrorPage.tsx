import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ErrorState } from './States.js';

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || 'Page unavailable'}`
    : 'This page could not be loaded. Try again or return to the workspace.';

  return (
    <main className="fatal-error-page">
      <ErrorState title="Page unavailable" description={message} />
      <Link className="text-link" to="/platform">
        Return to workspace
      </Link>
    </main>
  );
}
