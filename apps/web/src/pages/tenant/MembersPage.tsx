import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Edit2,
  Key,
  Mail,
  Plus,
  Send,
  Settings2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  AvatarDisc,
  AvatarEmojiPicker,
  Button,
  Card,
  CollapsibleSection,
  FormCard,
  Input,
  Label,
  MemberCard,
  RoleBadge,
  Select,
} from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';
import { AppHeader } from './AppHeader';
import { DEFAULT_TAB } from './dashboard-tabs';

// FHS-513 — Manage Family rebuild to the finalised Magic Patterns
// design: a family-name header with a "{N} members · {M} waiting to
// join" summary and two CTAs ("Invite an adult" / "Add a child"),
// members split into two collapsible groups ("Grown-ups" — sign in
// with email; "Kids" — sign in with a PIN), a collapsible "How your
// kids sign in" helper card, and a separate "Waiting to join" section
// for unclaimed grown-up seats.
//
// This is a VISUAL/STRUCTURAL rebuild only — every existing API call,
// admin-only mutation gate, and last-admin protection carries over
// unchanged from the pre-FHS-513 page (FHS-108 / FHS-252 / FHS-276 /
// FHS-471/472/473 / FHS-486). See each handler below for its history.
//
// "Change email" (FHS-510) has no backend yet — its button renders
// disabled with a "Coming soon" note rather than being wired to a
// non-existent endpoint.

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

interface MeResponseTenant {
  slug: string;
  name: string;
  role: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; members: MemberItem[]; callerRole: string }
  | { kind: 'error'; message: string };

const GROWN_UP_ROLES = new Set(['admin', 'adult', 'guest']);
const KID_ROLES = new Set(['child', 'teen']);
const ADMIN_OR_ADULT = new Set(['admin', 'adult']);
const PIN_ELIGIBLE_ROLES = new Set(['child', 'teen']);

export function MembersPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [familyName, setFamilyName] = useState<string | null>(null);

  // FHS-322 — render the shared app header; nav tabs route to the dashboard.
  const onHeaderTabChange = useCallback(
    (tabId: string) => {
      navigate(`/t/${slug}/dashboard${tabId === DEFAULT_TAB ? '' : `?tab=${tabId}`}`);
    },
    [navigate, slug],
  );

  // Which header form is open. ?add=member still opens the "Add a child"
  // form for any entry point that deep-links here with it (FHS-471/501) —
  // the Family Overview button (FHS-520) now just links to this page plain.
  const [activeForm, setActiveForm] = useState<'none' | 'invite' | 'child'>(
    params.get('add') === 'member' ? 'child' : 'none',
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
        message: err instanceof Error ? err.message : 'Network error. Try again.',
      });
    }
  }, [session, slug]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  // Family name for the header — same /api/me lookup AppHeader already
  // does. Best-effort: on failure the heading falls back to "Your family".
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { tenants?: MeResponseTenant[] } | null) => {
        if (cancelled || !me?.tenants) return;
        const tenant = me.tenants.find((t) => t.slug === slug);
        if (tenant) setFamilyName(tenant.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

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
        setActionError(err instanceof Error ? err.message : 'Network error. Try again.');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedHeaders derives from session+slug
    [session, slug, fetchMembers],
  );

  const ready = status.kind === 'ready';
  const callerIsAdmin = ready && status.callerRole === 'admin';
  const allMembers = ready ? status.members : [];
  const adminCount = allMembers.filter((m) => m.role === 'admin').length;

  // Grown-ups actually signed in vs still waiting on their invite; kids
  // are never "waiting" (PIN login, no signup step) — see FHS-276.
  const grownUps = allMembers.filter((m) => GROWN_UP_ROLES.has(m.role) && m.status === 'active');
  const waiting = allMembers.filter((m) => GROWN_UP_ROLES.has(m.role) && m.status !== 'active');
  const kids = allMembers.filter((m) => KID_ROLES.has(m.role));
  const memberCount = grownUps.length + kids.length;

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900">
      <AppHeader activeTab={null} onTabChange={onHeaderTabChange} />
      <div className="mx-auto w-full max-w-7xl p-6">
        <div className="mb-2">
          <Link
            to={`/t/${slug}/dashboard`}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-purple-200 hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </Link>
        </div>
        <div className="mb-6 mt-1 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1
              className="font-heading text-3xl text-white sm:text-4xl"
              data-testid="members-family-name"
            >
              {familyName ?? 'Your family'}
            </h1>
            <p className="mt-1 text-sm font-bold text-purple-200" data-testid="members-summary">
              {memberCount} member{memberCount === 1 ? '' : 's'} · {waiting.length} waiting to join
            </p>
          </div>
          {callerIsAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                testId="members-invite-adult"
                onClick={() => setActiveForm((f) => (f === 'invite' ? 'none' : 'invite'))}
              >
                <Mail size={16} aria-hidden="true" /> Invite an adult
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                testId="members-add-child"
                onClick={() => setActiveForm((f) => (f === 'child' ? 'none' : 'child'))}
              >
                <Plus size={16} aria-hidden="true" /> Add a child
              </Button>
            </div>
          )}
        </div>

        {activeForm === 'invite' && callerIsAdmin && (
          <InviteAdultForm
            callerIsAdmin={callerIsAdmin}
            onClose={() => setActiveForm('none')}
            onSubmit={async (email, name, role) => {
              const ok = await mutate('/api/invitations', {
                method: 'POST',
                body: JSON.stringify({
                  email,
                  role,
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
            onSubmit={async (displayName, role, age, avatarEmoji) => {
              const ok = await mutate('/api/members', {
                method: 'POST',
                body: JSON.stringify({
                  displayName,
                  role,
                  ...(age !== null ? { age } : {}),
                  ...(avatarEmoji ? { avatarEmoji } : {}),
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
        {ready && allMembers.length === 0 && (
          <p data-testid="members-empty" className="text-sm font-bold text-purple-200">
            Nobody here yet
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

        {ready && allMembers.length > 0 && (
          <div className="space-y-6">
            {grownUps.length > 0 && (
              <CollapsibleSection
                variant="group"
                emoji="🧑🏽"
                title="Grown-ups"
                subtitle="Sign in with email"
                count={grownUps.length}
                headerClassName="bg-cyan-300 text-black"
                testId="members-group-grownups"
              >
                <ul
                  className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                  data-testid="members-grownups-list"
                >
                  {grownUps.map((m, idx) => (
                    <li key={m.id} className="list-none">
                      <GrownUpCard
                        member={m}
                        idx={idx}
                        callerIsAdmin={callerIsAdmin}
                        adminCount={adminCount}
                        editingFor={editingFor}
                        setEditingFor={setEditingFor}
                        navigate={navigate}
                        slug={slug}
                        mutate={mutate}
                      />
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {kids.length > 0 && (
              <CollapsibleSection
                variant="group"
                emoji="🧒🏽"
                title="Kids"
                subtitle="Sign in with a PIN"
                count={kids.length}
                headerClassName="bg-yellow-300 text-black"
                testId="members-group-kids"
              >
                <ul
                  className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                  data-testid="members-kids-list"
                >
                  {kids.map((m, idx) => (
                    <li key={m.id} className="list-none">
                      <KidCard
                        member={m}
                        idx={idx}
                        callerRole={status.callerRole}
                        callerIsAdmin={callerIsAdmin}
                        editingFor={editingFor}
                        setEditingFor={setEditingFor}
                        openPinFor={openPinFor}
                        setOpenPinFor={setOpenPinFor}
                        slug={slug}
                        session={session}
                        fetchMembers={fetchMembers}
                        mutate={mutate}
                      />
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            <KidLoginHelp slug={slug} kidsCount={kids.length} />

            {waiting.length > 0 && (
              <Card testId="members-waiting-section" className="mt-2">
                <h2 className="mb-1 flex items-center gap-2 font-heading text-xl text-black">
                  <Send size={18} aria-hidden="true" /> Waiting to join
                </h2>
                <p className="mb-4 text-sm font-bold text-gray-500">
                  They have an email sign-in link that has not been used yet.
                </p>
                <ul className="space-y-3" data-testid="members-waiting-list">
                  {waiting.map((m, idx) => (
                    <li key={m.id} className="list-none">
                      <WaitingRow
                        member={m}
                        idx={idx}
                        callerIsAdmin={callerIsAdmin}
                        mutate={mutate}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grown-ups group card ────────────────────────────────────────────────────

interface GrownUpCardProps {
  member: MemberItem;
  idx: number;
  callerIsAdmin: boolean;
  adminCount: number;
  editingFor: string | null;
  setEditingFor: (id: string | null) => void;
  navigate: ReturnType<typeof useNavigate>;
  slug: string;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}

function GrownUpCard({
  member: m,
  idx,
  callerIsAdmin,
  adminCount,
  editingFor,
  setEditingFor,
  navigate,
  slug,
  mutate,
}: GrownUpCardProps) {
  const isParentRow = m.role === 'admin' || m.role === 'adult';
  const lastAdminLock = m.role === 'admin' && adminCount <= 1;
  const testId = `members-grownup-${idx}`;

  const isAdminRole = m.role === 'admin';

  return (
    <MemberCard
      role={m.role}
      name={m.displayName}
      avatarEmoji={m.avatarEmoji}
      statusLine="Signed in"
      badge={<RoleBadge role={m.role} testId={`${testId}-role`} />}
      testId={testId}
      footer={
        callerIsAdmin ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid={`${testId}-edit-name`}
                onClick={() => setEditingFor(editingFor === m.id ? null : m.id)}
                className="flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-black bg-white px-4 text-sm font-bold text-black transition-colors hover:bg-gray-50"
              >
                <Edit2 size={14} aria-hidden="true" /> Edit name
              </button>
              <button
                type="button"
                data-testid={`${testId}-change-email`}
                disabled
                title="Coming soon — changing a member's sign-in email (FHS-510)"
                className="flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-black bg-white px-4 text-sm font-bold text-gray-300"
              >
                <Mail size={14} aria-hidden="true" /> Change email
              </button>
              {isAdminRole && (
                <button
                  type="button"
                  data-testid="members-admin-panel-btn"
                  onClick={() => navigate(`/t/${slug}/admin`)}
                  className="flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-black bg-white px-4 text-sm font-bold text-orange-600 transition-colors hover:bg-orange-50"
                >
                  <Settings2 size={14} aria-hidden="true" /> Admin Panel
                </button>
              )}
            </div>
            <RemoveButton
              testId={testId}
              disabled={lastAdminLock}
              name={m.displayName}
              onConfirm={() => void mutate(`/api/members/${m.id}`, { method: 'DELETE' })}
            />
          </>
        ) : null
      }
    >
      {callerIsAdmin && isParentRow && (
        <div
          className="mt-4 flex items-center gap-3 rounded-xl border-2 border-black bg-gray-50 p-3"
          data-testid={`${testId}-admin-panel`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm text-black">Admin</p>
            <p className="text-xs font-bold text-gray-500">
              {lastAdminLock
                ? 'The last admin cannot be removed.'
                : isAdminRole
                  ? 'Can change family settings.'
                  : 'Give full family access.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isAdminRole}
            data-testid={`${testId}-admin-toggle`}
            disabled={lastAdminLock}
            onClick={() =>
              void mutate(`/api/members/${m.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ role: isAdminRole ? 'adult' : 'admin' }),
              })
            }
            className={`relative inline-flex h-[34px] w-[60px] shrink-0 items-center rounded-full border-2 border-black transition-colors ${
              isAdminRole ? 'bg-emerald-400' : 'bg-gray-200'
            } ${lastAdminLock ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-[26px] w-[26px] rounded-full border-2 border-black bg-white shadow-neo-xs transition-transform ${
                isAdminRole ? 'translate-x-[26px]' : 'translate-x-0.5'
              }`}
            />
            <span className="sr-only">{isAdminRole ? 'Remove admin' : 'Make admin'}</span>
          </button>
        </div>
      )}
      {editingFor === m.id && (
        <EditNameForm
          current={m.displayName}
          testId={testId}
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
    </MemberCard>
  );
}

// ── Kids group card ──────────────────────────────────────────────────────────

interface KidCardProps {
  member: MemberItem;
  idx: number;
  callerRole: string;
  callerIsAdmin: boolean;
  editingFor: string | null;
  setEditingFor: (id: string | null) => void;
  openPinFor: string | null;
  setOpenPinFor: (id: string | null) => void;
  slug: string;
  session: { access_token?: string } | null;
  fetchMembers: () => Promise<void>;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}

function KidCard({
  member: m,
  idx,
  callerRole,
  callerIsAdmin,
  editingFor,
  setEditingFor,
  openPinFor,
  setOpenPinFor,
  slug,
  session,
  fetchMembers,
  mutate,
}: KidCardProps) {
  const callerCanManagePin = ADMIN_OR_ADULT.has(callerRole) && PIN_ELIGIBLE_ROLES.has(m.role);
  const testId = `members-kid-${idx}`;

  return (
    <MemberCard
      role={m.role}
      name={m.displayName}
      avatarEmoji={m.avatarEmoji}
      statusLine={m.hasPin ? 'PIN set' : 'No PIN yet'}
      badge={<RoleBadge role={m.role} age={m.age} testId={`${testId}-role`} />}
      testId={testId}
      footer={
        callerIsAdmin ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid={`${testId}-edit-name`}
                onClick={() => setEditingFor(editingFor === m.id ? null : m.id)}
                className="flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-black bg-white px-4 text-sm font-bold text-black transition-colors hover:bg-gray-50"
              >
                <Edit2 size={14} aria-hidden="true" /> Edit name
              </button>
              {callerCanManagePin && (
                <button
                  type="button"
                  data-testid={`${testId}-pin-toggle`}
                  onClick={() => setOpenPinFor(openPinFor === m.id ? null : m.id)}
                  className="flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-black bg-white px-4 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
                >
                  <Key size={14} aria-hidden="true" />
                  {openPinFor === m.id ? 'Cancel' : m.hasPin ? 'Reset PIN' : 'Set PIN'}
                </button>
              )}
            </div>
            <RemoveButton
              testId={testId}
              disabled={false}
              name={m.displayName}
              onConfirm={() => void mutate(`/api/members/${m.id}`, { method: 'DELETE' })}
            />
          </>
        ) : null
      }
    >
      <div
        className="mt-4 rounded-xl border-2 border-black bg-gray-50 p-3"
        data-testid={`${testId}-account-note`}
      >
        <p className="font-heading text-sm text-black">
          {m.role === 'teen' ? 'Teen account' : 'Child account'}
        </p>
        <p className="text-xs font-bold text-gray-500">
          Signs in with a PIN, cannot be given admin access.
        </p>
      </div>
      {editingFor === m.id && (
        <EditNameForm
          current={m.displayName}
          testId={testId}
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
          testId={testId}
          onDone={() => {
            setOpenPinFor(null);
            void fetchMembers();
          }}
        />
      )}
    </MemberCard>
  );
}

// ── Waiting-to-join row (unclaimed grown-up seats) ──────────────────────────
// FHS-520 (design-fidelity) — a compact horizontal row (avatar, name,
// email, role badge, resend/remove) inside the "Waiting to join" white
// card, matching the Magic Patterns mock — no longer a full MemberCard.

interface WaitingCardProps {
  member: MemberItem;
  idx: number;
  callerIsAdmin: boolean;
  mutate: (path: string, init: RequestInit) => Promise<boolean>;
}

function WaitingRow({ member: m, idx, callerIsAdmin, mutate }: WaitingCardProps) {
  const testId = `members-waiting-${idx}`;
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-3 rounded-xl border-2 border-black bg-gray-50 p-3 sm:flex-row sm:items-center"
    >
      <AvatarDisc role={m.role} name={m.displayName} emoji={m.avatarEmoji} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-base text-black" data-testid={`${testId}-name`}>
          {m.displayName}
        </p>
        <p className="truncate text-xs font-bold text-gray-500" data-testid={`${testId}-status`}>
          {m.inviteEmail ?? 'No email on file'}
        </p>
        <p
          className="mt-1 flex items-center gap-1.5 text-xs font-bold text-yellow-800"
          data-testid={`${testId}-pending`}
        >
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          Pending: hasn&rsquo;t signed up
        </p>
      </div>
      <RoleBadge role={m.role} testId={`${testId}-role`} />
      {callerIsAdmin && (
        <div className="flex shrink-0 items-center gap-2">
          {m.inviteId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              testId={`${testId}-resend`}
              onClick={() =>
                void mutate(`/api/invitations/${m.inviteId}/resend`, { method: 'POST' })
              }
            >
              Resend
            </Button>
          )}
          <RemoveButton
            testId={testId}
            disabled={false}
            name={m.displayName}
            onConfirm={() => void mutate(`/api/members/${m.id}`, { method: 'DELETE' })}
          />
        </div>
      )}
    </div>
  );
}

// FHS-437 — parent-side counterpart to the self-serve kid login: without
// this, a parent had no way to find or share the link/code their kid needs
// to sign in, so a brand-new family's kid had no working path in at all.
// FHS-513 — now a collapsible "How your kids sign in" card with the same
// link/code + copy button, plus the 3-step walkthrough from the design.
function KidLoginHelp({ slug, kidsCount }: { slug: string; kidsCount: number }) {
  const [copied, setCopied] = useState(false);
  const kidLoginUrl = `${window.location.origin}/t/${slug}/kid-login`;

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(kidLoginUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission blocked / unavailable — the link and code are
      // still visible on-screen to copy by hand.
    }
  }, [kidLoginUrl]);

  return (
    <CollapsibleSection
      emoji="🔑"
      title="How your kids sign in"
      subtitle={`${kidsCount} kid${kidsCount === 1 ? '' : 's'} use your family code and their own PIN.`}
      tileClassName="bg-purple-300"
      testId="members-kid-login-share"
    >
      <p className="mb-3 font-body text-sm text-gray-700">
        Share this with your kid so they can sign in on their own device. They can open the link
        below, or type the family code{' '}
        <code
          className="rounded border-2 border-black bg-white px-1.5 py-0.5 font-mono text-xs font-bold"
          data-testid="members-kid-login-code"
        >
          {slug}
        </code>{' '}
        on the &ldquo;I&rsquo;m a Kid&rdquo; tab at <span className="font-semibold">/login</span>.
      </p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code
          className="flex-1 truncate rounded-lg border-2 border-black bg-white px-3 py-2.5 font-mono text-xs text-gray-800 sm:text-sm"
          data-testid="members-kid-login-url"
        >
          {kidLoginUrl}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onCopy}
          testId="members-kid-login-copy"
          className="w-full sm:w-auto"
        >
          <Copy size={16} aria-hidden="true" /> {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </div>
      <ol className="list-inside list-decimal space-y-1 text-sm font-bold text-gray-700">
        <li>Open the link above, or go to /login on their device.</li>
        <li>Tap &ldquo;I&rsquo;m a Kid&rdquo; and enter the family code.</li>
        <li>Pick their name and type their PIN.</li>
      </ol>
    </CollapsibleSection>
  );
}

// FHS-486 / ADR 0019 — the role a caller can invite from Manage Members.
// `child` is excluded: kids use PIN login, never the magic-link invite
// (ADR 0009 / FHS-234). FHS-513 — `teen` is also dropped from THIS form
// (the design routes teens through "Add a child" instead); the server
// still accepts a teen invite for backward compatibility, this UI just
// no longer offers it. The server enforces the admin-grant safeguard
// (only an admin caller may pick 'admin') — this picker mirrors it by
// hiding the option entirely for a non-admin caller.
type InviteRole = 'admin' | 'adult' | 'guest';

const INVITE_ROLE_OPTIONS: Array<{ value: InviteRole; label: string; adminOnly?: boolean }> = [
  { value: 'admin', label: 'Parent / partner', adminOnly: true },
  { value: 'adult', label: 'Adult' },
  { value: 'guest', label: 'Guest' },
];

const INVITE_ROLE_HELP: Record<InviteRole, string> = {
  admin: 'Full access — everyday tasks, past-date edits, the economy, and family settings.',
  adult: 'Day-to-day help — grandma, a cousin, a sitter. No past-date edits or admin tools.',
  guest: 'Can log in and see everything, but can’t change anything.',
};

function InviteAdultForm({
  callerIsAdmin,
  onClose,
  onSubmit,
  error,
}: {
  callerIsAdmin: boolean;
  onClose: () => void;
  onSubmit: (email: string, name: string | null, role: InviteRole) => Promise<void>;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('adult');
  const [submitting, setSubmitting] = useState(false);
  const options = INVITE_ROLE_OPTIONS.filter((r) => !r.adminOnly || callerIsAdmin);

  return (
    <FormCard
      title="Invite an adult"
      description="They'll receive an email with a sign-in link to join the family. No password needed."
      onClose={onClose}
      closeLabel="Close invite form"
      testId="members-invite-form"
    >
      <form
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          setSubmitting(true);
          void onSubmit(email.trim(), name.trim() || null, role).finally(() =>
            setSubmitting(false),
          );
        }}
      >
        <div className="w-full sm:w-52">
          <Label htmlFor="invite-adult-role">Role</Label>
          <Select
            id="invite-adult-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            aria-describedby="members-invite-role-help"
            testId="members-invite-role"
          >
            {options.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="invite-adult-name">Name</Label>
          <Input
            id="invite-adult-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Yusuf"
            testId="members-invite-name"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="invite-adult-email" required>
            Email
          </Label>
          <Input
            id="invite-adult-email"
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
            variant="purple"
            size="md"
            disabled={submitting}
            testId="members-invite-send"
          >
            <Send size={16} aria-hidden="true" /> {submitting ? 'Sending…' : 'Send sign-in link'}
          </Button>
        </div>
      </form>
      <p
        id="members-invite-role-help"
        className="mt-3 text-xs font-bold text-gray-500"
        data-testid="members-invite-role-help"
      >
        {INVITE_ROLE_HELP[role]}
      </p>
      {error && (
        <p
          role="alert"
          data-testid="members-invite-error"
          className="mt-3 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}
    </FormCard>
  );
}

// FHS-513 — "Add a child" is now Child/Teen only (no-login, PIN-based
// seats), matching the finalised design's two-CTA header. The previous
// "Add member → Adult (no login)" path is removed from this form; the
// POST /api/members endpoint still accepts role: 'adult' unchanged, an
// admin/adult grown-up seat is created going forward via Invite instead.
type AddChildRole = 'child' | 'teen';

const ADD_CHILD_ROLE_OPTIONS: Array<{ value: AddChildRole; label: string }> = [
  { value: 'child', label: 'Child' },
  { value: 'teen', label: 'Teen' },
];

function AddChildForm({
  onClose,
  onSubmit,
  error,
}: {
  onClose: () => void;
  onSubmit: (
    displayName: string,
    role: AddChildRole,
    age: number | null,
    avatarEmoji: string | null,
  ) => Promise<void>;
  error: string | null;
}) {
  const [role, setRole] = useState<AddChildRole>('child');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <FormCard
      title="Add a child"
      description="Kids don't need an email. They sign in by tapping their avatar and entering a 4-digit PIN — set one from their card below."
      onClose={onClose}
      closeLabel="Close add-a-child form"
      testId="members-add-child-form"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const parsedAge = age.trim() === '' ? null : Number.parseInt(age, 10);
          setSubmitting(true);
          void onSubmit(
            name.trim(),
            role,
            Number.isNaN(parsedAge as number) ? null : parsedAge,
            avatarEmoji || null,
          ).finally(() => setSubmitting(false));
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-40">
            <Label htmlFor="add-child-role">Type</Label>
            <Select
              id="add-child-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AddChildRole)}
              testId="members-add-child-role"
            >
              {ADD_CHILD_ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
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
        </div>
        <div>
          <Label htmlFor="add-child-emoji">Avatar</Label>
          <AvatarEmojiPicker
            value={avatarEmoji}
            onSelect={setAvatarEmoji}
            testId="members-add-child-emoji"
          />
        </div>
        <div className="flex items-center">
          <Button
            type="submit"
            variant="purple"
            size="md"
            disabled={submitting}
            testId="members-add-child-save"
          >
            <UserPlus size={16} aria-hidden="true" /> {submitting ? 'Adding…' : 'Add to the family'}
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
    </FormCard>
  );
}

function EditNameForm({
  current,
  testId,
  onCancel,
  onSave,
}: {
  current: string;
  testId: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(current);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="mb-4 flex items-end gap-2"
      data-testid={`${testId}-edit-form`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        void onSave(name.trim()).finally(() => setSubmitting(false));
      }}
    >
      <div className="flex-1">
        <Label htmlFor={`edit-name-${testId}`}>New name</Label>
        <Input
          id={`edit-name-${testId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          testId={`${testId}-edit-input`}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={submitting}
        testId={`${testId}-edit-save`}
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
  testId,
  disabled,
  name,
  onConfirm,
}: {
  testId: string;
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
          data-testid={`${testId}-remove-confirm`}
          onClick={onConfirm}
          title="Their personal tasks and meals are removed too"
          className="max-w-full truncate rounded border-2 border-black bg-red-100 px-2 py-1 text-xs font-bold text-red-700 min-h-[44px]"
        >
          Remove {name}? (their tasks &amp; meals go too)
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="inline-block py-2 text-xs font-bold text-gray-500 hover:text-black"
        >
          Keep
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid={`${testId}-remove`}
      disabled={disabled}
      onClick={() => setArmed(true)}
      title={`Remove ${name}`}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white transition-colors ${
        disabled ? 'cursor-not-allowed text-gray-300' : 'text-red-600 hover:bg-red-50'
      }`}
    >
      <Trash2 size={18} aria-hidden="true" />
    </button>
  );
}

// FHS-252 — inline form for setting / resetting a kid PIN. Unchanged
// behaviour from the pre-FHS-513 page — just re-keyed off the new
// per-card `testId` prefix instead of a row index.

interface KidPinFormProps {
  member: { id: string; displayName: string; hasPin: boolean };
  slug: string;
  accessToken: string | undefined;
  testId: string;
  onDone: () => void;
}

function KidPinForm({ member, slug, accessToken, testId, onDone }: KidPinFormProps) {
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
        setError("PINs don't match. Type the same digits twice.");
        return;
      }
      if (!accessToken) {
        setError('Not signed in. Refresh and try again.');
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
        setError(err instanceof Error ? err.message : 'Network error. Try again.');
        setSubmitting(false);
      }
    },
    [pin, confirm, member.id, slug, accessToken, onDone],
  );

  const onRemove = useCallback(async () => {
    setError(null);
    if (!accessToken) {
      setError('Not signed in. Refresh and try again.');
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
      setError(err instanceof Error ? err.message : 'Network error. Try again.');
      setSubmitting(false);
    }
  }, [member.id, slug, accessToken, onDone]);

  return (
    <form
      onSubmit={onSet}
      className="mb-4 space-y-3 rounded-md border-2 border-dashed border-black bg-white p-3"
      data-testid={`${testId}-pin-form`}
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
          testId={`${testId}-pin-input`}
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
          testId={`${testId}-pin-confirm`}
        />
      </div>
      {error && (
        <p
          className="text-sm font-bold text-red-600"
          role="alert"
          data-testid={`${testId}-pin-error`}
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
          testId={`${testId}-pin-save`}
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
            testId={`${testId}-pin-remove`}
          >
            Remove kid login
          </Button>
        )}
      </div>
    </form>
  );
}
