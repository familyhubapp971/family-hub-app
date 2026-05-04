import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';

// FHS-232 — NoticeboardTabPanel.
//
// Family bulletin board. Pinned notes float to the top; everything
// else lists newest-first. Inline + Add textarea (with optional pin
// checkbox); per-row delete button (admin/adult only — the API
// gates, the UI shows the button optimistically and surfaces the
// 403 if a non-admin role somehow reaches it).

interface Notice {
  id: string;
  body: string;
  pinned: boolean;
  authorMemberId: string | null;
  createdAt: string;
}

interface ListNoticesResponse {
  notices: Notice[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; notices: Notice[] }
  | { kind: 'error'; message: string };

function formatPostedAt(iso: string): string {
  const dt = new Date(iso);
  return dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NoticeboardTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ body: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
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
      const res = await fetch('/api/notices', { headers });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load notices (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as ListNoticesResponse;
      setStatus({ kind: 'ready', notices: body.notices });
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
        const res = await fetch('/api/notices', { headers, signal: ac.signal });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load notices (server returned ${res.status})`,
          });
          return;
        }
        const body = (await res.json()) as ListNoticesResponse;
        if (cancelled) return;
        setStatus({ kind: 'ready', notices: body.notices });
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
    setDraft({ body: '', pinned: false });
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
      const trimmed = draft.body.trim();
      if (!trimmed) {
        setSaveError('Note text is required.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/notices', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed, pinned: draft.pinned }),
        });
        if (!res.ok) {
          let detail = `Couldn't save (server returned ${res.status})`;
          try {
            const body = (await res.json()) as {
              error?: string;
              detail?: string;
              issues?: Array<{ message?: string }>;
            };
            // Prefer the human-readable `detail` ("only admins and
            // adults can post notices") over the machine-readable
            // `error` ("forbidden"); fall back to the first Zod issue.
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
        setStatusAnnouncement(draft.pinned ? 'Pinned note added' : 'Note added');
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

  const onDelete = useCallback(
    async (id: string) => {
      if (!headers || deletingRef.current.has(id)) return;
      deletingRef.current.add(id);
      try {
        const res = await fetch(`/api/notices/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) {
          // 403 has a specific cause — surface the role gate clearly so
          // a teen/child who somehow reaches the button understands.
          const friendly =
            res.status === 403
              ? 'Only admins and adults can delete notices.'
              : `Couldn't delete note (server returned ${res.status})`;
          setErrorAnnouncement(friendly);
          return;
        }
        setStatusAnnouncement('Note deleted');
        setErrorAnnouncement('');
        await refetch();
      } catch (err) {
        setErrorAnnouncement(
          err instanceof Error ? err.message : "Network error — couldn't delete note.",
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
        data-testid="notices-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading notices…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="notices-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const pinned = status.notices.filter((n) => n.pinned);
  const rest = status.notices.filter((n) => !n.pinned);

  return (
    <div className="space-y-4" data-testid="notices-ready">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl text-black md:text-3xl">Noticeboard</h2>
          <p className="mt-1 text-sm text-gray-600">
            Family bulletin board — pin the things everyone needs to see.
          </p>
        </div>
        <Button
          ref={addButtonRef}
          type="button"
          variant="primary"
          size="sm"
          onClick={onAddOpen}
          testId="notices-add"
        >
          + Add
        </Button>
      </header>

      <p aria-live="polite" className="sr-only" data-testid="notices-status-announcement">
        {statusAnnouncement}
      </p>
      <p
        aria-live="assertive"
        role="alert"
        className="sr-only"
        data-testid="notices-error-announcement"
      >
        {errorAnnouncement}
      </p>

      {adding && (
        <Card className="border-2 border-black bg-yellow-50 p-4 shadow-neo-sm">
          <form
            onSubmit={onAddSubmit}
            className="flex flex-col gap-3"
            data-testid="notices-add-form"
          >
            <label className="flex flex-col gap-1 text-sm font-bold text-black">
              Note
              <textarea
                required
                rows={3}
                maxLength={2000}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                data-testid="notices-add-body"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-black">
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                data-testid="notices-add-pinned"
                className="h-6 w-6 cursor-pointer accent-yellow-400"
              />
              Pin to top
            </label>
            {saveError && (
              <p
                role="alert"
                data-testid="notices-add-error"
                className="text-xs font-bold text-red-600"
              >
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                testId="notices-add-submit"
              >
                {saving ? 'Saving…' : 'Post note'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddCancel}
                disabled={saving}
                testId="notices-add-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {pinned.length > 0 && (
        <section aria-labelledby="notices-pinned-heading">
          <h3 id="notices-pinned-heading" className="mb-2 font-heading text-lg text-black">
            <span aria-hidden="true">📌 </span>Pinned
            <span className="ml-2 font-mono text-xs text-gray-500">{pinned.length}</span>
          </h3>
          <ul className="space-y-2" data-testid="notices-pinned-list">
            {pinned.map((n) => (
              <NoticeRow key={n.id} notice={n} onDelete={onDelete} />
            ))}
          </ul>
        </section>
      )}

      {/* Hide the secondary section entirely when there are pinned
          notes but no others — an empty "More notes" subhead next to a
          full Pinned section reads as broken. */}
      {(rest.length > 0 || pinned.length === 0) && (
        <section aria-labelledby="notices-feed-heading">
          <h3 id="notices-feed-heading" className="mb-2 font-heading text-lg text-black">
            {pinned.length > 0 ? 'More notes' : 'Notes'}
            <span className="ml-2 font-mono text-xs text-gray-500">{rest.length}</span>
          </h3>
          {rest.length === 0 ? (
            <p className="text-sm text-gray-600" data-testid="notices-feed-empty">
              No notes yet — post one above.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="notices-feed-list">
              {rest.map((n) => (
                <NoticeRow key={n.id} notice={n} onDelete={onDelete} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function NoticeRow({ notice, onDelete }: { notice: Notice; onDelete: (id: string) => void }) {
  return (
    <li data-testid={`notice-row-${notice.id}`}>
      <Card className="flex items-start gap-3 border-2 border-black bg-white p-3 shadow-neo-sm">
        <div className="min-w-0 flex-1">
          <p
            className="whitespace-pre-wrap break-words font-body text-sm text-black"
            data-testid={`notice-body-${notice.id}`}
          >
            {notice.body}
          </p>
          <p className="mt-1 text-xs text-gray-500" data-testid={`notice-time-${notice.id}`}>
            {formatPostedAt(notice.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(notice.id)}
          aria-label={`Delete note: ${notice.body.slice(0, 40)}`}
          data-testid={`notice-delete-${notice.id}`}
          className="min-h-[44px] min-w-[44px] shrink-0 rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          Delete
        </button>
      </Card>
    </li>
  );
}
