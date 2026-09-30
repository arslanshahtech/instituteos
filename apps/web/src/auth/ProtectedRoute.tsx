import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.js';
import { ErrorState, LoadingState } from '../components/ui/States.js';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return (
      <main className="auth-bootstrap">
        <LoadingState message="Checking your session…" />
      </main>
    );
  }
  if (auth.status === 'error') {
    return (
      <main className="auth-bootstrap">
        <ErrorState
          title="Unable to check your session"
          description="The account service could not be reached. Try again."
          onRetry={() => void auth.retryBootstrap()}
        />
      </main>
    );
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
