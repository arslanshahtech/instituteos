import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ErrorState } from './States.js';

export function RouteErrorPage() {
  const error = useRouteError();
  const isHttpError = isRouteErrorResponse(error);
  const debugDetails =
    error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : isHttpError
        ? `${error.status} ${error.statusText}\n${JSON.stringify(error.data ?? null, null, 2)}`
        : String(error ?? 'Unknown route error');
  const message = isHttpError
    ? `${error.status} ${error.statusText || 'Page unavailable'}`
    : import.meta.env.DEV
      ? debugDetails.split('\n')[0]
      : 'This page could not be loaded. Try again or return to the workspace.';

  if (import.meta.env.DEV) console.error('[InstituteOS route error]', error);

  return (
    <main className="fatal-error-page">
      <ErrorState title="Page unavailable" description={message} />
      {import.meta.env.DEV ? (
        <details style={{ maxWidth: 720, marginTop: 16, fontSize: 12 }}>
          <summary>Developer details</summary>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {debugDetails}
          </pre>
        </details>
      ) : null}
      <Link className="text-link" to="/platform">
        Return to workspace
      </Link>
    </main>
  );
}
