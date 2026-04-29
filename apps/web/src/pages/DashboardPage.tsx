import { useState } from 'react';
import { Button, Card } from '@familyhub/ui';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

// Stub authenticated landing — proves the protected-route + session
// wiring end-to-end. Real dashboard lands in Sprint 1.
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onLogout() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // onAuthStateChange will already null out the session, but route
    // explicitly so we don't depend on render-order timing.
    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl border-4 border-white p-8 text-gray-900 shadow-neo-lg">
        <h1 className="font-display text-4xl text-kingdom-bg">Dashboard</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          You&apos;re signed in. Sprint 1 lights this surface up.
        </p>

        <Card className="mt-6 border-2 border-black p-4 shadow-neo-sm">
          <h2 className="font-display text-lg">Session</h2>
          <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 font-body text-sm">
            <dt className="font-semibold">Email</dt>
            <dd data-testid="dashboard-email">{user?.email ?? '—'}</dd>
            <dt className="font-semibold">User ID</dt>
            <dd className="break-all font-mono text-xs">{user?.id ?? '—'}</dd>
          </dl>
        </Card>

        <div className="mt-6">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onLogout}
            disabled={signingOut}
            testId="dashboard-logout"
          >
            {signingOut ? 'Signing out…' : 'Log out'}
          </Button>
        </div>
      </Card>
    </main>
  );
}
