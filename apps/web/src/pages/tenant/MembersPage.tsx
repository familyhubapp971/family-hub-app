import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Input, Label } from '@familyhub/ui';
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
  // FHS-252 — `isChild + hasPin` gate the inline PIN form below.
  isChild: boolean;
  hasPin: boolean;
}

interface ListMembersResponse {
  members: MemberItem[];
  callerRole: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; members: MemberItem[]; callerRole: string }
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

// FHS-252 — admin/adult-only roles can manage kid PINs. Other roles
// (teen, child, guest) get the same read-only members list as
// before.
const ADMIN_OR_ADULT = new Set(['admin', 'adult']);

// Roles that may potentially become a kid login: child + teen.
// Admins / adults / guests don't get the PIN affordance.
const PIN_ELIGIBLE_ROLES = new Set(['child', 'teen']);

export function MembersPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  // FHS-252 — id of the row whose PIN form is currently open. Closed
  // by default; only one row is editable at a time.
  const [openPinFor, setOpenPinFor] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/members', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-tenant-slug': slug,
        },
      });
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `Couldn't load members (server returned ${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as ListMembersResponse;
      setStatus({ kind: 'ready', members: body.members, callerRole: body.callerRole });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error — try again.',
      });
    }
  }, [session, slug]);

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
        if (!cancelled)
          setStatus({ kind: 'ready', members: body.members, callerRole: body.callerRole });
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
              {status.members.map((m, idx) => {
                const callerCanManagePin =
                  ADMIN_OR_ADULT.has(status.callerRole) && PIN_ELIGIBLE_ROLES.has(m.role);
                return (
                  <li
                    key={m.id}
                    className="rounded-md border-2 border-black bg-yellow-50 p-3 shadow-neo-sm"
                    data-testid={`members-row-${idx}`}
                  >
                    <div className="flex items-center gap-3">
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
                      {m.hasPin && (
                        <Badge variant="info" testId={`members-row-${idx}-pin-badge`}>
                          PIN set
                        </Badge>
                      )}
                      {callerCanManagePin && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          testId={`members-row-${idx}-pin-toggle`}
                          onClick={() => setOpenPinFor((prev) => (prev === m.id ? null : m.id))}
                        >
                          {openPinFor === m.id ? 'Cancel' : m.hasPin ? 'Reset PIN' : 'Set PIN'}
                        </Button>
                      )}
                    </div>

                    {callerCanManagePin && openPinFor === m.id && (
                      <KidPinForm
                        member={m}
                        slug={slug}
                        accessToken={session?.access_token}
                        rowIdx={idx}
                        onDone={() => {
                          setOpenPinFor(null);
                          void fetchMembers();
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// FHS-252 — inline form for setting / resetting / clearing a kid PIN.
// Two 4-digit fields (type + confirm) so a tap-typo doesn't lock the
// kid out of their own login. Submits PUT /api/members/:id/pin;
// "Remove PIN" button DELETEs and turns the kid back into a regular
// non-kid-login member.
//
// Renders inline below the row when the row's "Set/Reset PIN" toggle
// is open. Closes itself + refreshes the parent list on success.

interface KidPinFormProps {
  member: { id: string; displayName: string; hasPin: boolean };
  slug: string;
  accessToken: string | undefined;
  rowIdx: number;
  onDone: () => void;
}

function KidPinForm({ member, slug, accessToken, rowIdx, onDone }: KidPinFormProps) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSet = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly 4 digits.');
        return;
      }
      if (pin !== confirm) {
        setError("PINs don't match — type the same digits twice.");
        return;
      }
      if (!accessToken) {
        setError('Not signed in — refresh and try again.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(`/api/members/${member.id}/pin`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-tenant-slug': slug,
          },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `Server returned ${res.status}.`);
          setSubmitting(false);
          return;
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error — try again.');
        setSubmitting(false);
      }
    },
    [pin, confirm, member.id, slug, accessToken, onDone],
  );

  const onRemove = useCallback(async () => {
    setError(null);
    if (!accessToken) {
      setError('Not signed in — refresh and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/members/${member.id}/pin`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-tenant-slug': slug,
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Server returned ${res.status}.`);
        setSubmitting(false);
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — try again.');
      setSubmitting(false);
    }
  }, [member.id, slug, accessToken, onDone]);

  return (
    <form
      onSubmit={onSet}
      className="mt-3 space-y-3 rounded-md border-2 border-dashed border-black bg-white p-3"
      data-testid={`members-row-${rowIdx}-pin-form`}
    >
      <p className="font-body text-sm text-gray-700">
        Set a 4-digit PIN for <span className="font-bold text-black">{member.displayName}</span>.
        They&rsquo;ll type this on the family iPad to log in.
      </p>
      <div>
        <Label htmlFor={`pin-${member.id}`} required>
          PIN
        </Label>
        <Input
          id={`pin-${member.id}`}
          name="pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
          testId={`members-row-${rowIdx}-pin-input`}
        />
      </div>
      <div>
        <Label htmlFor={`pin-confirm-${member.id}`} required>
          Confirm PIN
        </Label>
        <Input
          id={`pin-confirm-${member.id}`}
          name="pin-confirm"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
          testId={`members-row-${rowIdx}-pin-confirm`}
        />
      </div>
      {error && (
        <p
          className="text-sm font-bold text-red-600"
          role="alert"
          data-testid={`members-row-${rowIdx}-pin-error`}
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
          testId={`members-row-${rowIdx}-pin-save`}
        >
          {submitting ? 'Saving…' : 'Save PIN'}
        </Button>
        {member.hasPin && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={submitting}
            onClick={() => void onRemove()}
            testId={`members-row-${rowIdx}-pin-remove`}
          >
            Remove kid login
          </Button>
        )}
      </div>
    </form>
  );
}
