import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-270 — ChildWorld Learn tab.
//
// A grid of subject cards, each with a progress bar fed by
// GET /api/learn. The actual learning content is a separate epic — this
// just shows the cards with their stored progress. Read-only here.

interface Subject {
  subject: string;
  progress: number;
}

type Status = 'loading' | 'ready' | 'error';

// Card accent + emoji per subject so the grid reads playfully. Falls back
// for any subject the server adds later that isn't mapped here.
const SUBJECT_STYLE: Record<string, { icon: string; bg: string }> = {
  Maths: { icon: '🔢', bg: 'bg-sky-300' },
  Reading: { icon: '📖', bg: 'bg-rose-300' },
  'World Flags': { icon: '🚩', bg: 'bg-amber-300' },
  Logic: { icon: '🧩', bg: 'bg-violet-300' },
  Science: { icon: '🔬', bg: 'bg-emerald-300' },
  Creative: { icon: '🎨', bg: 'bg-orange-300' },
};
const FALLBACK_STYLE = { icon: '⭐', bg: 'bg-gray-300' };

export function LearnTab({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const res = await fetch(`${API_BASE}/api/learn?memberId=${memberId}`, {
          headers,
          signal: signal ?? null,
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { subjects: Subject[] };
        setSubjects(body.subjects ?? []);
        setStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      }
    },
    [headers, memberId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  if (status === 'loading') {
    return (
      <p
        data-testid="learn-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your subjects…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="learn-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your subjects — try again.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="learn-tab">
      {subjects.map((s) => {
        const style = SUBJECT_STYLE[s.subject] ?? FALLBACK_STYLE;
        const pct = Math.max(0, Math.min(100, s.progress));
        return (
          <section
            key={s.subject}
            data-testid={`learn-card-${s.subject}`}
            className={`relative flex flex-col gap-3 rounded-xl border-2 border-black p-5 shadow-neo-sm ${style.bg}`}
          >
            <span className="absolute right-3 top-3 rounded-full border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black">
              {pct}%
            </span>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-white text-2xl shadow-neo-xs"
              >
                {style.icon}
              </span>
              <h3 className="font-heading text-lg text-black">{s.subject}</h3>
            </div>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${s.subject} progress`}
              data-testid={`learn-progress-${s.subject}`}
              className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-white/50"
            >
              <div className="h-full bg-black" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs font-bold text-black/70">{pct}% complete</p>
          </section>
        );
      })}
    </div>
  );
}
