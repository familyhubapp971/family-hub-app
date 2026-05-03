import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';

// FHS-108 — /t/:slug/members. Lists every member of the family with a
// role badge and a status badge (active vs unclaimed). Read-only.
// Mutating actions (revoke / suspend / transfer admin / photo upload)
// are sibling tickets in the FHS-104 epic.

interface MemberItem {
  id: string;
  displayName: string;
  role: 'admin' | 'adult' | 'teen' | 'child' | 'guest' | string;
  avatarEmoji: string | null;
  status: 'active' | 'unclaimed';
  createdAt: string;
}

interface ListMembersResponse {
  members: MemberItem[];
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; members: MemberItem[] }
  | { kind: 'error'; message: string };

// Role → badge variant + label. Admin is success-green so it's
// scannable at a glance; child/teen lean info-blue; guest danger-red.
function roleBadgeVariant(role: string): 'success' | 'default' | 'info' | 'warning' | 'danger' {
  switch (role) {
    case 'admin':
      return 'success';
    case 'adult':
      return 'default';
    case 'teen':
      return 'info';
    case 'child':
      return 'info';
    case 'guest':
      return 'warning';
    default:
      return 'default';
  }
}

function statusBadgeVariant(status: 'active' | 'unclaimed'): 'success' | 'warning' {
  return status === 'active' ? 'success' : 'warning';
}

function statusLabel(status: 'active' | 'unclaimed'): string {
  return status === 'active' ? 'Active' : 'Unclaimed';
}

// Small initial-bubble fallback when a member doesn't have an emoji.
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

export function MembersPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/members', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-slug': slug,
          },
        });
        if (!res.ok) {
          if (!cancelled) {
            setStatus({
              kind: 'error',
              message: `Couldn't load members (server returned ${res.status})`,
            });
          }
          return;
        }
        const body = (await res.json()) as ListMembersResponse;
        if (!cancelled) setStatus({ kind: 'ready', members: body.members });
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

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg p-6 font-body text-white">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-3xl text-yellow-300">Family members</h1>
          <Link
            to={`/t/${slug}/dashboard`}
            className="text-sm font-bold text-purple-200 hover:text-yellow-300"
          >
            ← Dashboard
          </Link>
        </div>

        <Card className="bg-white p-4 text-gray-900 md:p-6" data-testid="members-card">
          {status.kind === 'loading' && (
            <p data-testid="members-loading" className="text-sm font-bold text-gray-600">
              Loading members…
            </p>
          )}

          {status.kind === 'error' && (
            <p data-testid="members-error" role="alert" className="text-sm font-bold text-red-600">
              {status.message}
            </p>
          )}

          {status.kind === 'ready' && status.members.length === 0 && (
            <p data-testid="members-empty" className="text-sm font-bold text-gray-600">
              No members yet.
            </p>
          )}

          {status.kind === 'ready' && status.members.length > 0 && (
            <ul className="space-y-3" data-testid="members-list">
              {status.members.map((m, idx) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border-2 border-black bg-yellow-50 p-3 shadow-neo-sm"
                  data-testid={`members-row-${idx}`}
                >
                  <div
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-lg shadow-neo-xs"
                  >
                    {m.avatarEmoji ?? (
                      <span className="font-heading text-sm text-black">
                        {avatarInitials(m.displayName)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className="font-heading text-base text-black"
                      data-testid={`members-row-${idx}-name`}
                    >
                      {m.displayName}
                    </p>
                  </div>
                  <Badge variant={roleBadgeVariant(m.role)} testId={`members-row-${idx}-role`}>
                    {m.role}
                  </Badge>
                  <Badge
                    variant={statusBadgeVariant(m.status)}
                    testId={`members-row-${idx}-status`}
                  >
                    {statusLabel(m.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
