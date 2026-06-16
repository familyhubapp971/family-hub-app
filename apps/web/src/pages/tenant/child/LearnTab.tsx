import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Book, Check, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';
import { WorldFlags } from './learn/world-flags/WorldFlags';

// Learn Phase 1 — ChildWorld Learn tab.
//
// Left: a 2-col grid of subject cards with progress bars (GET /api/learn).
// Right: a Reading Log panel — add books, mark finished, delete
//        (GET/POST/PATCH/DELETE /api/reading-log).
//
// Learn Phase 2a — World Flags Explore (subject routing):
// Clicking a subject card drills into its detail view. World Flags shows the
// Explore experience (WorldFlagsLearn). Other subjects show "Coming soon."

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  subject: string;
  progress: number;
}

interface Book {
  id: string;
  title: string;
  author: string | null;
  finished: boolean;
  createdAt: string;
}

type Status = 'loading' | 'ready' | 'error';
type SelectedSubject = string | null;

// ─── Subject catalogue ────────────────────────────────────────────────────────

const SUBJECT_STYLE: Record<string, { emoji: string; bg: string }> = {
  Maths: { emoji: '🔢', bg: 'bg-sky-300' },
  'World Flags': { emoji: '🚩', bg: 'bg-amber-300' },
  Logic: { emoji: '🧩', bg: 'bg-violet-300' },
  Science: { emoji: '🔬', bg: 'bg-emerald-300' },
};
const FALLBACK_STYLE = { emoji: '⭐', bg: 'bg-gray-300' };

// ─── Component ────────────────────────────────────────────────────────────────

export function LearnTab({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();

  // Subject routing state — null = overview, string = subject detail
  const [selectedSubject, setSelectedSubject] = useState<SelectedSubject>(null);

  // Learn subjects state
  const [learnStatus, setLearnStatus] = useState<Status>('loading');
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Reading log state
  const [books, setBooks] = useState<Book[]>([]);
  const [booksStatus, setBooksStatus] = useState<Status>('loading');
  const [addTitle, setAddTitle] = useState('');
  const [addAuthor, setAddAuthor] = useState('');
  const [addPending, setAddPending] = useState(false);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  // ── Load subjects ──────────────────────────────────────────────────────────

  const loadSubjects = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const res = await fetch(`${API_BASE}/api/learn?memberId=${memberId}`, {
          headers,
          signal: signal ?? null,
        });
        if (!res.ok) {
          setLearnStatus('error');
          return;
        }
        const body = (await res.json()) as { subjects: Subject[] };
        setSubjects(body.subjects ?? []);
        setLearnStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLearnStatus('error');
      }
    },
    [headers, memberId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadSubjects(ac.signal);
    return () => ac.abort();
  }, [loadSubjects]);

  // ── Load books ─────────────────────────────────────────────────────────────

  const loadBooks = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const res = await fetch(`${API_BASE}/api/reading-log?memberId=${memberId}`, {
          headers,
          signal: signal ?? null,
        });
        if (!res.ok) {
          setBooksStatus('error');
          return;
        }
        const body = (await res.json()) as { books: Book[] };
        setBooks(body.books ?? []);
        setBooksStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setBooksStatus('error');
      }
    },
    [headers, memberId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadBooks(ac.signal);
    return () => ac.abort();
  }, [loadBooks]);

  // ── Add book ───────────────────────────────────────────────────────────────

  const handleAddBook = useCallback(async () => {
    if (!headers || !addTitle.trim()) return;
    setAddPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/reading-log`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          title: addTitle.trim(),
          // exactOptionalPropertyTypes: only include author if non-empty
          ...(addAuthor.trim() ? { author: addAuthor.trim() } : {}),
        }),
      });
      if (res.ok) {
        const book = (await res.json()) as Book;
        setBooks((prev) => [book, ...prev]);
        setAddTitle('');
        setAddAuthor('');
      }
    } finally {
      setAddPending(false);
    }
  }, [headers, memberId, addTitle, addAuthor]);

  // ── Toggle finished ────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (book: Book) => {
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/reading-log/${book.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, finished: !book.finished }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Book;
        setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
    },
    [headers, memberId],
  );

  // ── Delete book ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (bookId: string) => {
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/reading-log/${bookId}?memberId=${memberId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok || res.status === 204) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      }
    },
    [headers, memberId],
  );

  // ── Subject detail views ───────────────────────────────────────────────────

  if (selectedSubject !== null) {
    return (
      <div className="flex flex-col gap-4" data-testid="learn-subject-detail">
        {/* Back button */}
        <button
          data-testid="learn-back"
          type="button"
          onClick={() => setSelectedSubject(null)}
          className="flex min-h-[44px] w-fit items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to subjects
        </button>

        {selectedSubject === 'World Flags' ? (
          <WorldFlags memberId={memberId} />
        ) : (
          /* Coming soon card for subjects not yet built */
          <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm">
            <p className="text-4xl">{SUBJECT_STYLE[selectedSubject]?.emoji ?? '⭐'}</p>
            <h3 className="mt-3 font-heading text-2xl uppercase">{selectedSubject}</h3>
            <p className="mt-2 text-sm text-gray-500">
              This subject is coming soon. Check back later!
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Loading / error (whole-tab) ────────────────────────────────────────────

  if (learnStatus === 'loading' && booksStatus === 'loading') {
    return (
      <p
        data-testid="learn-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your learning…
      </p>
    );
  }
  if (learnStatus === 'error' && booksStatus === 'error') {
    return (
      <p data-testid="learn-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load — try again.
      </p>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="learn-tab">
      {/* ── LEFT: My Learning ── */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm">
          <h2 className="mb-6 flex items-center gap-3 font-heading text-2xl uppercase tracking-wide">
            <BookOpen className="text-green-500" aria-hidden="true" />
            My Learning 🧠
          </h2>

          {learnStatus === 'loading' && (
            <p className="text-sm font-bold text-gray-500">Loading subjects…</p>
          )}
          {learnStatus === 'error' && (
            <p className="text-sm font-bold text-red-500">Couldn&rsquo;t load subjects.</p>
          )}
          {learnStatus === 'ready' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {subjects.map((s) => {
                const style = SUBJECT_STYLE[s.subject] ?? FALLBACK_STYLE;
                const pct = Math.max(0, Math.min(100, s.progress));
                // Slug for testid: lowercase, spaces → hyphens
                const slug = s.subject.toLowerCase().replace(/\s+/g, '-');
                return (
                  <button
                    key={s.subject}
                    type="button"
                    data-testid={`learn-subject-${slug}`}
                    onClick={() => setSelectedSubject(s.subject)}
                    className={`flex flex-col gap-4 rounded-xl border-2 border-black p-5 text-left shadow-neo-xs motion-safe:hover:-translate-y-1 ${style.bg} transition-transform`}
                  >
                    {/* Icon + progress pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white text-2xl">
                        <span aria-hidden="true">{style.emoji}</span>
                      </div>
                      <span className="rounded-full border-2 border-black bg-white px-2 py-1 text-xs font-bold">
                        {pct}%
                      </span>
                    </div>
                    {/* Subject name */}
                    <h3 className="mb-2 font-heading text-xl">{s.subject}</h3>
                    {/* Progress bar */}
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Reading Log ── */}
      <div className="lg:col-span-1">
        <div
          data-testid="reading-log"
          className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm"
        >
          <h3 className="mb-4 flex items-center gap-2 font-heading text-xl uppercase tracking-wide">
            <Book size={20} className="text-blue-500" aria-hidden="true" />
            Reading Log 📚
          </h3>

          {/* Add-book form */}
          <div className="mb-4 flex flex-col gap-2">
            <input
              data-testid="reading-log-add-title"
              type="text"
              placeholder="Book title"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className="min-h-[44px] rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addTitle.trim()) void handleAddBook();
              }}
            />
            <input
              type="text"
              placeholder="Author (optional)"
              value={addAuthor}
              onChange={(e) => setAddAuthor(e.target.value)}
              className="min-h-[44px] rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              data-testid="reading-log-add-submit"
              type="button"
              disabled={!addTitle.trim() || addPending}
              onClick={() => void handleAddBook()}
              className="min-h-[44px] rounded-lg border-2 border-black bg-blue-400 px-4 py-2 text-sm font-bold shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5 disabled:opacity-50"
            >
              {addPending ? 'Adding…' : '+ Add book'}
            </button>
          </div>

          {/* Book list */}
          {booksStatus === 'loading' && <p className="text-sm text-gray-500">Loading books…</p>}
          {booksStatus === 'error' && (
            <p className="text-sm text-red-500">Couldn&rsquo;t load books.</p>
          )}
          {booksStatus === 'ready' && books.length === 0 && (
            <p data-testid="reading-log-empty" className="text-sm text-gray-500">
              No books yet — add one above!
            </p>
          )}
          {booksStatus === 'ready' && books.length > 0 && (
            <ul className="flex flex-col gap-2">
              {books.map((book) => (
                <li
                  key={book.id}
                  data-testid={`reading-log-item-${book.id}`}
                  className="flex items-center gap-3 rounded-lg border-2 border-black bg-blue-50 p-3"
                >
                  {/* Book icon disc */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-blue-200">
                    <Book size={14} aria-hidden="true" />
                  </div>
                  {/* Title + author */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`truncate text-sm font-bold ${book.finished ? 'line-through text-gray-400' : ''}`}
                    >
                      {book.title}
                    </span>
                    {book.author && (
                      <span className="truncate text-xs text-gray-500">{book.author}</span>
                    )}
                  </div>
                  {/* Finished toggle */}
                  <button
                    data-testid={`reading-log-toggle-${book.id}`}
                    type="button"
                    onClick={() => void handleToggle(book)}
                    aria-label={
                      book.finished ? `Unmark ${book.title}` : `Mark ${book.title} as read`
                    }
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black transition-colors ${
                      book.finished ? 'bg-green-400' : 'bg-white hover:bg-green-100'
                    }`}
                  >
                    <Check size={14} />
                  </button>
                  {/* Delete */}
                  <button
                    data-testid={`reading-log-delete-${book.id}`}
                    type="button"
                    onClick={() => void handleDelete(book.id)}
                    aria-label={`Remove ${book.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white transition-colors hover:bg-red-100"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
