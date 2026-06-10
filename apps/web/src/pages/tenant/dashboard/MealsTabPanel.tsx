import { useCallback, useEffect, useMemo, useState } from 'react';
import { Repeat } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-229 / FHS-264 — MealsTabPanel.
//
// The family's weekly meal plan as one card per day. Each meal shows a
// coloured avatar dot for who it's for (a family dot when it's for
// everyone) and a repeat icon when it recurs. Filter pills above the
// grid narrow the view to one member (client-side, from the loaded
// week). Adding / editing a meal opens an inline editor with slot,
// name, who-for, and a "repeats weekly" toggle. Clearing the name
// deletes that meal. Writes go to POST /api/meals (admin/adult only).

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

const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const SLOT_ORDER: Record<Slot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

// Cycled dot colours so each member reads as a distinct person.
const DOT_COLORS = [
  'bg-rose-200',
  'bg-sky-200',
  'bg-amber-200',
  'bg-violet-200',
  'bg-emerald-200',
  'bg-orange-200',
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

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// Stable colour per member id so the same person always reads the same.
function dotColor(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'bg-yellow-200';
  const idx = members.findIndex((m) => m.id === memberId);
  return DOT_COLORS[(idx < 0 ? 0 : idx) % DOT_COLORS.length]!;
}

function AvatarDot({
  member,
  members,
  testId,
}: {
  member: MemberLite | null;
  members: MemberLite[];
  testId: string;
}) {
  const label = member ? member.displayName : 'Everyone';
  const glyph = member ? (member.avatarEmoji ?? initials(member.displayName)) : '👪';
  return (
    <span
      data-testid={testId}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black text-xs ${dotColor(
        member?.id ?? null,
        members,
      )}`}
    >
      {glyph}
    </span>
  );
}

export function MealsTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [filter, setFilter] = useState<string>('all'); // 'all' | memberId
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const [mealsRes, membersRes] = await Promise.all([
          fetch(`${API_BASE}/api/meals`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/members`, { headers, signal: signal ?? null }),
        ]);
        if (!mealsRes.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load meals (server returned ${mealsRes.status})`,
          });
          return;
        }
        const mealsBody = (await mealsRes.json()) as { meals: MealCell[] };
        // Members are best-effort: the plan still renders if they fail
        // (avatar dots fall back to a generic look).
        let members: MemberLite[] = [];
        if (membersRes.ok) {
          const mb = (await membersRes.json()) as { members: MemberLite[] };
          members = mb.members ?? [];
        }
        setStatus({ kind: 'ready', meals: mealsBody.meals ?? [], members });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
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

  // `override` lets callers save a tweaked copy without waiting for a
  // state update to flush — e.g. Remove saves with an empty name.
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
  const membersById = new Map(members.map((m) => [m.id, m]));

  // Filter pills narrow to a member; their own meals plus whole-family
  // meals (which apply to everyone) stay visible.
  const visibleMeals =
    filter === 'all' ? meals : meals.filter((m) => m.memberId === filter || m.memberId === null);

  return (
    <div className="space-y-4" data-testid="meals-ready">
      <header>
        <h2 className="font-heading text-2xl text-black md:text-3xl">Weekly meals</h2>
        <p className="mt-1 text-sm text-gray-600">
          Plan meals for the whole family or just one person. Tap a meal to edit it.
        </p>
      </header>

      {/* Filter pills — client-side narrowing of the loaded week. */}
      <div
        className="flex flex-wrap gap-2"
        data-testid="meals-filters"
        role="group"
        aria-label="Filter meals by member"
      >
        <FilterPill
          testId="meals-filter-all"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All"
        />
        {members.map((m) => (
          <FilterPill
            key={m.id}
            testId={`meals-filter-${m.id}`}
            active={filter === m.id}
            onClick={() => setFilter(m.id)}
            label={`${m.avatarEmoji ?? ''} ${m.displayName}`.trim()}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DAYS.map((day) => {
          const dayMeals = visibleMeals
            .filter((m) => m.dayOfWeek === day)
            .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
          const editorOpen = editor?.day === day;
          return (
            <section
              key={day}
              data-testid={`meals-day-${day}`}
              className="rounded-md border-2 border-black bg-white p-3 shadow-neo-sm"
              aria-labelledby={`meals-day-${day}-h`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 id={`meals-day-${day}-h`} className="font-heading text-lg text-black">
                  {DAY_LABELS[day]}
                </h3>
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
                      memberId: filter === 'all' ? null : filter,
                      recurring: false,
                    });
                  }}
                  className="min-h-[36px] rounded border-2 border-black bg-yellow-300 px-2 py-1 text-xs font-bold text-black hover:bg-yellow-400 motion-safe:transition-colors"
                >
                  + Add
                </button>
              </div>

              {dayMeals.length === 0 && !editorOpen ? (
                <p data-testid={`meals-day-${day}-empty`} className="py-2 text-xs text-gray-400">
                  No meals planned
                </p>
              ) : (
                <ul className="space-y-1">
                  {dayMeals.map((meal) => (
                    <li key={meal.id}>
                      <button
                        type="button"
                        data-testid={`meals-meal-${meal.id}`}
                        onClick={() => {
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
                        className="flex w-full items-center gap-2 rounded border border-black/10 bg-yellow-50 px-2 py-1.5 text-left hover:bg-yellow-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black motion-safe:transition-colors"
                      >
                        <AvatarDot
                          member={meal.memberId ? (membersById.get(meal.memberId) ?? null) : null}
                          members={members}
                          testId={`meals-meal-${meal.id}-avatar`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            {SLOT_LABELS[meal.slot]}
                          </span>
                          <span
                            data-testid={`meals-meal-${meal.id}-name`}
                            className="block truncate text-sm text-black"
                          >
                            {meal.name}
                          </span>
                        </span>
                        {meal.recurring && (
                          <Repeat
                            size={14}
                            aria-label="repeats weekly"
                            data-testid={`meals-meal-${meal.id}-recurring`}
                            className="shrink-0 text-gray-500"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {editorOpen && (
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
              )}
            </section>
          );
        })}
      </div>
    </div>
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
        active ? 'bg-black text-white' : 'bg-white text-black hover:bg-yellow-50'
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
      className="mt-2 space-y-2 rounded border-2 border-black bg-white p-2"
      data-testid="meals-editor"
    >
      <div className="flex gap-2">
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
                {SLOT_LABELS[s]}
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
            <option value="">Everyone</option>
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
