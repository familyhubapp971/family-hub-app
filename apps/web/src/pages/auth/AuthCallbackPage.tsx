import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { AuthLayout } from './AuthLayout';

// OAuth landing page. Supabase's JS client (with detectSessionInUrl)
// pulls the session out of the URL hash on import — we just wait for
// the AuthProvider to flip from loading → session, then redirect.
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate('/dashboard', { replace: true });
    } else {
      // No session means OAuth failed or was cancelled. Bounce to login
      // so the user can retry instead of being stuck on a blank screen.
      navigate('/login', { replace: true });
    }
  }, [loading, session, navigate]);

  return (
    <AuthLayout title="Signing you in…">
      <p className="font-body text-sm text-gray-700" data-testid="auth-callback">
        Hold tight — finishing up your login.
      </p>
    </AuthLayout>
  );
}
