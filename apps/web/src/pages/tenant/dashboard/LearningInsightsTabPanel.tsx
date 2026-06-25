import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, BookOpen, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-385 — parent "Learning Insights" dashboard tab.
// Consumes GET /api/learn/insights?memberId=<id> (FHS-384 API).
// Read-only: parents view each child's progress. Never initiates lessons.

// ─── API shapes ────────────────────────────────────────────────────────────

type Subject = 'Maths' | 'Logic' | 'Science' | 'World Flags';

interface SubjectProgress {
  subject: Subject;
  progressPct: number;
  certificatesEarned: number;
  certificatesTotal: number;
  lastActive: string | null;
  needsHelp: boolean;
}

interface WeakestArea {
  subject: string;
  detail: string;
  tip: string;
}

interface InsightsResponse {
  memberId: string;
  displayName: string;
  subjects: SubjectProgress[];
  weakest: WeakestArea | null;
  hasActivity: boolean;
}

interface ChildMember {
  id: string;
  displayName: string;
  role: string;
}

// ─── Subject theme map ─────────────────────────────────────────────────────

const SUBJECT_THEME: Record<Subject, { bg: string; ring: string; label: string; emoji: string }> = {
  Maths: { bg: 'bg-yellow-100', ring: 'border-yellow-400', label: 'Maths', emoji: '🔢' },
  Logic: { bg: 'bg-cyan-100', ring: 'border-cyan-400', label: 'Logic', emoji: '🧩' },
  Science: { bg: 'bg-green-100', ring: 'border-green-400', label: 'Science', emoji: '🔬' },
  'World Flags': { bg: 'bg-pink-100', ring: 'border-pink-400', label: 'World Flags', emoji: '🌍' },
};

function subjectTheme(subject: string) {
  return (
    SUBJECT_THEME[subject as Subject] ?? {
      bg: 'bg-purple-100',
      ring: 'border-purple-400',
      label: subject,
      emoji: '📚',
    }
  );
}

// ─── Pastel disc colour keyed on memberId ──────────────────────────────────

const CHILD_COLORS = [
  'bg-purple-300',
  'bg-yellow-300',
  'bg-pink-300',
  'bg-cyan-300',
  'bg-green-300',
];
function childColor(memberId: string): string {
  const hash = [...memberId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CHILD_COLORS[hash % CHILD_COLORS.length] ?? 'bg-purple-300';
}

// ─── Relative-time helper ──────────────────────────────────────────────────

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ─── Sub-components ────────────────────────────────────────────────────────

/** Circular SVG progress ring with accessible label.
 * Fix #3: pct clamped to 0-100 before SVG math and aria-label. */
function ProgressRing({
  pct,
  size = 64,
  stroke = 6,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const cx = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={label}
      role="img"
      data-testid="progress-ring"
    >
      {/* Track */}
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      {/* Fill */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="#7c3aed"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      {/* Percentage label */}
      <text
        x={cx}
        y={cx + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 5}
        fontWeight="bold"
        fill="#1f2937"
        aria-hidden="true"
      >
        {clamped}%
      </text>
    </svg>
  );
}

/** Per-subject card. */
function SubjectCard({ sub }: { sub: SubjectProgress }) {
  const theme = subjectTheme(sub.subject);
  const slug = sub.subject.toLowerCase().replace(/\s+/g, '-');
  return (
    <article
      data-testid={`subject-card-${slug}`}
      className={`flex flex-col gap-3 rounded-xl border-2 border-black p-4 shadow-neo-sm ${theme.bg}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-lg">
          <span aria-hidden="true">{theme.emoji}</span>
          {theme.label}
        </h3>
        {sub.needsHelp && (
          <span
            data-testid={`needs-help-chip-${slug}`}
            className="flex items-center gap-1 rounded-full border-2 border-red-400 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700"
            role="status"
            aria-label={`${sub.subject}: needs help`}
          >
            <AlertTriangle size={10} aria-hidden="true" />
            Needs help
          </span>
        )}
      </div>

      {/* Progress ring + certs */}
      <div className="flex items-center gap-4">
        <ProgressRing
          pct={sub.progressPct}
          label={`${sub.subject} progress: ${Math.min(100, Math.max(0, sub.progressPct))}%`}
        />
        <div className="flex flex-col gap-1">
          <div data-testid={`subject-certs-${slug}`} className="flex items-center gap-1.5">
            <Award size={14} className="text-yellow-600" aria-hidden="true" />
            <span className="text-sm font-bold text-gray-700">
              {sub.certificatesEarned}/{sub.certificatesTotal} certs
            </span>
          </div>
          <div data-testid={`subject-last-active-${slug}`} className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" aria-hidden="true" />
            <span className="text-xs font-bold text-gray-500">{relativeDate(sub.lastActive)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Panel shown when weakest is non-null. */
function WeakestAreaPanel({ weakest }: { weakest: WeakestArea }) {
  return (
    <section
      data-testid="weakest-panel"
      aria-labelledby="weakest-panel-heading"
      className="rounded-xl border-2 border-black bg-[#3d1065] p-5 text-white shadow-neo-sm"
    >
      <h3
        id="weakest-panel-heading"
        className="mb-3 flex items-center gap-2 font-heading text-xl text-yellow-300"
      >
        <AlertTriangle size={18} aria-hidden="true" />
        Where they&apos;re stuck
      </h3>
      <p className="mb-1 font-heading text-lg" data-testid="weakest-subject">
        {weakest.subject}
      </p>
      <p className="mb-3 text-sm font-bold text-purple-200" data-testid="weakest-detail">
        {weakest.detail}
      </p>
      <div className="rounded-lg border border-purple-700 bg-purple-900/50 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-purple-300">Parent tip</p>
        <p className="mt-1 text-sm text-white" data-testid="weakest-tip">
          {weakest.tip}
        </p>
      </div>
    </section>
  );
}

/** Child switcher — avatar pill per child. */
function ChildSwitcher({
  kids,
  selectedId,
  onSelect,
}: {
  kids: ChildMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (kids.length === 0) return null;
  return (
    <div
      data-testid="child-switcher"
      role="group"
      aria-label="Select a child to view their learning progress"
      className="flex flex-wrap gap-3"
    >
      {kids.map((child) => {
        const selected = child.id === selectedId;
        const color = childColor(child.id);
        const initial = child.displayName.charAt(0).toUpperCase();
        return (
          <button
            key={child.id}
            type="button"
            data-testid={`child-pill-${child.id}`}
            onClick={() => onSelect(child.id)}
            aria-pressed={selected}
            // Fix #2: plain apostrophe in JS template literal (not &apos;)
            aria-label={`View ${child.displayName}'s learning progress`}
            className={[
              'flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border-2 border-black px-4 py-2 font-heading text-sm shadow-neo-xs transition-transform',
              'motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
              selected
                ? 'bg-[#3d1065] text-white shadow-neo-sm'
                : `${color} text-black hover:shadow-neo-sm`,
            ].join(' ')}
          >
            <span aria-hidden="true">{initial}</span>
            {child.displayName}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────

type FetchStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: InsightsResponse }
  | { kind: 'error'; message: string };

type MembersStatus = 'loading' | 'ok' | 'error';

function isChild(role: string): boolean {
  return role === 'child' || role === 'teen';
}

export function LearningInsightsTabPanel() {
  const { session } = useAuth();
  const slug = useTenantSlug();

  // Fix #4: require BOTH token AND a non-empty slug so x-tenant-slug is never "null"
  const headers = useMemo(
    () =>
      session?.access_token && slug
        ? {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-slug': slug,
          }
        : null,
    [session, slug],
  );

  const [children, setChildren] = useState<ChildMember[]>([]);
  const [membersStatus, setMembersStatus] = useState<MembersStatus>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<FetchStatus>({ kind: 'idle' });

  // Fix #5: retry increments a counter that is listed as an effect dep,
  // re-triggering the insights fetch for the same selectedId.
  const [retryCount, setRetryCount] = useState(0);

  const retryInsights = useCallback(() => {
    setStatus({ kind: 'idle' });
    setRetryCount((n) => n + 1);
  }, []);

  // 1. Fetch member list and filter to children.
  // Fix #6: surface a distinct error state instead of silently swallowing failures.
  useEffect(() => {
    if (!headers) return;
    setMembersStatus('loading');
    const ac = new AbortController();
    fetch(`${API_BASE}/api/members`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`members ${r.status}`))))
      .then((b: { members?: ChildMember[] }) => {
        if (ac.signal.aborted) return;
        const kids = (b.members ?? []).filter((m) => isChild(m.role));
        setChildren(kids);
        setMembersStatus('ok');
        if (kids.length > 0) setSelectedId((prev) => prev ?? kids[0]!.id);
      })
      .catch((err: Error) => {
        if (ac.signal.aborted) return;
        // Only set error if it's a real failure, not an abort
        if (err.name !== 'AbortError') setMembersStatus('error');
      });
    return () => ac.abort();
  }, [headers]);

  // 2. Fetch insights whenever selectedId or retryCount changes.
  // Fix #1: URL-encode memberId via URLSearchParams.
  useEffect(() => {
    if (!headers || !selectedId) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    const qs = new URLSearchParams({ memberId: selectedId }).toString();
    fetch(`${API_BASE}/api/learn/insights?${qs}`, {
      headers,
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`insights ${r.status}`))))
      .then((data: InsightsResponse) => {
        if (ac.signal.aborted) return;
        setStatus({ kind: 'ready', data });
      })
      .catch((err: Error) => {
        if (ac.signal.aborted) return;
        setStatus({ kind: 'error', message: err.message ?? 'Could not load insights.' });
      });
    return () => ac.abort();
    // retryCount is intentionally included: incrementing it re-triggers
    // this effect for the same selectedId (user clicked "Try again").
  }, [headers, selectedId, retryCount]);

  return (
    <div className="space-y-6" data-testid="learning-insights-panel">
      {/* Section heading */}
      <div className="flex items-center gap-3">
        <BookOpen size={24} className="text-yellow-300" aria-hidden="true" />
        <h2 className="font-heading text-2xl tracking-wide text-white">Learning Insights</h2>
      </div>

      {/* Members fetch error — distinct from "no children" empty state */}
      {membersStatus === 'error' && (
        <p
          data-testid="learning-insights-members-error"
          role="alert"
          className="font-bold text-red-300"
        >
          Could not load family members. Please refresh the page.
        </p>
      )}

      {/* Child switcher (only when members loaded ok) */}
      {membersStatus === 'ok' &&
        (children.length === 0 ? (
          <p data-testid="learning-insights-no-children" className="font-bold text-purple-200">
            No children found in this family.
          </p>
        ) : (
          <ChildSwitcher kids={children} selectedId={selectedId} onSelect={setSelectedId} />
        ))}

      {/* Insights area */}
      {status.kind === 'loading' && (
        <p
          data-testid="learning-insights-loading"
          className="font-bold text-purple-200"
          aria-busy="true"
        >
          Loading learning data…
        </p>
      )}

      {/* Fix #5: error state with retry button */}
      {status.kind === 'error' && (
        <div
          data-testid="learning-insights-error"
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 p-5 shadow-neo-sm"
        >
          <p className="font-bold text-red-700">{status.message}</p>
          <button
            type="button"
            data-testid="learning-insights-retry"
            onClick={retryInsights}
            className="flex items-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-neo-xs motion-safe:hover:-translate-y-0.5"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {status.kind === 'ready' && (
        <>
          {/* Empty state */}
          {!status.data.hasActivity ? (
            <div
              data-testid="learning-insights-empty"
              className="flex flex-col items-center justify-center rounded-xl border-2 border-black bg-white p-12 text-center shadow-neo-sm"
            >
              <div
                className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-black bg-purple-100 text-4xl shadow-neo-xs"
                aria-hidden="true"
              >
                📚
              </div>
              <h3 className="mb-2 font-heading text-2xl text-gray-900">No learning activity yet</h3>
              <p className="font-bold text-gray-500">
                {status.data.displayName} hasn&apos;t started any lessons yet. Check back once
                they&apos;ve explored the Learn section.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Per-subject cards grid */}
              <section aria-labelledby="subjects-heading">
                <h3
                  id="subjects-heading"
                  className="mb-3 font-heading text-lg tracking-wide text-purple-200"
                >
                  Progress by subject
                </h3>
                <div
                  data-testid="subject-cards-grid"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {status.data.subjects.map((sub) => (
                    <SubjectCard key={sub.subject} sub={sub} />
                  ))}
                </div>
              </section>

              {/* Where they're stuck */}
              {status.data.weakest !== null && <WeakestAreaPanel weakest={status.data.weakest} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
