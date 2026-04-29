import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// Gate around an authenticated subtree. Renders a small loading state
// while the AuthProvider rehydrates the session from localStorage so
// signed-in users don't see a redirect-to-login flash on hard reload.
export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main
        className="flex min-h-full items-center justify-center px-4 py-10"
        data-testid="protected-loading"
      >
        <p className="font-body text-sm text-gray-600">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
