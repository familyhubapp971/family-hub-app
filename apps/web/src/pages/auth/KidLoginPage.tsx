import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AvatarGrid, Button, PinInput, type AvatarTile } from '@familyhub/ui';
import { AuthLayout } from './AuthLayout';

// FHS-238 — kid-side login at /t/:slug/kid-login.
//
// Mounts under the tenant-scoped routing tree so the slug is in the
// URL (no auth context needed — the kid hasn't logged in yet). On
// mount we hit GET /api/public/kid-members/:slug to load the avatar
// grid; tapping a face opens the 4-digit PIN keypad; submitting POSTs
// to /api/auth/kid-pin (FHS-236). On 200 we stash the kid JWT in
// localStorage under `fh.kid.token` and forward to the dashboard. On
// 401 we clear the digits and show "Wrong PIN — try again". On 429
// we show the cooldown so the kid sees a clear "wait X minutes" hint
// instead of a confusing repeated error.
//
// Kid-tab gating + a kid-only dashboard shape ship in a later ticket
// (tracked under FHS-205); for now the kid lands on the existing
// dashboard so the flow is end-to-end testable.

const TILE_COLOURS = [
  'bg-pink-200',
  'bg-cyan-300',
  'bg-yellow-300',
  'bg-emerald-300',
  'bg-purple-300',
  'bg-orange-300',
] as const;

interface KidMember {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

interface KidListResponse {
  family: { slug: string; name: string };
  kids: KidMember[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; family: { name: string }; kids: KidMember[] }
  | { kind: 'family-not-found' }
  | { kind: 'load-failed'; message: string };

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'wrong-pin' }
  | { kind: 'locked'; retryAfterSec: number }
  | { kind: 'error'; message: string };

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export function KidLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });
  // PinInput is a controlled component with its own internal state, but
  // it doesn't expose a clear() — we force-remount it via this nonce
  // after a wrong PIN so the digits visually reset.
  const [pinNonce, setPinNonce] = useState(0);
  // Mirror selectedId in a ref so an in-flight PIN submit can detect
  // mid-fetch avatar swaps without re-running the callback (which would
  // capture the new selection in a fresh closure but also tear down
  // the in-flight one). The submit handler reads this on every
  // terminal branch and bails out as stale if it changed.
  const selectedIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!slug) {
      setLoad({ kind: 'load-failed', message: 'missing family slug' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/kid-members/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setLoad({ kind: 'family-not-found' });
          return;
        }
        if (!res.ok) {
          setLoad({ kind: 'load-failed', message: `server returned ${res.status}` });
          return;
        }
        const body = (await res.json()) as KidListResponse;
        setLoad({ kind: 'loaded', family: body.family, kids: body.kids });
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'unknown network error';
        setLoad({ kind: 'load-failed', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const tiles: AvatarTile[] = useMemo(() => {
    if (load.kind !== 'loaded') return [];
    return load.kids.map((k, i) => ({
      id: k.id,
      name: k.displayName,
      color: TILE_COLOURS[i % TILE_COLOURS.length]!,
      avatar: k.avatarEmoji ?? undefined,
    }));
  }, [load]);

  const onSelectKid = useCallback((id: string) => {
    setSelectedId(id);
    setSubmit({ kind: 'idle' });
    setPinNonce((n) => n + 1);
  }, []);

  const onPinComplete = useCallback(
    async (pin: string) => {
      if (!slug || !selectedId) return;
      // Capture the kid this submit is for. If a sibling taps a
      // different avatar mid-flight, the resolved response below
      // belongs to the previous kid and must not write their token /
      // navigate as them — staleSelection guards every terminal branch.
      const submittingFor = selectedId;
      const isStale = () => selectedIdRef.current !== submittingFor;
      setSubmit({ kind: 'submitting' });
      try {
        const res = await fetch(`${API_BASE}/api/auth/kid-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantSlug: slug, memberId: submittingFor, pin }),
        });
        if (isStale()) return;
        if (res.status === 200) {
          const body = (await res.json()) as { token: string };
          if (isStale()) return;
          localStorage.setItem('fh.kid.token', body.token);
          navigate(`/t/${slug}/dashboard`);
          return;
        }
        if (res.status === 429) {
          const retryHeader = res.headers.get('Retry-After');
          const retryAfterSec = retryHeader ? Math.max(parseInt(retryHeader, 10) || 0, 1) : 60;
          setSubmit({ kind: 'locked', retryAfterSec });
          setPinNonce((n) => n + 1);
          return;
        }
        if (res.status === 401) {
          setSubmit({ kind: 'wrong-pin' });
          setPinNonce((n) => n + 1);
          return;
        }
        setSubmit({
          kind: 'error',
          message: `Something went wrong (${res.status}). Please ask a grown-up.`,
        });
        setPinNonce((n) => n + 1);
      } catch (e) {
        if (isStale()) return;
        const message = e instanceof Error ? e.message : 'network error';
        setSubmit({ kind: 'error', message });
        setPinNonce((n) => n + 1);
      }
    },
    [slug, selectedId, navigate],
  );

  const back = (
    <p className="mt-6 font-body text-sm text-gray-700">
      Are you a grown-up?{' '}
      <Link to="/login" className="font-semibold underline" data-testid="kid-login-to-parent">
        Switch to parent log-in
      </Link>
      .
    </p>
  );

  if (load.kind === 'loading') {
    return (
      <AuthLayout title="Tap your face">
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-loading">
          Loading the family&hellip;
        </p>
        {back}
      </AuthLayout>
    );
  }

  if (load.kind === 'family-not-found') {
    return (
      <AuthLayout title="Family not found">
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-not-found">
          We couldn&rsquo;t find a family at this link. Ask a grown-up to check the address.
        </p>
        {back}
      </AuthLayout>
    );
  }

  if (load.kind === 'load-failed') {
    return (
      <AuthLayout title="Something went wrong">
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-load-error">
          We couldn&rsquo;t load the family right now ({load.message}). Try again in a moment.
        </p>
        {back}
      </AuthLayout>
    );
  }

  if (load.kids.length === 0) {
    return (
      <AuthLayout title={load.family.name}>
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-empty">
          No kid logins are set up yet. Ask a grown-up to add one in Members.
        </p>
        {back}
      </AuthLayout>
    );
  }

  const selectedKid = load.kids.find((k) => k.id === selectedId);

  return (
    <AuthLayout title={load.family.name}>
      <p className="mb-4 font-body text-sm text-gray-700">
        Tap your face and type your 4-digit PIN. Ask a grown-up if you forgot it.
      </p>

      <AvatarGrid
        avatars={tiles}
        onSelect={onSelectKid}
        {...(selectedId ? { selectedId } : {})}
        testId="kid-login-avatars"
      />

      {selectedKid && (
        <section className="mt-6" data-testid="kid-login-pin-section">
          <p className="mb-3 font-body text-sm text-gray-700">
            Hi <span className="font-bold">{selectedKid.displayName}</span> — type your PIN.
          </p>
          <PinInput
            key={pinNonce}
            length={4}
            onComplete={onPinComplete}
            disabled={submit.kind === 'submitting' || submit.kind === 'locked'}
            error={submit.kind === 'wrong-pin' || submit.kind === 'locked'}
            label={`PIN for ${selectedKid.displayName}`}
            testId="kid-login-pin"
          />

          {submit.kind === 'submitting' && (
            <p
              className="mt-3 text-center font-body text-sm text-gray-600"
              data-testid="kid-login-status-submitting"
            >
              Checking&hellip;
            </p>
          )}
          {submit.kind === 'wrong-pin' && (
            <p
              className="mt-3 text-center font-body text-sm text-red-600"
              role="alert"
              data-testid="kid-login-error"
            >
              That PIN didn&rsquo;t match. Try again.
            </p>
          )}
          {submit.kind === 'locked' && (
            <p
              className="mt-3 text-center font-body text-sm text-red-600"
              role="alert"
              data-testid="kid-login-locked"
            >
              Too many tries. Wait {Math.ceil(submit.retryAfterSec / 60)} minute
              {Math.ceil(submit.retryAfterSec / 60) === 1 ? '' : 's'} or ask a grown-up.
            </p>
          )}
          {submit.kind === 'error' && (
            <p
              className="mt-3 text-center font-body text-sm text-red-600"
              role="alert"
              data-testid="kid-login-error"
            >
              {submit.message}
            </p>
          )}

          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedId(undefined);
                setSubmit({ kind: 'idle' });
              }}
              testId="kid-login-pick-different"
            >
              Pick a different face
            </Button>
          </div>
        </section>
      )}

      {back}
    </AuthLayout>
  );
}
