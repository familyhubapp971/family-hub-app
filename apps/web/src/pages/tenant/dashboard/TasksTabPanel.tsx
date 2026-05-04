import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';

// FHS-233 — TasksTabPanel.
//
// Per-member personal to-do list (private; only the assigned member
// sees their own). Same UX as the family-wide AssignmentsTabPanel
// (To-do vs Done split, optimistic toggle, inline + Add) but the
// API never leaks another member's tasks.

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
}

interface ListTasksResponse {
  tasks: Task[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; tasks: Task[] }
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

export function TasksTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const togglingRef = useRef<Set<string>>(new Set());
  const deletingRef = useRef<Set<string>>(new Set());

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
      const res = await fetch('/api/tasks', { headers });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load tasks (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as ListTasksResponse;
      setStatus({ kind: 'ready', tasks: body.tasks });
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
        const res = await fetch('/api/tasks', { headers, signal: ac.signal });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load tasks (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as ListTasksResponse;
        if (cancelled) return;
        setStatus({ kind: 'ready', tasks: body.tasks });
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
      const trimmed = draft.title.trim();
      if (!trimmed) {
        setSaveError('Title is required.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed, dueDate: draft.dueDate || null }),
        });
        if (!res.ok) {
          let detail = `Couldn't save (server returned ${res.status})`;
          try {
            const body = (await res.json()) as {
              error?: string;
              detail?: string;
              issues?: Array<{ message?: string }>;
            };
            if (body.detail) detail = body.detail;
            else if (body.issues?.[0]?.message) detail = body.issues[0].message;
            else if (body.error) detail = body.error;
          } catch {
            /* non-JSON body */
          }
          setSaveError(detail);
          return;
        }
        setAdding(false);
        setStatusAnnouncement(`Added task "${trimmed}"`);
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
      let priorRow: Task | undefined;
      let title = '';
      setStatus((s) => {
        if (s.kind !== 'ready') return s;
        const row = s.tasks.find((t) => t.id === id);
        if (row) {
          priorRow = { ...row };
          title = row.title;
        }
        return {
          kind: 'ready',
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null }
              : t,
          ),
        };
      });
      const revert = () => {
        if (!priorRow) return;
        setStatus((s) =>
          s.kind === 'ready'
            ? { kind: 'ready', tasks: s.tasks.map((t) => (t.id === id ? priorRow! : t)) }
            : s,
        );
      };
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: nextDone }),
        });
        if (!res.ok) {
          revert();
          setErrorAnnouncement(`Couldn't update task (server returned ${res.status})`);
        } else {
          setStatusAnnouncement(
            nextDone ? `Marked "${title}" done` : `Moved "${title}" back to to-do`,
          );
          setErrorAnnouncement('');
        }
      } catch {
        revert();
        setErrorAnnouncement("Network error — couldn't update task.");
      } finally {
        togglingRef.current.delete(id);
      }
    },
    [headers],
  );

  const onDelete = useCallback(
    async (id: string) => {
      if (!headers || deletingRef.current.has(id)) return;
      deletingRef.current.add(id);
      try {
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers });
        if (!res.ok) {
          setErrorAnnouncement(`Couldn't delete task (server returned ${res.status})`);
          return;
        }
        setStatusAnnouncement('Task deleted');
        setErrorAnnouncement('');
        await refetch();
      } catch (err) {
        setErrorAnnouncement(
          err instanceof Error ? err.message : "Network error — couldn't delete task.",
        );
      } finally {
        deletingRef.current.delete(id);
      }
    },
    [headers, refetch],
  );

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="tasks-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading tasks…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="tasks-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const open = status.tasks.filter((t) => !t.done);
  const done = status.tasks.filter((t) => t.done);

  return (
    <div className="space-y-4" data-testid="tasks-ready">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl text-black md:text-3xl">My tasks</h2>
          <p className="mt-1 text-sm text-gray-600">Just for you — your private to-do list.</p>
        </div>
        <Button
          ref={addButtonRef}
          type="button"
          variant="primary"
          size="sm"
          onClick={onAddOpen}
          testId="tasks-add"
        >
          + Add
        </Button>
      </header>

      <p aria-live="polite" className="sr-only" data-testid="tasks-status-announcement">
        {statusAnnouncement}
      </p>
      <p
        aria-live="assertive"
        role="alert"
        className="sr-only"
        data-testid="tasks-error-announcement"
      >
        {errorAnnouncement}
      </p>

      {adding && (
        <Card className="border-2 border-black bg-yellow-50 p-4 shadow-neo-sm">
          <form
            onSubmit={onAddSubmit}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            data-testid="tasks-add-form"
          >
            <label className="flex flex-col gap-1 text-sm font-bold text-black sm:col-span-2">
              Title
              <input
                type="text"
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                data-testid="tasks-add-title"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Due date (optional)
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                data-testid="tasks-add-due"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            {saveError && (
              <p
                role="alert"
                data-testid="tasks-add-error"
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
                testId="tasks-add-submit"
              >
                {saving ? 'Saving…' : 'Add'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddCancel}
                disabled={saving}
                testId="tasks-add-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section aria-labelledby="tasks-open-heading">
        <h3 id="tasks-open-heading" className="mb-2 font-heading text-lg text-black">
          To do
          <span className="ml-2 font-mono text-xs text-gray-500">{open.length}</span>
        </h3>
        {open.length === 0 ? (
          <p className="text-sm text-gray-600" data-testid="tasks-open-empty">
            Nothing to do — nice!
          </p>
        ) : (
          <ul className="space-y-2" data-testid="tasks-open-list">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={onToggleDone} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tasks-done-heading">
        <h3 id="tasks-done-heading" className="mb-2 font-heading text-lg text-black">
          Done
          <span className="ml-2 font-mono text-xs text-gray-500">{done.length}</span>
        </h3>
        {done.length === 0 ? (
          <p className="text-sm text-gray-400" data-testid="tasks-done-empty">
            No completed items yet.
          </p>
        ) : (
          <ul className="space-y-2 opacity-70" data-testid="tasks-done-list">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={onToggleDone} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string, nextDone: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li data-testid={`task-row-${task.id}`}>
      <Card className="flex items-center gap-3 border-2 border-black bg-white p-3 shadow-neo-sm">
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => onToggle(task.id, e.target.checked)}
          aria-label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
          data-testid={`task-toggle-${task.id}`}
          className="h-6 w-6 shrink-0 cursor-pointer accent-yellow-400"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`font-heading text-base text-black ${task.done ? 'line-through' : ''}`}
            data-testid={`task-title-${task.id}`}
          >
            {task.title}
          </p>
          <p className="text-xs text-gray-600" data-testid={`task-due-${task.id}`}>
            {formatDueDate(task.dueDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          aria-label={`Delete task: ${task.title.slice(0, 40)}`}
          data-testid={`task-delete-${task.id}`}
          className="min-h-[44px] min-w-[44px] shrink-0 rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          Delete
        </button>
      </Card>
    </li>
  );
}
