import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';

// FHS-230 — CalendarTabPanel.
//
// Week view of the family calendar. 7 day-columns (Mon-Sun) with the
// week's events listed under each day. Header has prev / today / next
// navigation. + Add opens a small inline form to create one event;
// success refetches the current week.

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface EventItem {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  notes: string | null;
  memberId: string | null;
}

interface ListEventsResponse {
  weekStart: string;
  events: EventItem[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; events: EventItem[] }
  | { kind: 'error'; message: string };

// Returns the Monday on or before `d` as YYYY-MM-DD (UTC-anchored).
function mondayOf(d: Date): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = utc.getUTCDay(); // Sun=0, Mon=1, ...
  const diff = (dow + 6) % 7; // days since Monday
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map((s) => Number.parseInt(s, 10));
  const start = new Date(Date.UTC(y!, m! - 1, d!));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: '', title: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAnnouncement, setSaveAnnouncement] = useState<string>('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Today's calendar day in UTC — used to highlight the current column
  // (aria-current) and to default the add-form date when on the current
  // week. Computed once per render; cheap.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const headers = useMemo(
    () =>
      session
        ? {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-slug': slug,
          }
        : null,
    [session, slug],
  );

  const refetch = useCallback(
    async (week: string) => {
      if (!headers) return;
      try {
        const res = await fetch(`/api/events?weekStart=${week}`, { headers });
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load calendar (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as ListEventsResponse;
        setStatus({ kind: 'ready', events: body.events });
      } catch (err) {
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error — try again.',
        });
      }
    },
    [headers],
  );

  useEffect(() => {
    if (!headers) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events?weekStart=${weekStart}`, {
          headers,
          signal: ac.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load calendar (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as ListEventsResponse;
        if (cancelled) return;
        setStatus({ kind: 'ready', events: body.events });
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error — try again.',
        });
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [headers, weekStart]);

  const onPrev = useCallback(() => {
    setWeekStart((w) => addDaysIso(w, -7));
  }, []);

  const onNext = useCallback(() => {
    setWeekStart((w) => addDaysIso(w, 7));
  }, []);

  const onToday = useCallback(() => {
    setWeekStart(mondayOf(new Date()));
  }, []);

  const onAddOpen = useCallback(() => {
    // Default to today when the user is viewing the current week, else
    // fall back to the Monday of the displayed week.
    const weekEnd = addDaysIso(weekStart, 6);
    const defaultDate = todayIso >= weekStart && todayIso <= weekEnd ? todayIso : weekStart;
    setAdding(true);
    setSaveError(null);
    setDraft({ date: defaultDate, title: '', startTime: '', endTime: '' });
  }, [weekStart, todayIso]);

  const onAddCancel = useCallback(() => {
    setAdding(false);
    setSaveError(null);
    // Return focus to the + Add button so keyboard users don't lose
    // their place when the form unmounts.
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  const onAddSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Ref guard wins over state for the double-click race: state
      // updates are deferred until the next render, so two fast clicks
      // can both pass an `if (saving)` check before either has set it.
      if (!headers || savingRef.current) return;
      const trimmedTitle = draft.title.trim();
      if (!trimmedTitle) {
        setSaveError('Title is required.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: draft.date,
            title: trimmedTitle,
            startTime: draft.startTime || null,
            endTime: draft.endTime || null,
          }),
        });
        if (!res.ok) {
          // Surface the API's structured error message when present so
          // the user sees "endTime must be after startTime" not "500".
          let detail = `Couldn't save (server returned ${res.status})`;
          try {
            const body = (await res.json()) as {
              error?: string;
              issues?: Array<{ message?: string }>;
            };
            if (body.issues?.[0]?.message) detail = body.issues[0].message;
            else if (body.error) detail = body.error;
          } catch {
            // Non-JSON body — keep the generic detail.
          }
          setSaveError(detail);
          return;
        }
        setAdding(false);
        setSaveAnnouncement(`Added "${trimmedTitle}" on ${draft.date}`);
        await refetch(weekStart);
        requestAnimationFrame(() => addButtonRef.current?.focus());
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error — try again.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [headers, draft, refetch, weekStart],
  );

  // Group events by date so each day-column lists its own.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    if (status.kind !== 'ready') return map;
    for (const ev of status.events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [status]);

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="calendar-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading calendar…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="calendar-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="calendar-ready">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl text-black md:text-3xl">Calendar</h2>
          <p className="mt-1 text-sm text-gray-600" data-testid="calendar-week-label">
            Week of {formatWeekRange(weekStart)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onPrev}
            testId="calendar-prev"
          >
            ← Prev
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onToday}
            testId="calendar-today"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNext}
            testId="calendar-next"
          >
            Next →
          </Button>
          <Button
            ref={addButtonRef}
            type="button"
            variant="primary"
            size="sm"
            onClick={onAddOpen}
            testId="calendar-add"
          >
            + Add
          </Button>
        </div>
      </header>

      {/* Polite aria-live so screen readers announce a successful add. */}
      <p aria-live="polite" className="sr-only" data-testid="calendar-announcement">
        {saveAnnouncement}
      </p>

      {adding && (
        <Card className="border-2 border-black bg-yellow-50 p-4 shadow-neo-sm">
          <form
            onSubmit={onAddSubmit}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            data-testid="calendar-add-form"
          >
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Date
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                data-testid="calendar-add-date"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Title
              <input
                type="text"
                required
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                data-testid="calendar-add-title"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Start time (optional)
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                data-testid="calendar-add-start"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              End time (optional)
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                data-testid="calendar-add-end"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            {saveError && (
              <p
                role="alert"
                data-testid="calendar-add-error"
                className="col-span-full text-xs font-bold text-red-600"
              >
                {saveError}
              </p>
            )}
            <div className="col-span-full flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                testId="calendar-add-submit"
              >
                {saving ? 'Saving…' : 'Save event'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddCancel}
                disabled={saving}
                testId="calendar-add-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div
        className="overflow-x-auto rounded-md border-2 border-black shadow-neo-sm"
        data-testid="calendar-grid"
      >
        <ol className="grid min-w-[720px] grid-cols-7 divide-x-2 divide-black">
          {DAY_LABELS.map((label, idx) => {
            const date = addDaysIso(weekStart, idx);
            const dayEvents = eventsByDate.get(date) ?? [];
            const dayPart = date.split('-')[2];
            const isToday = date === todayIso;
            return (
              <li
                key={date}
                data-testid={`calendar-day-${idx}`}
                data-date={date}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${label} ${dayPart}`}
                className={`min-h-[160px] p-2 ${isToday ? 'bg-yellow-50' : 'bg-white'}`}
              >
                <header className="mb-2 flex items-baseline justify-between">
                  <span className="font-heading text-sm text-black">{label}</span>
                  <span className="font-mono text-xs text-gray-500">{dayPart}</span>
                </header>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-gray-400" data-testid={`calendar-day-${idx}-empty`}>
                    —
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {dayEvents.map((ev) => (
                      <li
                        key={ev.id}
                        data-testid={`calendar-event-${ev.id}`}
                        className="rounded border-2 border-black bg-yellow-50 px-2 py-1 text-xs shadow-neo-xs"
                      >
                        {ev.startTime && (
                          <span className="mr-1 font-mono text-[10px] text-gray-600">
                            {ev.startTime}
                          </span>
                        )}
                        <span className="font-bold text-black">{ev.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
