import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Edit2, Key, Mail, Plus, Settings2, Shield, Trash2, X } from 'lucide-react';
import { Button, Card, Input, Label } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';

// FHS-108 / FHS-252 / FHS-276 — /t/:slug/members, rebuilt to the Magic
// Patterns "Manage Members" design: header CTAs (Invite Parent / Add
// Child) with inline expanding forms, a card grid (one card per member
// with a coloured initial disc + role badge), a pending-invite box with
// Resend on unclaimed seats, and per-card actions — Edit name, the
// parents-only admin toggle (last admin protected), Set PIN on kids,
// and Remove. Mutations are admin-only; PIN management stays
// admin/adult (FHS-252).

interface MemberItem {
  id: string;
  displayName: string;
  role: 'admin' | 'adult' | 'teen' | 'child' | 'guest' | string;
  avatarEmoji: string | null;
  status: 'active' | 'unclaimed';
  createdAt: string;
  isChild: boolean;
  hasPin: boolean;
  age: number | null;
  inviteEmail: string | null;
  inviteId: string | null;
}

interface ListMembersResponse {
  members: MemberItem[];
  callerRole: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; members: MemberItem[]; callerRole: string }
  | { kind: 'error'; message: string };

const ROLE_STYLE: Record<string, { disc: string; badge: string; label: string }> = {
  admin: { disc: 'bg-pink-300', badge: 'bg-pink-200', label: 'Admin' },
  adult: { disc: 'bg-cyan-300', badge: 'bg-cyan-200', label: 'Parent' },
  teen: { disc: 'bg-yellow-300', badge: 'bg-yellow-200', label: 'Teen' },
  child: { disc: 'bg-purple-300', badge: 'bg-purple-200', label: 'Child' },
  guest: { disc: 'bg-gray-300', badge: 'bg-gray-200', label: 'Guest' },
};

function roleStyle(role: string) {
  return ROLE_STYLE[role] ?? ROLE_STYLE.guest!;
}

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

const ADMIN_OR_ADULT = new Set(['admin', 'adult']);
const PIN_ELIGIBLE_ROLES = new Set(['child', 'teen']);

export function MembersPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  // Which header form is open ('none' | 'parent' | 'child'). The
  // dashboard dropdown's Add Child deep-links here with ?add=child.
  const [activeForm, setActiveForm] = useState<'none' | 'parent' | 'child'>(
    params.get('add') === 'child' ? 'child' : 'none',
  );
  const [openPinFor, setOpenPinFor] = useState<string | null>(null);
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const authedHeaders = session
    ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug }
    : null;

  const fetchMembers = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/api/members`, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
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
    void fetchMembers();
  }, [fetchMembers]);

  // Shared mutation helper: fires, surfaces the server's `detail` on
  // failure, refreshes the list on success.
  const mutate = useCallback(
    async (path: string, init: RequestInit): Promise<boolean> => {
      if (!authedHeaders) return false;
      setActionError(null);
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          ...init,
          headers: { ...authedHeaders, 'Content-Type': 'application/json', ...init.headers },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
          setActionError(body.detail ?? body.error ?? `Server returned ${res.status}`);
          return false;
        }
        await fetchMembers();
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Network error — try again.');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedHeaders derives from session+slug
    [session, slug, fetchMembers],
  );

  const ready = status.kind === 'ready';
  const callerIsAdmin = ready && status.callerRole === 'admin';
  const adminCount = ready ? status.members.filter((m) => m.role === 'admin').length : 0;

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg p-6 font-body text-gray-900">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-2">
          <Link
            to={`/t/${slug}/dashboard`}
            className="text-sm font-bold text-purple-200 hover:text-yellow-300"
          >
            ← Dashboard
          </Link>
        </div>
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <h1 className="font-heading text-3xl text-white md:text-4xl">Manage Members</h1>
          {callerIsAdmin && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                testId="members-invite-parent"
                onClick={() => setActiveForm((f) => (f === 'parent' ? 'none' : 'parent'))}
              >
                <Mail size={16} aria-hidden="true" /> Invite Parent
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                testId="members-add-child"
                onClick={() => setActiveForm((f) => (f === 'child' ? 'none' : 'child'))}
              >
                <Plus size={16} aria-hidden="true" /> Add Child
              </Button>
            </div>
          )}
        </div>

        {activeForm === 'parent' && callerIsAdmin && (
          <InviteParentForm
            onClose={() => setActiveForm('none')}
            onSubmit={async (email, name) => {
              const ok = await mutate('/api/invitations', {
                method: 'POST',
                body: JSON.stringify({
                  email,
                  role: 'adult',
                  ...(name ? { displayName: name } : {}),
                }),
              });
              if (ok) setActiveForm('none');
            }}
            error={actionError}
          />
        )}
        {activeForm === 'child' && callerIsAdmin && (
          <AddChildForm
            onClose={() => setActiveForm('none')}
            onSubmit={async (displayName, age) => {
              const ok = await mutate('/api/members', {
                method: 'POST',
                body: JSON.stringify({
                  displayName,
                  role: 'child',
                  ...(age !== null ? { age } : {}),
                }),
              });
              if (ok) setActiveForm('none');
            }}
            error={actionError}
          />
        )}

        {status.kind === 'loading' && (
          <p data-testid="members-loading" className="text-sm font-bold text-purple-200">
            Loading members…
          </p>
        )}
        {status.kind === 'error' && (
          <p data-testid="members-error" role="alert" className="text-sm font-bold text-red-300">
            {status.message}
          </p>
        )}
        {ready && status.members.length === 0 && (
          <p data-testid="members-empty" className="text-sm font-bold text-purple-200">
            No members yet.
          </p>
        )}

        {actionError && activeForm === 'none' && (
          <p
            data-testid="members-action-error"
            role="alert"
            className="mb-4 text-sm font-bold text-red-300"
          >
            {actionError}
          </p>
        )}

        {ready && status.members.length > 0 && (
          <ul
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            data-testid="members-list"
          >
            {status.members.map((m, idx) => {
              const rs = roleStyle(m.role);
              const isParentRow = m.role === 'admin' || m.role === 'adult';
              const lastAdminLock = m.role === 'admin' && adminCount <= 1;
              // FHS-278 — admin only becomes available once the seat has a
              // real login. Button stays visible (founder's call), disabled.
              const adminToggleDisabled = lastAdminLock || m.status === 'unclaimed';
              const callerCanManagePin =
                ADMIN_OR_ADULT.has(status.callerRole) && PIN_ELIGIBLE_ROLES.has(m.role);
              return (
                <li key={m.id} className="list-none">
                  <Card
                    className="flex h-full flex-col bg-white p-5"
                    data-testid={`members-row-${idx}`}
                  >
                    <div className="mb-4 flex items-start gap-4">
                      <div
                        aria-hidden="true"
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-black font-heading text-2xl shadow-neo-sm ${rs.disc}`}
                      >
                        {m.avatarEmoji ?? initial(m.displayName)}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <h3
                          className="truncate font-heading text-xl text-black"
                          data-testid={`members-row-${idx}-name`}
                        >
                          {m.displayName}
                        </h3>
                        <span
                          data-testid={`members-row-${idx}-role`}
                          className={`mt-1 inline-block rounded-full border-2 border-black px-2 py-0.5 text-[11px] font-bold ${rs.badge}`}
                        >
                          {rs.label}
                          {PIN_ELIGIBLE_ROLES.has(m.role) && m.age !== null ? ` (${m.age})` : ''}
                        </span>
                      </div>
                    </div>

                    {m.status === 'unclaimed' && isParentRow && (
                      <div
                        className="mb-4 flex flex-col gap-2 rounded-md border-2 border-yellow-400 bg-yellow-50 p-3"
                        data-testid={`members-row-${idx}-pending`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-yellow-800">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 animate-pulse rounded-full bg-yellow-500"
                          />
                          Pending &mdash; hasn&rsquo;t signed up
                        </span>
                        {m.inviteEmail && (
                          <span className="truncate text-xs font-bold text-gray-500">
                            {m.inviteEmail}
                          </span>
                        )}
                        {m.inviteId && callerIsAdmin && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            testId={`members-row-${idx}-resend`}
                            onClick={() =>
                              void mutate(`/api/invitations/${m.inviteId}/resend`, {
                                method: 'POST',
                              })
                            }
                          >
                            Resend invite
                          </Button>
                        )}
                      </div>
                    )}

                    {editingFor === m.id && (
                      <EditNameForm
                        current={m.displayName}
                        rowIdx={idx}
                        onCancel={() => setEditingFor(null)}
                        onSave={async (name) => {
                          const ok = await mutate(`/api/members/${m.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ displayName: name }),
                          });
                          if (ok) setEditingFor(null);
                        }}
                      />
                    )}

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

                    <div className="flex-1" />
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-gray-100 pt-4">
                      {callerIsAdmin && (
                        <button
                          type="button"
                          data-testid={`members-row-${idx}-edit-name`}
                          onClick={() => setEditingFor((p) => (p === m.id ? null : m.id))}
                          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
                        >
                          <Edit2 size={14} aria-hidden="true" /> Edit name
                        </button>
                      )}
                      {callerIsAdmin && isParentRow && (
                        <button
                          type="button"
                          data-testid={`members-row-${idx}-admin-toggle`}
                          disabled={adminToggleDisabled}
                          title={
                            m.status === 'unclaimed'
                              ? 'Available once they finish signing up'
                              : undefined
                          }
                          onClick={() =>
                            void mutate(`/api/members/${m.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                role: m.role === 'admin' ? 'adult' : 'admin',
                              }),
                            })
                          }
                          className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm font-bold transition-colors ${
                            adminToggleDisabled
                              ? 'cursor-not-allowed text-gray-400'
                              : 'text-purple-600 hover:bg-purple-50 hover:text-purple-800'
                          }`}
                        >
                          <Shield size={14} aria-hidden="true" />
                          {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </button>
                      )}
                      {callerCanManagePin && (
                        <button
                          type="button"
                          data-testid={`members-row-${idx}-pin-toggle`}
                          onClick={() => setOpenPinFor((prev) => (prev === m.id ? null : m.id))}
                          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          <Key size={14} aria-hidden="true" />
                          {openPinFor === m.id ? 'Cancel' : m.hasPin ? 'Reset PIN' : 'Set PIN'}
                        </button>
                      )}
                      <div className="flex-1" />
                      {/* FHS-308 — Admin Panel button on the admin's own card */}
                      {callerIsAdmin && m.role === 'admin' && (
                        <button
                          type="button"
                          data-testid="members-admin-panel-btn"
                          onClick={() => navigate(`/t/${slug}/admin`)}
                          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-bold text-orange-600 transition-colors hover:bg-orange-50 hover:text-orange-800"
                        >
                          <Settings2 size={14} aria-hidden="true" /> Admin Panel
                        </button>
                      )}
                      {callerIsAdmin && (
                        <RemoveButton
                          rowIdx={idx}
                          disabled={lastAdminLock}
                          name={m.displayName}
                          onConfirm={() =>
                            void mutate(`/api/members/${m.id}`, { method: 'DELETE' })
                          }
                        />
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function InviteParentForm({
  onClose,
  onSubmit,
  error,
}: {
  onClose: () => void;
  onSubmit: (email: string, name: string | null) => Promise<void>;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <Card className="relative mb-8 bg-white p-6" data-testid="members-invite-form">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close invite form"
        className="absolute right-4 top-4 text-gray-500 transition-colors hover:text-black"
      >
        <X size={20} />
      </button>
      <h2 className="mb-2 font-heading text-2xl text-black">Invite a Parent or Partner</h2>
      <p className="mb-6 text-sm font-bold text-gray-600">
        They&rsquo;ll receive an email with a sign-in link to join the family. No password needed.
      </p>
      <form
        className="flex flex-col gap-4 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          setSubmitting(true);
          void onSubmit(email.trim(), name.trim() || null).finally(() => setSubmitting(false));
        }}
      >
        <div className="flex-1">
          <Label htmlFor="invite-parent-name">Name</Label>
          <Input
            id="invite-parent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Yusuf"
            testId="members-invite-name"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="invite-parent-email" required>
            Email
          </Label>
          <Input
            id="invite-parent-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="yusuf@example.com"
            testId="members-invite-email"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting}
            testId="members-invite-send"
          >
            {submitting ? 'Sending…' : 'Send Invite'}
          </Button>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          data-testid="members-invite-error"
          className="mt-3 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}
    </Card>
  );
}

function AddChildForm({
  onClose,
  onSubmit,
  error,
}: {
  onClose: () => void;
  onSubmit: (displayName: string, age: number | null) => Promise<void>;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <Card className="relative mb-8 bg-white p-6" data-testid="members-add-child-form">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close add-child form"
        className="absolute right-4 top-4 text-gray-500 transition-colors hover:text-black"
      >
        <X size={20} />
      </button>
      <h2 className="mb-2 font-heading text-2xl text-black">Add a Child</h2>
      <p className="mb-6 text-sm font-bold text-gray-600">
        Kids don&rsquo;t need an email. They log in by tapping their avatar and entering a 4-digit
        PIN (set one from their card below).
      </p>
      <form
        className="flex flex-col gap-4 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const parsedAge = age.trim() === '' ? null : Number.parseInt(age, 10);
          setSubmitting(true);
          void onSubmit(name.trim(), Number.isNaN(parsedAge as number) ? null : parsedAge).finally(
            () => setSubmitting(false),
          );
        }}
      >
        <div className="flex-1">
          <Label htmlFor="add-child-name" required>
            Name
          </Label>
          <Input
            id="add-child-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amina"
            testId="members-add-child-name"
          />
        </div>
        <div className="w-full sm:w-32">
          <Label htmlFor="add-child-age">Age</Label>
          <Input
            id="add-child-age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 10"
            testId="members-add-child-age"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting}
            testId="members-add-child-save"
          >
            {submitting ? 'Adding…' : 'Add Child'}
          </Button>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          data-testid="members-add-child-error"
          className="mt-3 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}
    </Card>
  );
}

function EditNameForm({
  current,
  rowIdx,
  onCancel,
  onSave,
}: {
  current: string;
  rowIdx: number;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(current);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="mb-4 flex items-end gap-2"
      data-testid={`members-row-${rowIdx}-edit-form`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        void onSave(name.trim()).finally(() => setSubmitting(false));
      }}
    >
      <div className="flex-1">
        <Label htmlFor={`edit-name-${rowIdx}`}>New name</Label>
        <Input
          id={`edit-name-${rowIdx}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          testId={`members-row-${rowIdx}-edit-input`}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={submitting}
        testId={`members-row-${rowIdx}-edit-save`}
      >
        Save
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

// Two-tap remove: first tap arms ("Really remove?"), second confirms.
// Avoids a window.confirm (untestable + jarring) without a full dialog.
function RemoveButton({
  rowIdx,
  disabled,
  name,
  onConfirm,
}: {
  rowIdx: number;
  disabled: boolean;
  name: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          data-testid={`members-row-${rowIdx}-remove-confirm`}
          onClick={onConfirm}
          title="Their personal tasks and meals are removed too"
          className="rounded border-2 border-black bg-red-100 px-2 py-1 text-xs font-bold text-red-700"
        >
          Remove {name}? (their tasks &amp; meals go too)
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-xs font-bold text-gray-500 hover:text-black"
        >
          Keep
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid={`members-row-${rowIdx}-remove`}
      disabled={disabled}
      onClick={() => setArmed(true)}
      title={`Remove ${name}`}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm font-bold transition-colors ${
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : 'text-red-500 hover:bg-red-50 hover:text-red-700'
      }`}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}

// FHS-252 — inline form for setting / resetting / clearing a kid PIN.
// Unchanged behaviour from the pre-FHS-276 page.

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
        const res = await fetch(`${API_BASE}/api/members/${member.id}/pin`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-tenant-slug': slug,
          },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
          };
          setError(body.detail ?? body.error ?? `Server returned ${res.status}.`);
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
      const res = await fetch(`${API_BASE}/api/members/${member.id}/pin`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-slug': slug },
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
      className="mb-4 space-y-3 rounded-md border-2 border-dashed border-black bg-white p-3"
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
