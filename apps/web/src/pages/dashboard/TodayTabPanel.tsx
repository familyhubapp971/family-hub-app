import { useEffect, useState } from 'react';
import { Badge, Card } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';

// FHS-228 — TodayTabPanel.
//
// First view a parent sees on /t/:slug/dashboard. One round-trip to
// GET /api/dashboard/today fetches the greeting name, today's date,
// the family roster, and a counts strip (members / habits / rewards).
// The remaining counts (events, meals, tasks) light up as their
// sibling tabs ship.

interface DashboardMember {
  id: string;
  displayName: string;
  role: string;
  avatarEmoji: string | null;
}

interface DashboardCounts {
  members: number;
  habits: number;
  rewards: number;
}

interface DashboardTodayResponse {
  date: string;
  greetingName: string;
  members: DashboardMember[];
  counts: DashboardCounts;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; data: DashboardTodayResponse }
  | { kind: 'error'; message: string };

function roleBadgeVariant(role: string): 'success' | 'default' | 'info' | 'warning' | 'danger' {
  switch (role) {
    case 'admin':
      return 'success';
    case 'adult':
      return 'default';
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

export function TodayTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    if (!session) return;
    // Reset to loading on slug change so the previous tenant's data
    // doesn't linger on screen while the new fetch is in flight.
    setStatus({ kind: 'loading' });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/today', {
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

      <section aria-labelledby="today-counts-heading">
        <h3 id="today-counts-heading" className="sr-only">
          Family snapshot
        </h3>
        <ul className="grid grid-cols-3 gap-3 text-center" data-testid="today-counts">
          {(
            [
              ['members', counts.members, 'Members'],
              ['habits', counts.habits, 'Habits'],
              ['rewards', counts.rewards, 'Rewards'],
            ] as const
          ).map(([key, value, label]) => (
            <li
              key={key}
              className="rounded-md border-2 border-black bg-yellow-50 p-3 shadow-neo-sm"
              aria-label={`${value} ${label.toLowerCase()}`}
            >
              <p className="font-heading text-2xl text-black" data-testid={`today-count-${key}`}>
                {value}
              </p>
              <p
                aria-hidden="true"
                className="text-xs font-bold uppercase tracking-wide text-gray-600"
              >
                {label}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="today-members-heading">
        <h3 id="today-members-heading" className="mb-2 font-heading text-lg text-black">
          Family
        </h3>
        {members.length === 0 ? (
          <p data-testid="today-members-empty" className="text-sm text-gray-600">
            No members yet.
          </p>
        ) : (
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="today-members"
          >
            {members.map((m, idx) => (
              <li key={m.id} data-testid={`today-member-${idx}`}>
                <Card className="flex items-center gap-3 border-2 border-black bg-white p-3 shadow-neo-sm">
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-50 text-xl shadow-neo-xs"
                  >
                    {m.avatarEmoji && m.avatarEmoji.length > 0 ? (
                      m.avatarEmoji
                    ) : (
                      <span className="font-heading text-sm text-black">
                        {avatarInitials(m.displayName)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-heading text-base text-black"
                      data-testid={`today-member-${idx}-name`}
                    >
                      {m.displayName}
                    </p>
                  </div>
                  <Badge variant={roleBadgeVariant(m.role)} testId={`today-member-${idx}-role`}>
                    {m.role}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
