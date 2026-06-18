import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckSquare, Home, LogOut, Sparkles } from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import { clearKidToken, getKidToken } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';

// FHS-257 — kid dashboard shell.
//
// A child who finishes kid-login lands here (the dashboard route admits a
// kid token via ProtectedRoute allowKid). It deliberately shows NONE of
// the parent surface: no profile pill, no Manage Members / Add Child /
// admin links — just a friendly brand, three kid tabs (Today, Tasks,
// Notices) and a big "Switch user" button that drops the kid token and
// returns to the avatar picker.
//
// The kid tabs are placeholders for now; the rich kid experience
// (habits, rewards, kid-scoped data) lands as ChildWorld in FHS-268+.
// This ticket ships the SHAPE + the routing branch + the kid-token
// consumer wiring (it calls GET /api/kid/me to confirm the session).

interface KidTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  blurb: string;
}

const KID_TABS: KidTab[] = [
  {
    id: 'today',
    label: 'Today',
    icon: <Home size={16} aria-hidden="true" />,
    blurb: 'Your day at a glance.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: <CheckSquare size={16} aria-hidden="true" />,
    blurb: 'Things to tick off.',
  },
  {
    id: 'notices',
    label: 'Notices',
    icon: <Bell size={16} aria-hidden="true" />,
    blurb: 'Notes from the family.',
  },
];

const DEFAULT_TAB = 'today';

// FHS-355 — kid Notices tab. Reads the family noticeboard scoped to the kid's
// own tenant (GET /api/kid/notices, kid token). First real kid-facing data feed.
interface KidNotice {
  id: string;
  body: string;
  pinned: boolean;
  authorName: string | null;
  icon: string | null;
  createdAt: string;
}
type KidNoticesState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; notices: KidNotice[] };

function KidNoticesPanel({ kidToken }: { kidToken: string | null }) {
  const [state, setState] = useState<KidNoticesState>({ kind: 'loading' });

  useEffect(() => {
    if (!kidToken) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/kid/notices`, {
      headers: { Authorization: `Bearer ${kidToken}` },
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          setState({ kind: 'error' });
          return;
        }
        const body = (await r.json()) as { notices: KidNotice[] };
        setState({ kind: 'loaded', notices: body.notices ?? [] });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setState({ kind: 'error' });
      });
    return () => ac.abort();
  }, [kidToken]);

  if (state.kind === 'loading') {
    return (
      <p
        data-testid="kid-notices-loading"
        aria-busy="true"
        className="text-sm font-bold text-gray-600"
      >
        Loading notices…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p data-testid="kid-notices-error" role="alert" className="text-sm font-bold text-red-600">
        Couldn&rsquo;t load notices — try again.
      </p>
    );
  }
  if (state.notices.length === 0) {
    return (
      <div data-testid="kid-notices-empty">
        <p aria-hidden="true" className="text-5xl">
          📣
        </p>
        <h2 className="mt-3 font-heading text-2xl text-black">Notices</h2>
        <p className="mt-1 text-sm font-bold text-gray-600">No notices yet — check back soon!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 text-left" data-testid="kid-notices-list">
      <h2 className="text-center font-heading text-2xl text-black">Notices</h2>
      {state.notices.map((n) => (
        <div
          key={n.id}
          data-testid="kid-notice"
          className="rounded-xl border-2 border-black bg-yellow-50 p-4 shadow-neo-sm"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-2xl">
              {n.icon ?? '📣'}
            </span>
            <div>
              <p className="font-bold text-black">{n.body}</p>
              <p className="mt-1 text-xs font-bold text-gray-600">
                {n.authorName ?? 'Family'}
                {n.pinned ? ' · 📌 pinned' : ''}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KidDashboardShell() {
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  const kidToken = useMemo(() => getKidToken(), []);

  // Confirm the kid session against the new consumer endpoint. If the
  // token is gone or rejected, bounce back to kid-login.
  useEffect(() => {
    if (!kidToken) {
      navigate(`/t/${slug}/kid-login`, { replace: true });
      return;
    }
    let cancelled = false;
    const ejectToLogin = () => {
      clearKidToken();
      navigate(`/t/${slug}/kid-login`, { replace: true });
    };
    fetch(`${API_BASE}/api/kid/me`, { headers: { Authorization: `Bearer ${kidToken}` } })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setConfirmed(false);
          ejectToLogin();
          return;
        }
        // Tenant guard: a kid token minted for tenant A must not run the
        // shell on tenant B's URL. The token's own tenantSlug is the
        // source of truth; a mismatch means a copied/stale token.
        const body = (await r.json().catch(() => null)) as { tenantSlug?: string } | null;
        if (cancelled) return;
        if (body?.tenantSlug && body.tenantSlug !== slug) {
          setConfirmed(false);
          ejectToLogin();
          return;
        }
        setConfirmed(true);
      })
      .catch(() => {
        // Network blip — keep the shell up (tabs are placeholders), but
        // don't announce "session active" since we couldn't confirm.
        if (!cancelled) setConfirmed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [kidToken, slug, navigate]);

  const onSwitchUser = useCallback(() => {
    clearKidToken();
    navigate(`/t/${slug}/kid-login`, { replace: true });
  }, [navigate, slug]);

  const navTabs: TopNavTab[] = KID_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: 0,
  }));
  const active = KID_TABS.find((t) => t.id === activeTab) ?? KID_TABS[0]!;

  return (
    <div
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
      data-testid="kid-dashboard"
    >
      <TopNav
        brand={
          <div className="flex items-center gap-3" data-testid="kid-brand">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-gradient-to-br from-yellow-300 to-pink-400 shadow-neo-sm"
            >
              <Sparkles size={22} className="text-purple-900" />
            </span>
            <h1 className="font-heading text-2xl uppercase tracking-wide text-white drop-shadow-md md:text-3xl">
              My Hub
            </h1>
          </div>
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={
          <button
            type="button"
            onClick={onSwitchUser}
            aria-label="Switch user"
            data-testid="kid-switch-user"
            className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-white px-4 py-2 font-bold text-purple-900 shadow-neo-sm transition-transform hover:bg-yellow-50 motion-safe:hover:-translate-y-0.5"
          >
            <LogOut size={16} strokeWidth={3} aria-hidden="true" />
            <span>Switch user</span>
          </button>
        }
        testId="kid-nav"
      />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`kid-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`kid-panel-${active.id}`}
          className="rounded-xl border-2 border-black bg-white p-6 text-center shadow-neo-sm md:p-10"
        >
          {active.id === 'notices' ? (
            <KidNoticesPanel kidToken={kidToken} />
          ) : (
            <>
              <p aria-hidden="true" className="text-5xl">
                {active.id === 'tasks' ? '⭐' : '🌈'}
              </p>
              <h2 className="mt-3 font-heading text-2xl text-black">{active.label}</h2>
              <p className="mt-1 text-sm font-bold text-gray-600">{active.blurb}</p>
              <p className="mt-4 text-sm font-bold text-purple-700" data-testid="kid-panel-soon">
                Your {active.label.toLowerCase()} land here soon!
              </p>
            </>
          )}
        </section>
      </main>

      <p className="sr-only" aria-live="polite" data-testid="kid-session-confirmed">
        {confirmed === true ? 'Kid session active' : ''}
      </p>
    </div>
  );
}
