import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ChevronRight, Flame, Sparkles, Target, UtensilsCrossed } from 'lucide-react';
import { Badge, Card } from '@familyhub/ui';
import type {
  DashboardActivity,
  DashboardGoal,
  DashboardMember,
  DashboardTodayResponse,
} from '@familyhub/shared';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-263 — TodayTabPanel redesign.
//
// One round-trip to GET /api/dashboard/today (expanded in FHS-262) feeds
// the whole screen: a Today's Snapshot stat row, stat-rich member cards
// (habit ring, streak, status; children link to their own world), and a
// Family Goals + Recent Activity sidebar. No new API call.

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; data: DashboardTodayResponse }
  | { kind: 'error'; message: string };

// Children + teens get the playful, clickable "world" card; adults/admins
// get the task-focused card.
function isYoungMember(role: string): boolean {
  return role === 'child' || role === 'teen';
}

function roleBadgeVariant(role: string): 'success' | 'default' | 'info' | 'warning' | 'danger' {
  switch (role) {
    case 'admin':
      return 'success';
    case 'teen':
    case 'child':
      return 'info';
    case 'guest':
      return 'warning';
    default:
      return 'default';
  }
}

function avatarInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function timeOfDayGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Format `YYYY-MM-DD` anchored in UTC so the server-provided date
// doesn't shift in the user's local timezone.
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Coarse "x ago" for the activity feed. Good enough for a last-3 list;
// avoids pulling a date library.
function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days <= 1 ? 'yesterday' : `${days}d ago`;
}

// Small SVG progress ring for a member's habit completion.
function HabitRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const r = 18;
  const circ = 2 * Math.PI * r;
  return (
    <div
      className="relative h-12 w-12 shrink-0"
      role="img"
      aria-label={total > 0 ? `${done} of ${total} habits done` : 'No habits assigned'}
    >
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#000" strokeWidth="4" opacity="0.12" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center font-heading text-xs text-black"
      >
        {done}/{total}
      </span>
    </div>
  );
}

function SnapshotStat({
  testId,
  icon,
  value,
  label,
}: {
  testId: string;
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-md border-2 border-black bg-yellow-50 p-3 shadow-neo-sm"
      data-testid={testId}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-black bg-white"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-xl leading-tight text-black">{value}</span>
        <span className="block text-xs font-bold uppercase tracking-wide text-gray-600">
          {label}
        </span>
      </span>
    </li>
  );
}

function MemberCard({
  slug,
  member,
  index,
}: {
  slug: string;
  member: DashboardMember;
  index: number;
}) {
  const avatar = (
    <div
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-50 text-xl shadow-neo-xs"
    >
      {member.avatarEmoji && member.avatarEmoji.length > 0 ? (
        member.avatarEmoji
      ) : (
        <span className="font-heading text-sm text-black">
          {avatarInitials(member.displayName)}
        </span>
      )}
    </div>
  );

  const streak =
    member.streak > 0 ? (
      <span
        className="inline-flex items-center gap-1 font-heading text-sm text-orange-600"
        data-testid={`today-member-${index}-streak`}
      >
        <Flame size={14} aria-hidden="true" />
        {member.streak}
        <span className="sr-only">week streak</span>
      </span>
    ) : null;

  const name = (
    <p
      className="truncate font-heading text-base text-black"
      data-testid={`today-member-${index}-name`}
    >
      {member.displayName}
    </p>
  );

  const status = (
    <p
      className="truncate text-xs font-bold text-gray-600"
      data-testid={`today-member-${index}-status`}
    >
      {member.statusText}
    </p>
  );

  // Children/teens: a clickable card into their own world (FHS-269/270
  // builds the destination route; the link ships now per AC).
  if (isYoungMember(member.role)) {
    return (
      <li data-testid={`today-member-${index}`}>
        <Link
          to={`/t/${slug}/child/${member.id}`}
          data-testid={`today-member-${index}-link`}
          className="group block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <Card className="flex items-center gap-3 border-2 border-black bg-white p-3 shadow-neo-sm transition-transform motion-safe:group-hover:-translate-y-0.5">
            {avatar}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                {name}
                {streak}
              </div>
              {status}
            </div>
            <HabitRing done={member.habitsDone} total={member.habitsTotal} />
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="shrink-0 text-gray-400 transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </Card>
        </Link>
      </li>
    );
  }

  // Adults/admins: task-focused card, not clickable.
  return (
    <li data-testid={`today-member-${index}`}>
      <Card className="flex items-center gap-3 border-2 border-black bg-white p-3 shadow-neo-sm">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            {name}
            <Badge variant={roleBadgeVariant(member.role)} testId={`today-member-${index}-role`}>
              {member.role}
            </Badge>
          </div>
          <p className="text-xs font-bold text-gray-600">
            <span data-testid={`today-member-${index}-tasks`}>{member.tasksPending}</span>{' '}
            {member.tasksPending === 1 ? 'task' : 'tasks'} pending
          </p>
        </div>
      </Card>
    </li>
  );
}

function GoalBar({ goal, index }: { goal: DashboardGoal; index: number }) {
  const pct =
    goal.target && goal.target > 0
      ? Math.min(100, Math.max(0, Math.round((goal.progress / goal.target) * 100)))
      : null;
  return (
    <li data-testid={`today-goal-${index}`} className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-heading text-sm text-black">{goal.label}</span>
        <span className="shrink-0 text-xs font-bold text-gray-600">
          {pct === null ? goal.progress.toLocaleString() : `${pct}%`}
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full border-2 border-black bg-white"
        role="progressbar"
        aria-label={pct === null ? `${goal.label} progress (open-ended)` : `${goal.label} progress`}
        {...(pct !== null
          ? { 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }
          : {})}
      >
        <div className="h-full bg-green-500" style={{ width: `${pct ?? 0}%` }} />
      </div>
    </li>
  );
}

function ActivityRow({ entry, index }: { entry: DashboardActivity; index: number }) {
  const ago = timeAgo(entry.timestamp);
  return (
    <li className="flex items-start gap-2" data-testid={`today-activity-${index}`}>
      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-black" />
      <p className="text-sm text-black">
        {entry.actor ? <span className="font-bold">{entry.actor} </span> : null}
        <span>{entry.action}</span>
        {ago ? <span className="text-gray-500"> · {ago}</span> : null}
      </p>
    </li>
  );
}

export function TodayTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    if (!session) return;
    setStatus({ kind: 'loading' });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/today`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-slug': slug,
          },
        });
        if (!res.ok) {
          if (!cancelled) {
            setStatus({
              kind: 'error',
              message: `Couldn't load today (server returned ${res.status})`,
            });
          }
          return;
        }
        const body = (await res.json()) as DashboardTodayResponse;
        if (!cancelled) setStatus({ kind: 'ready', data: body });
      } catch (err) {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Network error — try again.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="today-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading today…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="today-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const { greetingName, date, members, counts } = status.data;
  // Defensive defaults: the API contract (FHS-262) always sends these, but
  // guard against a partial/transitional payload rather than white-screen.
  const goals = status.data.goals ?? [];
  const recentActivity = status.data.recentActivity ?? [];
  const tasksDoneToday = counts.tasksDoneToday ?? 0;
  const mealsPlanned = counts.mealsPlanned ?? 0;

  // Today's Snapshot — kids' combined habit progress, tasks done today,
  // meals planned for today.
  const kids = members.filter((m) => isYoungMember(m.role));
  const kidsHabitsDone = kids.reduce((sum, m) => sum + m.habitsDone, 0);
  const kidsHabitsTotal = kids.reduce((sum, m) => sum + m.habitsTotal, 0);

  return (
    <div className="space-y-6" data-testid="today-ready">
      <header>
        <p
          className="text-xs font-bold uppercase tracking-wide text-gray-500"
          data-testid="today-date"
        >
          {formatDate(date)}
        </p>
        <h2 className="font-heading text-2xl text-black md:text-3xl" data-testid="today-greeting">
          {timeOfDayGreeting()}, {greetingName}
        </h2>
      </header>

      <section aria-labelledby="today-snapshot-heading">
        <h3 id="today-snapshot-heading" className="sr-only">
          Today&rsquo;s snapshot
        </h3>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="today-snapshot">
          <SnapshotStat
            testId="today-snapshot-habits"
            icon={<Sparkles size={18} aria-hidden="true" className="text-green-600" />}
            value={kids.length === 0 ? '—' : `${kidsHabitsDone}/${kidsHabitsTotal}`}
            label="Kids' habits"
          />
          <SnapshotStat
            testId="today-snapshot-tasks"
            icon={<Target size={18} aria-hidden="true" className="text-blue-600" />}
            value={String(tasksDoneToday)}
            label="Tasks done"
          />
          <SnapshotStat
            testId="today-snapshot-meals"
            icon={<UtensilsCrossed size={18} aria-hidden="true" className="text-orange-600" />}
            value={String(mealsPlanned)}
            label="Meals planned"
          />
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="today-members-heading">
          <h3 id="today-members-heading" className="mb-2 font-heading text-lg text-black">
            Family
          </h3>
          {members.length === 0 ? (
            <p data-testid="today-members-empty" className="text-sm text-gray-600">
              No members yet.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="today-members">
              {members.map((m, idx) => (
                <MemberCard key={m.id} slug={slug} member={m} index={idx} />
              ))}
            </ul>
          )}
        </section>

        <aside
          className="space-y-6"
          data-testid="today-sidebar"
          aria-label="Family goals and recent activity"
        >
          <section aria-labelledby="today-goals-heading">
            <h3
              id="today-goals-heading"
              className="mb-2 flex items-center gap-2 font-heading text-lg text-black"
            >
              <Target size={18} aria-hidden="true" /> Family goals
            </h3>
            {goals.length === 0 ? (
              <p data-testid="today-goals-empty" className="text-sm text-gray-600">
                No goals yet.
              </p>
            ) : (
              <ul className="space-y-3" data-testid="today-goals">
                {goals.slice(0, 3).map((g, idx) => (
                  <GoalBar key={g.id} goal={g} index={idx} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="today-activity-heading">
            <h3
              id="today-activity-heading"
              className="mb-2 flex items-center gap-2 font-heading text-lg text-black"
            >
              <Activity size={18} aria-hidden="true" /> Recent activity
            </h3>
            {recentActivity.length === 0 ? (
              <p data-testid="today-activity-empty" className="text-sm text-gray-600">
                Nothing yet.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="today-activity">
                {recentActivity.slice(0, 3).map((a, idx) => (
                  <ActivityRow key={a.id} entry={a} index={idx} />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
