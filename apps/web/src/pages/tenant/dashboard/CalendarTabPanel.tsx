import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-230 / FHS-265 — CalendarTabPanel (Magic Patterns layout).
//
// Week-based day list with School / Home sub-tabs. Each day is a card:
// a header (pink + "Today" pill on the current day, activity count),
// activity rows showing who-it's-for (coloured avatar disc), when,
// where (location) and what to wear, and a per-day "Add Activity"
// inline form. A legend + per-child filter pills narrow the view
// client-side. Renders directly on the kingdom-purple background.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type EventType = 'school' | 'home';

interface EventItem {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  notes: string | null;
  memberId: string | null;
  type: EventType;
  location: string | null;
  wear: string | null;
}

interface MemberLite {
  id: string;
  displayName: string;
  role: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; events: EventItem[]; members: MemberLite[] }
  | { kind: 'error'; message: string };

interface DraftForm {
  date: string; // the day card the form is open on
  type: EventType; // captured at form-open so a sub-tab switch mid-edit can't reroute the event
  memberIds: Set<string>; // checked children; 0 or 2+ = whole family
  title: string;
  startTime: string;
  location: string;
  wear: string;
}

// Family rows are green; each member cycles a distinct colour. Shared
// by the legend, the filter pills and the activity rows.
const FAMILY_STYLE = {
  border: 'border-green-400',
  bg: 'bg-green-50',
  avatar: 'bg-green-200',
  dot: 'bg-green-200',
};
const MEMBER_STYLES = [
  {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    avatar: 'bg-yellow-200',
    dot: 'bg-yellow-200',
  },
  {
    border: 'border-purple-400',
    bg: 'bg-purple-50',
    avatar: 'bg-purple-200',
    dot: 'bg-purple-200',
  },
  { border: 'border-cyan-400', bg: 'bg-cyan-50', avatar: 'bg-cyan-200', dot: 'bg-cyan-200' },
  { border: 'border-pink-400', bg: 'bg-pink-50', avatar: 'bg-pink-200', dot: 'bg-pink-200' },
  { border: 'border-amber-400', bg: 'bg-amber-50', avatar: 'bg-amber-200', dot: 'bg-amber-200' },
  { border: 'border-sky-400', bg: 'bg-sky-50', avatar: 'bg-sky-200', dot: 'bg-sky-200' },
];
const UNKNOWN_STYLE = {
  border: 'border-gray-400',
  bg: 'bg-gray-50',
  avatar: 'bg-gray-200',
  dot: 'bg-gray-200',
};

// Colour index runs over the CHILDREN list (not the full roster) so a
// child's colour doesn't shift when adults join, and matches the legend.
function styleFor(memberId: string | null, children: MemberLite[]) {
  if (memberId === null) return FAMILY_STYLE;
  const idx = children.findIndex((m) => m.id === memberId);
  if (idx < 0) return UNKNOWN_STYLE;
  return MEMBER_STYLES[idx % MEMBER_STYLES.length]!;
}

function letterFor(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'F';
  const m = members.find((x) => x.id === memberId);
  return [...(m?.displayName.trim() ?? '?')][0]?.toUpperCase() ?? '?';
}

function mondayOf(d: Date): string {
  const copy = new Date(d);
  const offset = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - offset);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, '0');
  const day = String(copy.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// "Monday 15 Jun" — UTC-anchored so the server date never shifts.
function dayLabel(iso: string): string {
  if (!ISO_DATE.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatWeekRange(weekStart: string): string {
  const end = addDaysIso(weekStart, 6);
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
    return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  };
  return `${fmt(weekStart)} — ${fmt(end)}`;
}

function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function CalendarTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  // Default to School per the founder's call (matches the mockup). Note:
  // events created before FHS-265 carry type='home' — they live under the
  // Home sub-tab.
  const [subTab, setSubTab] = useState<EventType>('school');
  const [filter, setFilter] = useState<string>('all'); // 'all' | memberId
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Synchronous double-submit guard — two fast clicks can both pass an
  // `if (saving)` state check before React re-renders.
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(
    async (week: string, signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const [evRes, memRes] = await Promise.all([
          fetch(`${API_BASE}/api/events?weekStart=${week}`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/members`, { headers, signal: signal ?? null }),
        ]);
        if (!mountedRef.current) return;
        if (!evRes.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load the calendar (server ${evRes.status})`,
          });
          return;
        }
        const evBody = (await evRes.json()) as { events: EventItem[] };
        let members: MemberLite[] = [];
        if (memRes.ok) {
          const mb = (await memRes.json()) as { members: MemberLite[] };
          members = mb.members ?? [];
        }
        setStatus({ kind: 'ready', events: evBody.events ?? [], members });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!mountedRef.current) return;
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
    // Navigating weeks closes any open form — its day card is gone.
    setDraft(null);
    setEditingId(null);
    setSaveError(null);
    const ac = new AbortController();
    void load(weekStart, ac.signal);
    return () => ac.abort();
  }, [headers, weekStart, load]);

  const onSave = useCallback(async () => {
    if (!draft || !headers || savingRef.current) return;
    const title = draft.title.trim();
    if (title.length === 0) {
      setSaveError('Give the activity a name.');
      return;
    }
    // Exactly one child checked → that child; none or several → the
    // whole family (our data model stores one member per event).
    const memberId = draft.memberIds.size === 1 ? [...draft.memberIds][0]! : null;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const body = JSON.stringify({
        date: draft.date,
        title,
        startTime: draft.startTime || null,
        endTime: null,
        memberId,
        type: draft.type,
        location: draft.location.trim() || null,
        wear: draft.wear.trim() || null,
        notes: null,
      });
      const url = editingId ? `${API_BASE}/api/events/${editingId}` : `${API_BASE}/api/events`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        setSaveError(`Couldn't save (server returned ${res.status})`);
        return;
      }
      setDraft(null);
      setEditingId(null);
      setAnnouncement(editingId ? `${title} updated` : `${title} added`);
      await load(weekStart);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error — try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [draft, editingId, headers, weekStart, load]);

  // App-styled delete confirmation (replaces window.confirm).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = useCallback(async () => {
    if (!headers || !pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/events/${pendingDelete.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok && res.status !== 204) {
        setAnnouncement(`Couldn't delete (server ${res.status})`);
        return;
      }
      setAnnouncement(`${pendingDelete.title} deleted`);
      await load(weekStart);
      setPendingDelete(null);
    } catch (err) {
      setAnnouncement(err instanceof Error ? err.message : 'Network error — try again.');
    } finally {
      setDeleting(false);
    }
  }, [headers, pendingDelete, weekStart, load]);

  if (status.kind === 'loading') {
    return (
      <p data-testid="calendar-loading" className="font-bold text-purple-200" aria-busy="true">
        Loading the calendar…
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p data-testid="calendar-error" role="alert" className="font-bold text-red-300">
        {status.message}
      </p>
    );
  }

  const { events, members } = status;
  const children = members.filter((m) => m.role === 'child' || m.role === 'teen');
  const todayIso = localTodayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));

  const visible = events.filter((e) => {
    if (e.type !== subTab) return false;
    if (filter === 'all') return true;
    if (filter === 'family') return e.memberId === null;
    return e.memberId === filter;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="calendar-ready">
      <p aria-live="polite" className="sr-only" data-testid="calendar-announcement">
        {announcement}
      </p>
      {/* Header + week navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl tracking-wide text-white">Calendar</h2>
          <p className="font-mono text-sm text-purple-200">Weekly schedule at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="calendar-prev-week"
            aria-label="Previous week"
            onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-black bg-white text-black shadow-neo-xs hover:bg-gray-50"
          >
            <ChevronLeft size={16} strokeWidth={3} />
          </button>
          <span
            className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black shadow-neo-xs"
            data-testid="calendar-week-label"
          >
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            data-testid="calendar-next-week"
            aria-label="Next week"
            onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-black bg-white text-black shadow-neo-xs hover:bg-gray-50"
          >
            <ChevronRight size={16} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* School / Home sub-tabs */}
      <div
        className="flex gap-1 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-sm"
        role="group"
        aria-label="Calendar type"
      >
        <SubTabButton
          testId="calendar-subtab-school"
          active={subTab === 'school'}
          onClick={() => setSubTab('school')}
          icon={<BookOpen size={18} strokeWidth={3} aria-hidden="true" />}
          label="School"
        />
        <SubTabButton
          testId="calendar-subtab-home"
          active={subTab === 'home'}
          onClick={() => setSubTab('home')}
          icon={<Home size={18} strokeWidth={3} aria-hidden="true" />}
          label="Home"
        />
      </div>

      {/* Legend + filters */}
      <div
        className="flex flex-col items-start justify-between gap-4 rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm sm:flex-row sm:items-center"
        data-testid="calendar-legend"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm font-bold uppercase tracking-wider text-gray-500">Legend:</span>
          {children.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span
                className={`h-4 w-4 rounded-full border-2 border-black ${styleFor(c.id, children).dot}`}
                aria-hidden="true"
              />
              <span className="text-sm font-bold">{c.displayName}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              className={`h-4 w-4 rounded-full border-2 border-black ${FAMILY_STYLE.dot}`}
              aria-hidden="true"
            />
            <span className="text-sm font-bold">Family</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by member">
          <FilterPill
            testId="calendar-filter-all"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
          />
          <FilterPill
            testId="calendar-filter-family"
            active={filter === 'family'}
            onClick={() => setFilter('family')}
            label="Family"
          />
          {children.map((c) => (
            <FilterPill
              key={c.id}
              testId={`calendar-filter-${c.id}`}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
              label={c.displayName}
            />
          ))}
        </div>
      </div>

      {/* Day list */}
      <div className="space-y-6">
        {days.map((dayIso) => {
          const isToday = dayIso === todayIso;
          const dayEvents = visible
            .filter((e) => e.date === dayIso)
            .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'));
          const formOpen = draft?.date === dayIso;
          return (
            <section
              key={dayIso}
              data-testid={`calendar-day-${dayIso}`}
              className={`overflow-hidden rounded-xl border-2 border-black bg-white ${
                isToday ? 'border-pink-500 shadow-[4px_4px_0_0_#ec4899]' : 'shadow-neo-sm'
              }`}
              aria-labelledby={`calendar-day-${dayIso}-h`}
            >
              {/* Day header */}
              <div
                className={`flex items-center justify-between border-b-2 border-black px-5 py-4 ${
                  isToday ? 'bg-pink-400 text-black' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <h3 id={`calendar-day-${dayIso}-h`} className="font-heading text-xl">
                    {dayLabel(dayIso)}
                  </h3>
                  {isToday && (
                    <span
                      data-testid="calendar-today-pill"
                      className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    >
                      Today
                    </span>
                  )}
                  {dayEvents.length > 0 && (
                    <span
                      className={`rounded-full border border-black/20 px-2 py-0.5 text-[10px] font-bold ${
                        isToday ? 'bg-white/30' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {dayEvents.length} {dayEvents.length === 1 ? 'activity' : 'activities'}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white p-5">
                {dayEvents.length > 0 ? (
                  <div className="w-full">
                    {/* Column headers (desktop) */}
                    <div className="mb-3 hidden grid-cols-12 gap-4 border-b-2 border-gray-100 px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:grid">
                      <div className="col-span-4">Who &amp; Activity</div>
                      <div className="col-span-2">When</div>
                      <div className="col-span-3">Where</div>
                      <div className="col-span-2">What to wear</div>
                      <div className="col-span-1" />
                    </div>
                    <ul className="space-y-3">
                      {dayEvents.map((ev) => {
                        const style = styleFor(ev.memberId, children);
                        const who =
                          ev.memberId === null
                            ? 'Family'
                            : (members.find((m) => m.id === ev.memberId)?.displayName ??
                              'Family member');
                        return (
                          <li
                            key={ev.id}
                            data-testid={`calendar-event-${ev.id}`}
                            className={`grid grid-cols-1 items-center gap-2 rounded-lg border-2 border-l-4 border-black p-3 shadow-neo-xs sm:grid-cols-12 sm:gap-4 ${style.border} ${style.bg} motion-safe:transition-transform motion-safe:hover:-translate-y-0.5`}
                          >
                            <div className="flex items-center gap-3 sm:col-span-4">
                              <span
                                aria-label={who}
                                title={who}
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black font-heading text-sm ${style.avatar}`}
                              >
                                {letterFor(ev.memberId, members)}
                              </span>
                              <span className="min-w-0">
                                <span
                                  className="block text-sm font-bold leading-tight"
                                  data-testid={`calendar-event-${ev.id}-title`}
                                >
                                  {ev.title}
                                </span>
                                {ev.notes && (
                                  <span
                                    className="block truncate text-xs italic text-gray-500"
                                    data-testid={`calendar-event-${ev.id}-notes`}
                                  >
                                    {ev.notes}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="inline-flex items-center gap-1 rounded border border-black/10 bg-white/50 px-2 py-1 text-[10px] font-bold">
                                <Clock size={10} aria-hidden="true" />
                                {ev.startTime
                                  ? ev.endTime
                                    ? `${ev.startTime} – ${ev.endTime}`
                                    : ev.startTime
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700 sm:col-span-3">
                              {ev.location && (
                                <MapPin
                                  size={12}
                                  className="shrink-0 text-gray-400"
                                  aria-hidden="true"
                                />
                              )}
                              <span data-testid={`calendar-event-${ev.id}-location`}>
                                {ev.location ?? '—'}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span
                                className="inline-block rounded border-2 border-black/10 bg-white px-2 py-1 text-[10px] font-bold text-gray-700"
                                data-testid={`calendar-event-${ev.id}-wear`}
                              >
                                {ev.wear ?? '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1 sm:col-span-1">
                              <button
                                type="button"
                                aria-label={`Edit ${ev.title}`}
                                data-testid={`calendar-edit-${ev.id}`}
                                onClick={() => {
                                  setSaveError(null);
                                  setEditingId(ev.id);
                                  setDraft({
                                    date: ev.date,
                                    type: ev.type,
                                    memberIds:
                                      ev.memberId !== null ? new Set([ev.memberId]) : new Set(),
                                    title: ev.title,
                                    startTime: ev.startTime ?? '',
                                    location: ev.location ?? '',
                                    wear: ev.wear ?? '',
                                  });
                                }}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border-2 border-black/20 bg-white text-gray-500 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 hover:border-black hover:text-black"
                              >
                                <Pencil size={12} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${ev.title}`}
                                data-testid={`calendar-delete-${ev.id}`}
                                onClick={() => setPendingDelete({ id: ev.id, title: ev.title })}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border-2 border-black/20 bg-white text-gray-500 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 hover:border-red-500 hover:text-red-600"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div
                    data-testid={`calendar-day-${dayIso}-empty`}
                    className="mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 text-center"
                  >
                    <span
                      aria-hidden="true"
                      className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-gray-100 bg-white text-3xl shadow-sm"
                    >
                      🎈
                    </span>
                    <p className="mb-1 font-bold text-gray-500">No activities scheduled</p>
                    <p className="text-xs text-gray-400">Enjoy the free time!</p>
                  </div>
                )}

                {/* Add Activity */}
                <div className="mt-4">
                  {formOpen ? (
                    <ActivityForm
                      draft={draft}
                      editingId={editingId}
                      childrenList={children}
                      saving={saving}
                      saveError={saveError}
                      onChange={setDraft}
                      onSave={() => void onSave()}
                      onClose={() => {
                        setDraft(null);
                        setEditingId(null);
                        setSaveError(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      data-testid={`calendar-add-${dayIso}`}
                      onClick={() => {
                        setSaveError(null);
                        setDraft({
                          date: dayIso,
                          type: subTab,
                          memberIds: filter !== 'all' ? new Set([filter]) : new Set(),
                          title: '',
                          startTime: '',
                          location: '',
                          wear: '',
                        });
                      }}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 font-bold transition-colors hover:border-black hover:bg-gray-50 hover:text-black ${
                        dayEvents.length === 0
                          ? 'border-solid border-black bg-white text-black shadow-neo-xs'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      <Plus size={18} aria-hidden="true" /> Add Activity
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : ''}
        message="This activity will be removed from the calendar."
        confirmLabel="Delete"
        variant="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
        testId="calendar-delete-confirm"
      />
    </div>
  );
}

function SubTabButton({
  testId,
  active,
  onClick,
  icon,
  label,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-bold transition-all ${
        active
          ? 'border-black bg-pink-400 text-black shadow-neo-xs'
          : 'border-transparent bg-transparent text-gray-500 hover:bg-gray-100'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function FilterPill({
  testId,
  active,
  onClick,
  label,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[36px] rounded-full border-2 border-black px-4 py-1.5 text-sm font-bold transition-colors ${
        active ? 'bg-pink-400 text-black shadow-neo-xs' : 'bg-white text-gray-500 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function ActivityForm({
  draft,
  editingId,
  childrenList,
  saving,
  saveError,
  onChange,
  onSave,
  onClose,
}: {
  draft: DraftForm;
  editingId: string | null;
  childrenList: MemberLite[];
  saving: boolean;
  saveError: string | null;
  onChange: (d: DraftForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const toggleChild = (id: string) => {
    const next = new Set(draft.memberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...draft, memberIds: next });
  };
  return (
    <div
      className="mt-2 rounded-xl border-2 border-black bg-white p-5 shadow-neo-xs"
      data-testid="calendar-add-form"
      role="group"
      aria-label={editingId ? 'Edit activity' : 'Add new activity'}
    >
      <div className="mb-4 flex items-center justify-between border-b-2 border-gray-100 pb-3">
        <h4 className="font-heading text-lg">{editingId ? 'Edit Activity' : 'Add New Activity'}</h4>
        <button
          type="button"
          aria-label="Close"
          data-testid="calendar-form-close"
          onClick={onClose}
          className="text-gray-400 transition-colors hover:text-black"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
            Who is this for?
          </p>
          <div className="flex flex-wrap gap-4">
            {childrenList.map((c) => {
              const checked = draft.memberIds.has(c.id);
              const style = styleFor(c.id, childrenList);
              return (
                <label key={c.id} className="group flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    data-testid={`calendar-form-child-${c.id}`}
                    aria-label={c.displayName}
                    className="h-5 w-5 rounded border-2 border-black"
                    checked={checked}
                    onChange={() => toggleChild(c.id)}
                  />
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-4 w-4 rounded-full border-2 border-black ${style.dot}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-bold">{c.displayName}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] font-bold text-gray-400">
            Tick exactly one child to assign it to them. Leave all unticked (or tick two or more)
            and it goes on the whole family&rsquo;s calendar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="col-span-1 md:col-span-2">
            <label
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500"
              htmlFor="calendar-form-title"
            >
              Activity Name
            </label>
            <input
              id="calendar-form-title"
              type="text"
              placeholder="e.g. Swimming Lesson"
              data-testid="calendar-form-title"
              value={draft.title}
              maxLength={120}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
              className="w-full rounded-lg border-2 border-black px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400/50"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500"
              htmlFor="calendar-form-when"
            >
              When
            </label>
            <input
              id="calendar-form-when"
              type="time"
              data-testid="calendar-form-when"
              value={draft.startTime}
              onChange={(e) => onChange({ ...draft, startTime: e.target.value })}
              className="w-full rounded-lg border-2 border-black px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400/50"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500"
              htmlFor="calendar-form-where"
            >
              Where
            </label>
            <input
              id="calendar-form-where"
              type="text"
              placeholder="e.g. Leisure Centre"
              data-testid="calendar-form-where"
              value={draft.location}
              maxLength={120}
              onChange={(e) => onChange({ ...draft, location: e.target.value })}
              className="w-full rounded-lg border-2 border-black px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400/50"
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500"
              htmlFor="calendar-form-wear"
            >
              What to wear
            </label>
            <input
              id="calendar-form-wear"
              type="text"
              placeholder="e.g. Swimsuit and towel"
              data-testid="calendar-form-wear"
              value={draft.wear}
              maxLength={120}
              onChange={(e) => onChange({ ...draft, wear: e.target.value })}
              className="w-full rounded-lg border-2 border-black px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400/50"
            />
          </div>
        </div>

        {saveError && (
          <p
            role="alert"
            data-testid="calendar-save-error"
            className="text-xs font-bold text-red-600"
          >
            {saveError}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            data-testid="calendar-form-cancel"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] rounded-lg border-2 border-black px-4 py-2 font-bold transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="calendar-form-save"
            onClick={onSave}
            disabled={saving || draft.title.trim().length === 0}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-black bg-pink-400 px-6 py-2 font-bold shadow-neo-xs transition-all hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
          >
            <Save size={16} aria-hidden="true" />{' '}
            {saving ? 'Saving…' : editingId ? 'Update Activity' : 'Save Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}
