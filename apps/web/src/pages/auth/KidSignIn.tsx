import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarGrid, Button, PinInput, type AvatarTile } from '@familyhub/ui';
import { API_BASE } from '../../lib/api';

// FHS-360 — the kid sign-in flow (avatar tiles → PIN → kid token), shared by
// the per-family KidLoginPage and the unified LoginPage "I'm a Kid" view so the
// Magic Patterns login card and the /t/:slug/kid-login route stay identical.
//
// Loads GET /api/public/kid-members/:slug, renders the "Who are you?" tiles,
// and on a tapped face shows the 4-digit PIN. Submitting POSTs to
// /api/auth/kid-pin; on 200 it stashes the kid JWT under fh.kid.token and
// forwards to the dashboard. 401 → "wrong PIN"; 429 → cooldown.

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

export function KidSignIn({
  slug,
  onFamilyLoaded,
  notFoundFooter,
}: {
  slug: string | undefined;
  /** Called once the family name resolves, so the page can show it. */
  onFamilyLoaded?: (familyName: string) => void;
  /** Rendered under the not-found / load-failed message (e.g. "try another code"). */
  notFoundFooter?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });
  const [pinNonce, setPinNonce] = useState(0);
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
    setLoad({ kind: 'loading' });
    setSelectedId(undefined);
    setSubmit({ kind: 'idle' }); // don't carry a wrong-PIN error across families
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
        try {
          localStorage.setItem(
            'fh.kid.lastFamily',
            JSON.stringify({ slug: body.family.slug, name: body.family.name }),
          );
        } catch {
          /* private mode / storage full — non-fatal */
        }
        setLoad({ kind: 'loaded', family: body.family, kids: body.kids });
        onFamilyLoaded?.(body.family.name);
      } catch (e) {
        if (cancelled) return;
        setLoad({ kind: 'load-failed', message: e instanceof Error ? e.message : 'network error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, onFamilyLoaded]);

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
        setSubmit({ kind: 'error', message: e instanceof Error ? e.message : 'network error' });
        setPinNonce((n) => n + 1);
      }
    },
    [slug, selectedId, navigate],
  );

  if (load.kind === 'loading') {
    return (
      <p className="font-body text-sm text-gray-600" data-testid="kid-login-loading">
        Loading the family&hellip;
      </p>
    );
  }
  if (load.kind === 'family-not-found') {
    return (
      <div>
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-not-found">
          We couldn&rsquo;t find a family at this link. Ask a grown-up to check the address.
        </p>
        {notFoundFooter}
      </div>
    );
  }
  if (load.kind === 'load-failed') {
    return (
      <div>
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-load-error">
          We couldn&rsquo;t load the family right now ({load.message}). Try again in a moment.
        </p>
        {notFoundFooter}
      </div>
    );
  }
  if (load.kids.length === 0) {
    return (
      <p className="font-body text-sm text-gray-700" data-testid="kid-login-empty">
        No kid logins are set up yet. Ask a grown-up to add one in Members.
      </p>
    );
  }

  const selectedKid = load.kids.find((k) => k.id === selectedId);

  return (
    <div className="space-y-4">
      <p className="text-center font-bold text-gray-500" data-testid="kid-signin-who">
        Who are you?
      </p>
      <AvatarGrid
        avatars={tiles}
        onSelect={onSelectKid}
        {...(selectedId ? { selectedId } : {})}
        testId="kid-login-avatars"
      />

      {/* FHS-402 — reserve the PIN-slot height so the centred card stays the same
          height with or without a kid selected (no jump when the PIN box appears). */}
      <div className="mt-4 min-h-[208px]">
        {selectedKid && (
          <section data-testid="kid-login-pin-section">
            <p className="mb-3 text-center font-body text-sm text-gray-600">
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
      </div>
    </div>
  );
}
