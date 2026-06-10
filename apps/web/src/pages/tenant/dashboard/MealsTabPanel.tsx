import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Repeat } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-229 / FHS-264 — MealsTabPanel (Magic Patterns layout).
//
// Full-width card per day, split into Breakfast / Lunch / Dinner / Snack
// columns. Each meal is a colour-coded card (green = whole family, a
// distinct colour per member) with a letter badge for who-it's-for and a
// "Weekly" pill when recurring. A legend + filter pills narrow the view
// client-side. "+ Add Meal" per day opens an inline editor (slot, name,
// who-for, recurring). Clearing the name deletes that meal. Writes go to
// POST /api/meals (admin/adult only).

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type Day = (typeof DAYS)[number];
type Slot = (typeof SLOTS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const SLOT_META: Record<Slot, { label: string; emoji: string; color: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🍞', color: 'text-orange-600' },
  lunch: { label: 'Lunch', emoji: '🌟', color: 'text-amber-600' },
  dinner: { label: 'Dinner', emoji: '🌙', color: 'text-violet-600' },
  snack: { label: 'Snack', emoji: '🍪', color: 'text-pink-600' },
};

// Whole-family meals are green; each member cycles a distinct colour.
// The legend and the meal cards share this mapping so a colour always
// means the same person.
const FAMILY_COLOR = {
  card: 'bg-green-50 border-green-500',
  badge: 'bg-green-300',
  dot: 'bg-green-400',
};
// Neutral grey for a meal whose member didn't load — never reuse a real
// member's colour for an unknown one (that would misattribute it).
const NEUTRAL_COLOR = {
  card: 'bg-gray-50 border-gray-400',
  badge: 'bg-gray-200',
  dot: 'bg-gray-300',
};
const MEMBER_COLORS = [
  { card: 'bg-amber-50 border-amber-400', badge: 'bg-amber-300', dot: 'bg-amber-300' },
  { card: 'bg-violet-50 border-violet-400', badge: 'bg-violet-300', dot: 'bg-violet-300' },
  { card: 'bg-pink-50 border-pink-400', badge: 'bg-pink-300', dot: 'bg-pink-300' },
  { card: 'bg-cyan-50 border-cyan-400', badge: 'bg-cyan-300', dot: 'bg-cyan-300' },
  { card: 'bg-rose-50 border-rose-400', badge: 'bg-rose-300', dot: 'bg-rose-300' },
  { card: 'bg-sky-50 border-sky-400', badge: 'bg-sky-300', dot: 'bg-sky-300' },
  { card: 'bg-lime-50 border-lime-400', badge: 'bg-lime-300', dot: 'bg-lime-300' },
  { card: 'bg-orange-50 border-orange-400', badge: 'bg-orange-300', dot: 'bg-orange-300' },
  { card: 'bg-teal-50 border-teal-400', badge: 'bg-teal-300', dot: 'bg-teal-300' },
  { card: 'bg-fuchsia-50 border-fuchsia-400', badge: 'bg-fuchsia-300', dot: 'bg-fuchsia-300' },
];

interface MealCell {
  id: string;
  dayOfWeek: Day;
  slot: Slot;
  name: string;
  memberId: string | null;
  recurring: boolean;
}

interface MemberLite {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; meals: MealCell[]; members: MemberLite[] }
  | { kind: 'error'; message: string };

interface Editor {
  day: Day;
  mealId: string | null; // null = adding a new meal
  slot: Slot;
  name: string;
  memberId: string | null;
  recurring: boolean;
}

function colorFor(memberId: string | null, members: MemberLite[]) {
  if (memberId === null) return FAMILY_COLOR;
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx < 0) return NEUTRAL_COLOR;
  return MEMBER_COLORS[idx % MEMBER_COLORS.length]!;
}

function badgeLetter(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'F';
  const m = members.find((x) => x.id === memberId);
  return (m?.displayName.trim()[0] ?? '?').toUpperCase();
}

function labelFor(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'Family';
  return members.find((m) => m.id === memberId)?.displayName ?? 'Family member';
}

// Monday–Sunday of the current week, e.g. "Feb 23 — Mar 1, 2026".
function weekRange(now: Date = new Date()): string {
  const offset = (now.getDay() + 6) % 7; // 0 = Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() - offset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const left = mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const right = sun.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${left} — ${right}`;
}

export function MealsTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'family' | memberId
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const [mealsRes, membersRes] = await Promise.all([
          fetch(`${API_BASE}/api/meals`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/members`, { headers, signal: signal ?? null }),
        ]);
        if (!mountedRef.current) return;
        if (!mealsRes.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load meals (server returned ${mealsRes.status})`,
          });
          return;
        }
        const mealsBody = (await mealsRes.json()) as { meals: MealCell[] };
        let members: MemberLite[] = [];
        if (membersRes.ok) {
          const mb = (await membersRes.json()) as { members: MemberLite[] };
          members = mb.members ?? [];
        }
        setStatus({ kind: 'ready', meals: mealsBody.meals ?? [], members });
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
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [headers, load]);

  const onSave = useCallback(
    async (override?: Partial<Editor>) => {
      if (!editor || !headers || saving) return;
      const ed = { ...editor, ...override };
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`${API_BASE}/api/meals`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayOfWeek: ed.day,
            slot: ed.slot,
            name: ed.name.trim(),
            memberId: ed.memberId,
            recurring: ed.recurring,
          }),
        });
        if (!res.ok) {
          setSaveError(`Couldn't save (server returned ${res.status})`);
          return;
        }
        setEditor(null);
        await load();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error — try again.');
      } finally {
        setSaving(false);
      }
    },
    [editor, headers, saving, load],
  );

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="meals-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading meals…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="meals-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const { meals, members } = status;

  const isVisible = (m: MealCell) => {
    if (filter === 'all') return true;
    if (filter === 'family') return m.memberId === null;
    return m.memberId === filter;
  };

  return (
    <div className="space-y-5" data-testid="meals-ready">
      <header>
        <h2 className="font-heading text-2xl text-black md:text-3xl">Meals</h2>
        <p className="mt-1 text-sm text-gray-600">Family meal planning for the week</p>
      </header>

      {/* Legend + filter pills. */}
      <div
        className="flex flex-col gap-3 rounded-md border-2 border-black bg-white p-3 shadow-neo-sm sm:flex-row sm:items-center sm:justify-between"
        data-testid="meals-legend"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
          <span className="uppercase tracking-wide text-gray-500">Legend:</span>
          <LegendDot label="Family" color={FAMILY_COLOR.dot} />
          {members.map((m, i) => (
            <LegendDot
              key={m.id}
              label={m.displayName}
              color={MEMBER_COLORS[i % MEMBER_COLORS.length]!.dot}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter meals">
          <FilterPill
            testId="meals-filter-all"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
          />
          <FilterPill
            testId="meals-filter-family"
            active={filter === 'family'}
            onClick={() => setFilter('family')}
            label="Family"
          />
          {members.map((m) => (
            <FilterPill
              key={m.id}
              testId={`meals-filter-${m.id}`}
              active={filter === m.id}
              onClick={() => setFilter(m.id)}
              label={m.displayName}
            />
          ))}
        </div>
      </div>

      {/* Week header + slot legend. */}
      <div>
        <h3 className="font-heading text-xl text-black">Weekly Meals 🍽️</h3>
        <p className="text-sm text-gray-600" data-testid="meals-week-range">
          {weekRange()}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-xs font-bold text-gray-600">
          {SLOTS.map((s) => (
            <span key={s}>
              {SLOT_META[s].emoji} {SLOT_META[s].label}
            </span>
          ))}
        </p>
      </div>

      <div className="space-y-4">
        {DAYS.map((day) => {
          const dayMeals = meals.filter((m) => m.dayOfWeek === day && isVisible(m));
          const editorOpen = editor?.day === day;
          return (
            <section
              key={day}
              data-testid={`meals-day-${day}`}
              className="overflow-hidden rounded-md border-2 border-black bg-white shadow-neo-sm"
              aria-labelledby={`meals-day-${day}-h`}
            >
              <div className="border-b-2 border-black px-4 py-2">
                <h4 id={`meals-day-${day}-h`} className="font-heading text-lg text-black">
                  {DAY_LABELS[day]}
                </h4>
              </div>

              <div className="grid grid-cols-1 divide-y-2 divide-black sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x-2">
                {SLOTS.map((slot) => {
                  const cells = dayMeals.filter((m) => m.slot === slot);
                  return (
                    <div
                      key={slot}
                      className="space-y-2 p-3"
                      data-testid={`meals-cell-${day}-${slot}`}
                    >
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wider ${SLOT_META[slot].color}`}
                      >
                        {SLOT_META[slot].emoji} {SLOT_META[slot].label}
                      </p>
                      {cells.map((meal) => (
                        <MealChip
                          key={meal.id}
                          meal={meal}
                          members={members}
                          onEdit={() => {
                            setSaveError(null);
                            setEditor({
                              day: meal.dayOfWeek,
                              mealId: meal.id,
                              slot: meal.slot,
                              name: meal.name,
                              memberId: meal.memberId,
                              recurring: meal.recurring,
                            });
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="border-t-2 border-black p-2">
                {editorOpen ? (
                  <MealEditor
                    editor={editor}
                    members={members}
                    saving={saving}
                    saveError={saveError}
                    onChange={setEditor}
                    onSave={() => void onSave()}
                    onCancel={() => {
                      setEditor(null);
                      setSaveError(null);
                    }}
                    onDelete={() => void onSave({ name: '' })}
                  />
                ) : (
                  <button
                    type="button"
                    data-testid={`meals-add-${day}`}
                    onClick={() => {
                      setSaveError(null);
                      setEditor({
                        day,
                        mealId: null,
                        slot: 'dinner',
                        name: '',
                        memberId: filter === 'all' || filter === 'family' ? null : filter,
                        recurring: false,
                      });
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded border-2 border-dashed border-gray-400 py-2 text-sm font-bold text-gray-500 hover:border-black hover:text-black motion-safe:transition-colors"
                  >
                    + Add Meal
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-700">
      <span className={`h-3 w-3 rounded-full border-2 border-black ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function MealChip({
  meal,
  members,
  onEdit,
}: {
  meal: MealCell;
  members: MemberLite[];
  onEdit: () => void;
}) {
  const color = colorFor(meal.memberId, members);
  const who = labelFor(meal.memberId, members);
  return (
    <button
      type="button"
      data-testid={`meals-meal-${meal.id}`}
      onClick={onEdit}
      className={`block w-full rounded-md border-2 border-black p-2 text-left shadow-neo-xs hover:shadow-neo-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black motion-safe:transition-shadow ${color.card}`}
    >
      <div className="flex items-center gap-2">
        <span
          data-testid={`meals-meal-${meal.id}-avatar`}
          aria-label={who}
          title={who}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black text-[10px] font-bold ${color.badge}`}
        >
          {badgeLetter(meal.memberId, members)}
        </span>
        <span
          data-testid={`meals-meal-${meal.id}-name`}
          className="min-w-0 flex-1 truncate text-sm font-bold text-black"
        >
          {meal.name}
        </span>
      </div>
      {meal.recurring && (
        <span
          data-testid={`meals-meal-${meal.id}-recurring`}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border-2 border-black bg-white px-2 py-0.5 text-[10px] font-bold text-black"
        >
          <Repeat size={10} aria-hidden="true" />
          Weekly
        </span>
      )}
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
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[36px] rounded-full border-2 border-black px-3 py-1 text-xs font-bold motion-safe:transition-colors ${
        active ? 'bg-pink-400 text-black shadow-neo-xs' : 'bg-white text-black hover:bg-yellow-50'
      }`}
    >
      {label}
    </button>
  );
}

function MealEditor({
  editor,
  members,
  saving,
  saveError,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  editor: Editor;
  members: MemberLite[];
  saving: boolean;
  saveError: string | null;
  onChange: (e: Editor) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="space-y-2 rounded border-2 border-black bg-white p-2"
      data-testid="meals-editor"
      id={`meals-editor-${editor.day}`}
      role="group"
      aria-label={editor.mealId !== null ? 'Edit meal' : 'Add meal'}
    >
      <div className="flex flex-wrap gap-2">
        <label className="flex-1 text-xs font-bold text-gray-700">
          Slot
          <select
            data-testid="meals-editor-slot"
            value={editor.slot}
            onChange={(e) => onChange({ ...editor, slot: e.target.value as Slot })}
            className="mt-0.5 block w-full rounded border-2 border-black px-2 py-1 text-sm"
          >
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-xs font-bold text-gray-700">
          For
          <select
            data-testid="meals-editor-member"
            value={editor.memberId ?? ''}
            onChange={(e) => onChange({ ...editor, memberId: e.target.value || null })}
            className="mt-0.5 block w-full rounded border-2 border-black px-2 py-1 text-sm"
          >
            <option value="">Everyone (family)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs font-bold text-gray-700">
        Meal
        <input
          type="text"
          data-testid="meals-editor-name"
          value={editor.name}
          maxLength={120}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- editor only mounts on an explicit add/edit click
          autoFocus
          onChange={(e) => onChange({ ...editor, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="e.g. Spaghetti bolognese"
          className="mt-0.5 block w-full rounded border-2 border-black px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </label>

      <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
        <input
          type="checkbox"
          data-testid="meals-editor-recurring"
          checked={editor.recurring}
          onChange={(e) => onChange({ ...editor, recurring: e.target.checked })}
          className="h-4 w-4 rounded border-2 border-black"
        />
        Repeats weekly
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="meals-editor-save"
          onClick={onSave}
          disabled={saving || editor.name.trim().length === 0}
          className="min-h-[44px] rounded border-2 border-black bg-yellow-300 px-3 py-1 text-sm font-bold text-black disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid="meals-editor-cancel"
          onClick={onCancel}
          disabled={saving}
          className="min-h-[44px] rounded border-2 border-black bg-white px-3 py-1 text-sm font-bold text-black disabled:opacity-50"
        >
          Cancel
        </button>
        {editor.mealId !== null && (
          <button
            type="button"
            data-testid="meals-editor-delete"
            onClick={onDelete}
            disabled={saving}
            className="min-h-[44px] rounded border-2 border-black bg-red-100 px-3 py-1 text-sm font-bold text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {saveError && (
        <p role="alert" data-testid="meals-save-error" className="text-xs font-bold text-red-600">
          {saveError}
        </p>
      )}
    </div>
  );
}
