import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';

// FHS-229 — MealsTabPanel.
//
// Renders the family's weekly meal plan as a 7-row × 4-column grid
// (Mon-Sun × breakfast/lunch/dinner/snack). Click a cell → inline
// input → blur or Enter saves via POST /api/meals; clearing the cell
// deletes the row.

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type Day = (typeof DAYS)[number];
type Slot = (typeof SLOTS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

interface MealCell {
  id: string;
  dayOfWeek: Day;
  slot: Slot;
  name: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; meals: Map<string, MealCell> }
  | { kind: 'error'; message: string };

function cellKey(day: Day, slot: Slot): string {
  return `${day}:${slot}`;
}

export function MealsTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [editing, setEditing] = useState<{ day: Day; slot: Slot } | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Refs to focus the cell button after save completes (a11y).
  const cellButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  const refetch = useCallback(async () => {
    if (!headers) return;
    try {
      const res = await fetch('/api/meals', { headers });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load meals (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as { meals: MealCell[] };
      const map = new Map<string, MealCell>();
      for (const m of body.meals) map.set(cellKey(m.dayOfWeek, m.slot), m);
      setStatus({ kind: 'ready', meals: map });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error — try again.',
      });
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/meals', { headers, signal: ac.signal });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load meals (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as { meals: MealCell[] };
        if (cancelled) return;
        const map = new Map<string, MealCell>();
        for (const m of body.meals) map.set(cellKey(m.dayOfWeek, m.slot), m);
        setStatus({ kind: 'ready', meals: map });
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
  }, [headers]);

  const onCellClick = useCallback((day: Day, slot: Slot, current: string) => {
    // If another cell is open with unsaved input, drop the draft and
    // open the new cell. (Auto-saving the previous cell would surprise
    // users who tapped the wrong cell first.)
    setSaveError(null);
    setEditing({ day, slot });
    setDraft(current);
  }, []);

  const onCancel = useCallback(() => {
    setEditing(null);
    setDraft('');
    setSaveError(null);
  }, []);

  const onSave = useCallback(async () => {
    if (!editing || !headers || saving) return;
    const trimmed = draft.trim();
    const targetCell = { day: editing.day, slot: editing.slot };
    setSaving(true);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: targetCell.day,
          slot: targetCell.slot,
          name: trimmed,
        }),
      });
      if (!res.ok) {
        setSaveError(`Couldn't save (server returned ${res.status})`);
        return;
      }
      setEditing(null);
      setDraft('');
      await refetch();
      // Return focus to the cell button so keyboard users don't lose their place.
      requestAnimationFrame(() => {
        const btn = cellButtonRefs.current.get(cellKey(targetCell.day, targetCell.slot));
        btn?.focus();
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error — try again.');
    } finally {
      setSaving(false);
    }
  }, [editing, draft, headers, refetch, saving]);

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

  return (
    <div className="space-y-4" data-testid="meals-ready">
      <header>
        <h2 className="font-heading text-2xl text-black md:text-3xl">Weekly meals</h2>
        <p className="mt-1 text-sm text-gray-600">
          Click a slot to plan a meal. Clear the box to remove it.
        </p>
      </header>

      <div
        className="overflow-x-auto rounded-md border-2 border-black shadow-neo-sm"
        data-testid="meals-grid"
      >
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-yellow-50">
            <tr>
              <th
                scope="col"
                className="w-20 border-b-2 border-black p-2 text-left font-heading text-black"
              >
                Day
              </th>
              {SLOTS.map((slot) => (
                <th
                  key={slot}
                  scope="col"
                  className="border-b-2 border-l-2 border-black p-2 text-left font-heading text-black"
                >
                  {SLOT_LABELS[slot]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day} data-testid={`meals-row-${day}`}>
                <th
                  scope="row"
                  className="border-b border-black bg-yellow-50 p-2 text-left font-heading text-black"
                >
                  {DAY_LABELS[day]}
                </th>
                {SLOTS.map((slot) => {
                  const k = cellKey(day, slot);
                  const cell = status.meals.get(k);
                  const isEditing = editing?.day === day && editing.slot === slot;
                  return (
                    <td
                      key={slot}
                      className="border-b border-l border-black bg-white p-1 align-top"
                      data-testid={`meals-cell-${day}-${slot}`}
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void onSave();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onCancel();
                              }
                            }}
                            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: input only mounts after the user clicks the cell to enter edit mode, so focus is expected
                            autoFocus
                            maxLength={120}
                            aria-label={`${DAY_LABELS[day]} ${SLOT_LABELS[slot]} meal`}
                            data-testid={`meals-input-${day}-${slot}`}
                            className="w-full rounded border-2 border-black px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void onSave()}
                              disabled={saving}
                              data-testid={`meals-save-${day}-${slot}`}
                              className="min-h-[44px] rounded border-2 border-black bg-yellow-300 px-3 py-1 text-sm font-bold text-black disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={onCancel}
                              disabled={saving}
                              data-testid={`meals-cancel-${day}-${slot}`}
                              className="min-h-[44px] rounded border-2 border-black bg-white px-3 py-1 text-sm font-bold text-black disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                          {saveError && (
                            <p
                              role="alert"
                              data-testid="meals-save-error"
                              className="text-xs font-bold text-red-600"
                            >
                              {saveError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          ref={(el) => {
                            if (el) cellButtonRefs.current.set(k, el);
                            else cellButtonRefs.current.delete(k);
                          }}
                          type="button"
                          onClick={() => onCellClick(day, slot, cell?.name ?? '')}
                          data-testid={`meals-cell-button-${day}-${slot}`}
                          className="block w-full min-h-[44px] rounded px-2 py-1 text-left text-sm text-black hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        >
                          {cell && cell.name.length > 0 ? (
                            <span data-testid={`meals-cell-name-${day}-${slot}`}>{cell.name}</span>
                          ) : (
                            <span className="text-gray-400">+ Add</span>
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Decorative card to keep visual rhythm with the dashboard. */}
      <Card className="hidden border-2 border-black p-3 text-xs text-gray-600 md:block">
        Tip — assign repeated favourites once and tweak as the week unfolds.
      </Card>
    </div>
  );
}
