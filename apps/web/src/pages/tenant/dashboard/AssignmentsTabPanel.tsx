import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';

// FHS-231 — AssignmentsTabPanel.
//
// Family homework / chores list. Sorted by due-date ascending (NULLS
// last via the API). Click the checkbox to toggle done; the row dims
// when complete. + Add opens an inline form for title + optional due
// date.

interface Assignment {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  memberId: string | null;
  done: boolean;
  doneAt: string | null;
}

interface ListAssignmentsResponse {
  assignments: Assignment[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; assignments: Assignment[] }
  | { kind: 'error'; message: string };

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date';
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function AssignmentsTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Two live regions: polite for successes ("Added X", "Marked Y done"),
  // assertive for errors. Mixing them confuses screen readers — a polite
  // announce read after an error gets the priorities wrong.
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Per-row toggle in-flight set so the same row isn't double-toggled.
  const togglingRef = useRef<Set<string>>(new Set());

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
      const res = await fetch('/api/assignments', { headers });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load assignments (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as ListAssignmentsResponse;
      setStatus({ kind: 'ready', assignments: body.assignments });
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
        const res = await fetch('/api/assignments', { headers, signal: ac.signal });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load assignments (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as ListAssignmentsResponse;
        if (cancelled) return;
        setStatus({ kind: 'ready', assignments: body.assignments });
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

  const onAddOpen = useCallback(() => {
    setAdding(true);
    setSaveError(null);
    setDraft({ title: '', dueDate: '' });
  }, []);

  const onAddCancel = useCallback(() => {
    setAdding(false);
    setSaveError(null);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  const onAddSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
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
        const res = await fetch('/api/assignments', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            dueDate: draft.dueDate || null,
          }),
        });
        if (!res.ok) {
          let detail = `Couldn't save (server returned ${res.status})`;
          try {
            const body = (await res.json()) as {
              error?: string;
              issues?: Array<{ message?: string }>;
            };
            if (body.issues?.[0]?.message) detail = body.issues[0].message;
            else if (body.error) detail = body.error;
          } catch {
            /* non-JSON body */
          }
          setSaveError(detail);
          return;
        }
        setAdding(false);
        setStatusAnnouncement(`Added assignment "${trimmedTitle}"`);
        setErrorAnnouncement('');
        await refetch();
        requestAnimationFrame(() => addButtonRef.current?.focus());
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error — try again.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [headers, draft, refetch],
  );

  const onToggleDone = useCallback(
    async (id: string, nextDone: boolean) => {
      if (!headers || togglingRef.current.has(id)) return;
      togglingRef.current.add(id);

      // Snapshot the row's prior state so we can revert in-place on
      // failure — no refetch flash where the user sees their checkbox
      // stay flipped for a beat before bouncing back.
      let priorRow: Assignment | undefined;
      let title = '';
      setStatus((s) => {
        if (s.kind !== 'ready') return s;
        const row = s.assignments.find((a) => a.id === id);
        if (row) {
          priorRow = { ...row };
          title = row.title;
        }
        return {
          kind: 'ready',
          assignments: s.assignments.map((a) =>
            a.id === id
              ? { ...a, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null }
              : a,
          ),
        };
      });

      const revert = () => {
        if (!priorRow) return;
        setStatus((s) =>
          s.kind === 'ready'
            ? {
                kind: 'ready',
                assignments: s.assignments.map((a) => (a.id === id ? priorRow! : a)),
              }
            : s,
        );
      };

      try {
        const res = await fetch(`/api/assignments/${id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: nextDone }),
        });
        if (!res.ok) {
          revert();
          setErrorAnnouncement(`Couldn't update assignment (server returned ${res.status})`);
        } else {
          // Polite confirmation that the row moved between sections.
          setStatusAnnouncement(
            nextDone ? `Marked "${title}" done` : `Moved "${title}" back to to-do`,
          );
          setErrorAnnouncement('');
        }
      } catch {
        revert();
        setErrorAnnouncement("Network error — couldn't update assignment.");
      } finally {
        togglingRef.current.delete(id);
      }
    },
    [headers],
  );

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="assignments-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading assignments…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="assignments-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const open = status.assignments.filter((a) => !a.done);
  const done = status.assignments.filter((a) => a.done);

  return (
    <div className="space-y-4" data-testid="assignments-ready">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl text-black md:text-3xl">Assignments</h2>
          <p className="mt-1 text-sm text-gray-600">Homework, chores, anything with a due date.</p>
        </div>
        <Button
          ref={addButtonRef}
          type="button"
          variant="primary"
          size="sm"
          onClick={onAddOpen}
          testId="assignments-add"
        >
          + Add
        </Button>
      </header>

      <p aria-live="polite" className="sr-only" data-testid="assignments-status-announcement">
        {statusAnnouncement}
      </p>
      <p
        aria-live="assertive"
        role="alert"
        className="sr-only"
        data-testid="assignments-error-announcement"
      >
        {errorAnnouncement}
      </p>

      {adding && (
        <Card className="border-2 border-black bg-yellow-50 p-4 shadow-neo-sm">
          <form
            onSubmit={onAddSubmit}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            data-testid="assignments-add-form"
          >
            <label className="flex flex-col gap-1 text-sm font-bold text-black sm:col-span-2">
              Title
              <input
                type="text"
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                data-testid="assignments-add-title"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Due date (optional)
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                data-testid="assignments-add-due"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            {saveError && (
              <p
                role="alert"
                data-testid="assignments-add-error"
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
                testId="assignments-add-submit"
              >
                {saving ? 'Saving…' : 'Add'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddCancel}
                disabled={saving}
                testId="assignments-add-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section aria-labelledby="assignments-open-heading">
        <h3 id="assignments-open-heading" className="mb-2 font-heading text-lg text-black">
          To do
          <span className="ml-2 font-mono text-xs text-gray-500">{open.length}</span>
        </h3>
        {open.length === 0 ? (
          <p className="text-sm text-gray-600" data-testid="assignments-open-empty">
            Nothing to do — nice!
          </p>
        ) : (
          <ul className="space-y-2" data-testid="assignments-open-list">
            {open.map((a) => (
              <AssignmentRow key={a.id} assignment={a} onToggle={onToggleDone} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="assignments-done-heading">
        <h3 id="assignments-done-heading" className="mb-2 font-heading text-lg text-black">
          Done
          <span className="ml-2 font-mono text-xs text-gray-500">{done.length}</span>
        </h3>
        {done.length === 0 ? (
          <p className="text-sm text-gray-400" data-testid="assignments-done-empty">
            No completed items yet.
          </p>
        ) : (
          <ul className="space-y-2 opacity-70" data-testid="assignments-done-list">
            {done.map((a) => (
              <AssignmentRow key={a.id} assignment={a} onToggle={onToggleDone} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AssignmentRow({
  assignment,
  onToggle,
}: {
  assignment: Assignment;
  onToggle: (id: string, nextDone: boolean) => void;
}) {
  return (
    <li data-testid={`assignment-row-${assignment.id}`}>
      <Card className="flex items-center gap-3 border-2 border-black bg-white p-3 shadow-neo-sm">
        <input
          type="checkbox"
          checked={assignment.done}
          onChange={(e) => onToggle(assignment.id, e.target.checked)}
          aria-label={`Mark "${assignment.title}" ${assignment.done ? 'not done' : 'done'}`}
          data-testid={`assignment-toggle-${assignment.id}`}
          className="h-6 w-6 shrink-0 cursor-pointer accent-yellow-400"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`font-heading text-base text-black ${assignment.done ? 'line-through' : ''}`}
            data-testid={`assignment-title-${assignment.id}`}
          >
            {assignment.title}
          </p>
          <p className="text-xs text-gray-600" data-testid={`assignment-due-${assignment.id}`}>
            {formatDueDate(assignment.dueDate)}
          </p>
        </div>
      </Card>
    </li>
  );
}
