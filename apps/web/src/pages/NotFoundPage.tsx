import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/States.js';

export function NotFoundPage() {
  return (
    <section className="panel not-found-panel">
      <EmptyState
        title="This page is not available"
        description="The route may have changed or may not be part of this foundation preview."
        action={
          <Link className="button button-secondary" to="..">
            Return to overview
          </Link>
        }
      />
    </section>
  );
}
