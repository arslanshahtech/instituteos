import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, CircleAlert } from 'lucide-react';
import { getApiHealth } from '../api/client.js';
import { useOutletContext } from 'react-router-dom';
import type { RoleLayoutConfig } from '../layouts/layoutTypes.js';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui/States.js';

export function OverviewPage() {
  const { role } = useOutletContext<{ role: RoleLayoutConfig }>();
  const healthQuery = useQuery({
    queryKey: ['system', 'health'],
    queryFn: getApiHealth,
  });

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{role.label} · Layout preview</p>
          <h1>{role.workspaceTitle}</h1>
          <p className="page-description">{role.description}</p>
        </div>
      </section>

      <section aria-labelledby="welcome-heading" className="welcome-panel">
        <div className="welcome-copy">
          <p className="eyebrow">Welcome to InstituteOS</p>
          <h2 id="welcome-heading">
            A considered foundation for education operations.
          </h2>
          <p>
            Your workspace shell is ready. Shared navigation, page patterns, and
            a central API connection are in place for future product work.
          </p>
          <Link
            className="text-link text-link-arrow"
            to={`/${role.key}/foundations`}
          >
            Explore UI foundations <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div aria-hidden="true" className="welcome-mark">
          <span className="welcome-mark-inner">I</span>
        </div>
      </section>

      <section aria-labelledby="system-heading" className="panel system-panel">
        <div className="panel-heading">
          <div>
            <h2 id="system-heading">System connection</h2>
            <p>Live status from the InstituteOS API.</p>
          </div>
          {healthQuery.isSuccess && (
            <span className="status-badge status-positive">
              <Check size={14} aria-hidden="true" />
              Connected
            </span>
          )}
          {healthQuery.isError && (
            <span className="status-badge status-negative">
              <CircleAlert size={14} aria-hidden="true" />
              Unavailable
            </span>
          )}
        </div>
        {healthQuery.isPending && (
          <LoadingState message="Checking API connection…" />
        )}
        {healthQuery.isError && (
          <ErrorState
            title="The API did not respond"
            description="Check that the backend is running, then retry the connection."
            onRetry={() => void healthQuery.refetch()}
          />
        )}
        {healthQuery.data && (
          <div className="connection-detail">
            <span className="connection-dot" aria-hidden="true" />
            <span>{healthQuery.data.service}</span>
            <span className="connection-separator" aria-hidden="true">
              ·
            </span>
            <span>Versioned API</span>
          </div>
        )}
      </section>

      <section className="foundation-note" aria-label="Product phase note">
        <span className="foundation-note-line" aria-hidden="true" />
        <p>
          Business workspaces will be introduced in later phases. This preview
          contains layout and shared interface foundations only.
        </p>
      </section>
    </div>
  );
}
