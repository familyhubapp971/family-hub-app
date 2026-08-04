import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, KeyRound, PartyPopper, Plus, Sparkles, Wallet, X } from 'lucide-react';
import type { DashboardMember } from '@familyhub/shared';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-511: first-run "Getting started" guide on the parent dashboard.
//
// Walks a brand-new family through the first four setup steps, celebrates when
// all four are ticked, then clears itself. Returning families (who dismissed it
// or finished it) never see it again. Completion is tap-driven: tapping a
// step's CTA marks it done and takes you to that area: and persisted per
// tenant in localStorage so it survives reloads.

interface GetStartedStep {
  key: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  cta: string;
}

const STEPS: GetStartedStep[] = [
  {
    key: 'kids',
    icon: <Plus size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Add your kids',
    blurb: 'Everything else hangs off who is in the family.',
    cta: 'Add a child',
  },
  {
    key: 'pins',
    icon: <KeyRound size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Give each kid a PIN',
    blurb: 'It is how they sign in to their own world.',
    cta: 'Set PINs',
  },
  {
    key: 'rate',
    icon: <Wallet size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Choose what a sticker is worth',
    blurb: 'Decide how much a finished habit pays.',
    cta: 'Set pocket money',
  },
  {
    key: 'habits',
    icon: <Sparkles size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Pick their first habits',
    blurb: 'Start with two or three easy wins.',
    cta: 'Open their world',
  },
];

const TOTAL = STEPS.length;

interface StoredState {
  dismissed: boolean;
  completed: string[];
}

const EMPTY_STATE: StoredState = { dismissed: false, completed: [] };

const storageKey = (slug: string) => `fh.getStarted.${slug}`;

function readState(slug: string): StoredState {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      dismissed: parsed.dismissed === true,
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((k) => STEPS.some((s) => s.key === k))
        : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(slug: string, state: StoredState): void {
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(state));
  } catch {
    /* private mode / storage full: the guide just won't persist */
  }
}

function isYoungMember(role: string): boolean {
  return role === 'child' || role === 'teen';
}

export function GetStarted() {
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [state, setState] = useState<StoredState>(() => readState(slug));
  const [firstKidId, setFirstKidId] = useState<string | null>(null);
  // null = still loading. The whole guide is admin work (add kids, set PINs, set
  // the rate), so it only shows once we know the caller is an admin.
  const [callerIsAdmin, setCallerIsAdmin] = useState<boolean | null>(null);

  // One fetch of the dashboard payload gives us both the caller's role (to gate
  // the guide) and the first kid's id (so "Open their world" can deep-link).
  useEffect(() => {
    if (!session || state.dismissed) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/dashboard/today`, {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!body || !Array.isArray(body.members)) return;
        const members = body.members as DashboardMember[];
        const kid = members.find((m) => isYoungMember(m.role));
        setFirstKidId(kid?.id ?? null);
        const caller = members.find((m) => m.id === body.callerMemberId);
        setCallerIsAdmin(caller ? caller.role === 'admin' : false);
      })
      .catch(() => {
        /* aborted or failed load: the card stays hidden (callerIsAdmin null) */
      });
    return () => ac.abort();
  }, [session, slug, state.dismissed]);

  const completed = useMemo(() => new Set(state.completed), [state.completed]);
  const doneCount = completed.size;
  // The next step to do = the first step not yet ticked.
  const nextKey = STEPS.find((s) => !completed.has(s.key))?.key ?? null;

  const targetFor = useCallback(
    (key: string): string => {
      switch (key) {
        case 'kids':
        case 'pins':
          return `/t/${slug}/members`;
        case 'rate':
          return `/t/${slug}/reward-settings`;
        case 'habits':
          return firstKidId ? `/t/${slug}/child/${firstKidId}` : `/t/${slug}/members`;
        default:
          return `/t/${slug}/members`;
      }
    },
    [slug, firstKidId],
  );

  const completeAndGo = useCallback(
    (key: string) => {
      const nextCompleted = completed.has(key) ? state.completed : [...state.completed, key];
      const next: StoredState = { ...state, completed: nextCompleted };
      writeState(slug, next);
      setState(next);
      navigate(targetFor(key));
    },
    [completed, state, slug, navigate, targetFor],
  );

  const dismiss = useCallback(() => {
    const next: StoredState = { ...state, dismissed: true };
    writeState(slug, next);
    setState(next);
  }, [state, slug]);

  if (state.dismissed) return null;
  // Hidden while the role is still loading, and for non-admins: the setup
  // steps all land on admin-only screens (FHS-511 QA).
  if (callerIsAdmin !== true) return null;

  const allDone = doneCount >= TOTAL;

  // ── Celebrate card: every step ticked ──────────────────────────────────
  if (allDone) {
    return (
      <div
        data-testid="get-started-celebrate"
        className="mb-6 rounded-2xl border-2 border-black bg-emerald-300 p-5 shadow-neo-md md:p-6"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white shadow-neo-xs"
          >
            <PartyPopper size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-xl uppercase tracking-wide text-black md:text-2xl">
              You are all set up
            </h2>
            <p className="mt-1 text-sm font-bold text-emerald-950">
              Your family is ready. Check back tomorrow to see their first stickers land.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="get-started-got-it"
            onClick={dismiss}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-black bg-black px-5 font-heading text-sm uppercase tracking-wide text-white shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ── Setup checklist ─────────────────────────────────────────────────────
  return (
    <div
      data-testid="get-started"
      className="mb-6 rounded-2xl border-2 border-black bg-white p-4 shadow-neo-md md:p-6"
    >
      {/* Header: title + "N of 4 done" + dismiss. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg uppercase tracking-wide text-black md:text-xl">
            Getting started
            <span className="ml-2 text-sm font-bold text-gray-500" data-testid="get-started-count">
              · {doneCount} of {TOTAL} done
            </span>
          </h2>
        </div>
        <button
          type="button"
          data-testid="get-started-dismiss"
          onClick={dismiss}
          aria-label="Hide setup guide"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
        >
          <X size={16} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      {/* 4-segment progress bar. */}
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL}
        aria-valuenow={doneCount}
        aria-label={`${doneCount} of ${TOTAL} setup steps done`}
      >
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            aria-hidden="true"
            className={`h-2.5 flex-1 rounded-full border-2 border-black ${
              i < doneCount ? 'bg-green-400' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>

      {/* Steps. */}
      <ul className="mt-4 space-y-2.5">
        {STEPS.map((s) => {
          const isDone = completed.has(s.key);
          const isNext = s.key === nextKey;
          const isFuture = !isDone && !isNext;
          return (
            <li
              key={s.key}
              data-testid={`get-started-step-${s.key}`}
              className={`flex flex-col gap-3 rounded-xl border-2 border-black p-3 sm:flex-row sm:items-center ${
                isNext ? 'bg-yellow-50 shadow-neo-xs' : 'bg-white'
              } ${isFuture ? 'opacity-60' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black ${
                  isDone
                    ? 'bg-green-400 text-black'
                    : isNext
                      ? 'bg-yellow-300 text-black'
                      : 'bg-white text-gray-500'
                }`}
              >
                {isDone ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-heading text-sm uppercase tracking-wide ${
                    isDone ? 'text-gray-400 line-through' : 'text-black'
                  }`}
                >
                  {s.title}
                </span>
                {!isDone && (
                  <span className="mt-0.5 block text-xs font-bold text-gray-500">{s.blurb}</span>
                )}
              </span>
              {/* Only the NEXT step is actionable: earlier steps show Done,
                  later ones sit as a quiet "Up next" so you can't skip ahead
                  and complete an empty family out of order (FHS-511 QA). */}
              {isDone ? (
                <span
                  data-testid={`get-started-done-${s.key}`}
                  className="shrink-0 text-xs font-bold uppercase tracking-wider text-green-600"
                >
                  Done
                </span>
              ) : isNext ? (
                <button
                  type="button"
                  data-testid={`get-started-cta-${s.key}`}
                  onClick={() => completeAndGo(s.key)}
                  className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-black bg-yellow-300 px-4 font-heading text-sm uppercase tracking-wide text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
                >
                  {s.cta}
                </button>
              ) : (
                <span
                  data-testid={`get-started-upnext-${s.key}`}
                  className="shrink-0 text-xs font-bold uppercase tracking-wider text-gray-400"
                >
                  Up next
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
