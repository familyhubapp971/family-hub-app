import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-270 — ChildWorld Journal tab.
//
// A child's private text journal: write an entry, see them newest-first.
// Scoped to (tenant, member) server-side. Parent-accessed route.

interface Entry {
  id: string;
  body: string;
  createdAt: string;
}

type Status = 'loading' | 'ready' | 'error';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function JournalTab({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const res = await fetch(`${API_BASE}/api/journal?memberId=${memberId}`, {
          headers,
          signal: signal ?? null,
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { entries: Entry[] };
        setEntries(body.entries ?? []);
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

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!headers || savingRef.current) return;
      const trimmed = draft.trim();
      if (!trimmed) {
        setSaveError('Write something first.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`${API_BASE}/api/journal`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, body: trimmed }),
        });
        if (!res.ok) {
          setSaveError(`Couldn't save (server returned ${res.status}).`);
          return;
        }
        const entry = (await res.json()) as Entry;
        setEntries((prev) => [entry, ...prev]);
        setDraft('');
      } catch {
        setSaveError('Network error — try again.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [headers, draft, memberId],
  );

  if (status === 'loading') {
    return (
      <p
        data-testid="journal-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your journal…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="journal-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your journal — try again.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="journal-tab">
      <form
        onSubmit={onSubmit}
        data-testid="journal-add-form"
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm"
      >
        <label className="flex flex-col gap-2 text-sm font-bold text-black">
          What&rsquo;s on your mind today?
          <textarea
            rows={3}
            maxLength={5000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            data-testid="journal-add-body"
            className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </label>
        {saveError && (
          <p
            role="alert"
            data-testid="journal-add-error"
            className="mt-2 text-xs font-bold text-red-600"
          >
            {saveError}
          </p>
        )}
        <div className="mt-3">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving}
            testId="journal-add-submit"
          >
            {saving ? 'Saving…' : 'Add entry'}
          </Button>
        </div>
      </form>

      {entries.length === 0 ? (
        <div
          data-testid="journal-empty"
          className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
        >
          <p aria-hidden="true" className="text-5xl">
            📔
          </p>
          <p className="mt-3 text-sm font-bold text-gray-600">
            No entries yet — write your first one!
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="journal-list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid={`journal-entry-${entry.id}`}
              className="rounded-xl border-2 border-black bg-amber-50 p-4 shadow-neo-xs"
            >
              <p className="whitespace-pre-wrap break-words text-sm text-black">{entry.body}</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {formatWhen(entry.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
