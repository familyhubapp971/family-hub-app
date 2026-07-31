// AppHeader — shared top-navigation header for all authenticated parent pages.
//
// Encapsulates:
//  • FamilyHero brand area (family-initial disc + name + members-active pulse)
//  • TopNav with the six dashboard tabs + per-tab badges
//  • ProfilePill dropdown (child links, Add member, Manage Members)
//  • Logout button
//
// Self-fetches family name + members + Tasks badge from /api/me +
// /api/dashboard/today. Listens to fh:dashboard-stale (FHS-309) to
// refresh badge counts live when a task mutation fires in any tab.
//
// Props:
//  activeTab   — which tab to highlight; pass null when no tab is active
//                (e.g. Admin Panel, Members page).
//  onTabChange — called with the tab id when the user clicks a tab;
//                the caller decides how to handle the navigation.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, Users } from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import type { DashboardMember } from '@familyhub/shared';
import { signOutAll, useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';
import { useDashboardStaleSignal } from '../../lib/dashboard-refresh';
import { TABS, DEFAULT_TAB } from './dashboard-tabs';

// In-app tab badge counts — typed map so wiring is in place for FHS-262.
type TabBadgeMap = Partial<Record<(typeof TABS)[number]['id'], number>>;

interface MeResponseTenant {
  id: string;
  slug: string;
  name: string;
  role: string;
}

// Family-initial avatar that opens the brand area. Picks a deterministic
// gradient out of a small palette so the same family always lands on
// the same colours across reloads.
function FamilyInitialDisc({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'F';
  const palette = [
    'from-pink-400 to-purple-500',
    'from-amber-400 to-pink-500',
    'from-cyan-400 to-blue-500',
    'from-emerald-400 to-cyan-500',
    'from-violet-400 to-fuchsia-500',
  ];
  const idx = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length;
  return (
    <span
      aria-hidden="true"
      data-testid="dashboard-family-initial"
      className={`grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-gradient-to-br ${palette[idx]} font-display text-2xl font-black text-white shadow-neo-sm`}
    >
      {initial}
    </span>
  );
}

// Build the hero title from the tenant's stored name. Always appends
// "Family Hub" branding but skips the append when the name already ends
// in "Family" or "Family Hub" to avoid "KHAN FAMILY FAMILY HUB".
function buildHeroTitle(name: string | null): string {
  const base = (name ?? 'Family').trim();
  if (/family\s*hub$/i.test(base)) return base;
  if (/family$/i.test(base)) return `${base} Hub`;
  return `${base} Family Hub`;
}

function FamilyHero({
  familyName,
  memberCount,
  loading,
}: {
  familyName: string | null;
  memberCount: number | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3" data-testid="dashboard-family-hero-loading">
        <span className="h-10 w-10 rounded-full bg-white/10" />
        <span className="h-5 w-32 rounded bg-white/10" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4" data-testid="dashboard-family-hero">
      <FamilyInitialDisc name={familyName ?? 'Family'} />
      <div className="flex flex-col">
        <h1 className="flex items-center gap-1.5 font-heading text-2xl uppercase leading-tight tracking-wide text-white drop-shadow-md md:text-3xl">
          <span data-testid="dashboard-family-name">{buildHeroTitle(familyName)}</span>
          <span aria-hidden="true" className="text-yellow-300">
            ✨
          </span>
        </h1>
        {memberCount !== null && memberCount > 0 && (
          <span
            className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-300"
            data-testid="dashboard-members-active"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 animate-pulse rounded-full border border-black bg-green-400"
            />
            {memberCount} {memberCount === 1 ? 'member' : 'members'} active
          </span>
        )}
      </div>
    </div>
  );
}

// Children in the dropdown get coloured initial discs (MP cycles
// yellow/purple). Same order = same colour across reloads.
const CHILD_DISC_COLORS = ['bg-yellow-300', 'bg-purple-300', 'bg-pink-300', 'bg-cyan-300'];

// FHS-485 / ADR 0019 — the caller's own role line in the profile menu.
// This used to be hardcoded "Parent · Admin" for everyone, which is wrong
// for an adult/teen/guest (only `admin` is the parent/partner with full
// rights). Read the caller's real role and label it to match the matrix.
const ROLE_PILL_LABEL: Record<string, string> = {
  admin: 'Parent · Admin',
  adult: 'Adult',
  teen: 'Teen',
  guest: 'Guest',
  child: 'Child',
};

function ProfilePill({
  parentName,
  role,
  childMembers,
  onManageMembers,
  onRewardSettings,
  slug,
}: {
  parentName: string;
  role: string | null;
  childMembers: DashboardMember[];
  onManageMembers: () => void;
  onRewardSettings: () => void;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = [...parentName.trim()][0]?.toUpperCase() ?? '?';
  const firstName = parentName.trim().split(/\s+/)[0] ?? parentName;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="dashboard-profile-pill"
        className={`flex items-center gap-3 rounded-full border-2 border-black py-1.5 pl-1.5 pr-4 text-sm font-bold text-white shadow-neo-xs transition-colors hover:bg-[#5a1d8a] focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 ${open ? 'bg-[#5a1d8a]' : 'bg-[#4a1578]'}`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-pink-300 font-heading text-lg text-black"
        >
          {initial}
        </span>
        <span className="max-w-[120px] truncate uppercase tracking-wide sm:max-w-[180px]">
          {firstName}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={3}
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          data-testid="dashboard-profile-menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border-2 border-black bg-white text-gray-900 shadow-neo-md"
        >
          <div className="border-b-2 border-black bg-pink-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-pink-300 font-heading text-xl"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p
                  className="truncate font-heading text-sm uppercase tracking-wide"
                  data-testid="dashboard-profile-parent-name"
                >
                  {parentName}
                </p>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
                  data-testid="dashboard-profile-role"
                >
                  {ROLE_PILL_LABEL[role ?? ''] ?? 'Member'}
                </p>
              </div>
            </div>
          </div>
          {/* FHS-471 — the "+" always shows here (even with zero children)
              since that's exactly when a tester most wants to add the
              family's first member; the dropdown was previously read as
              "my profile" with no obvious add-member control. */}
          <div className="px-3 py-2">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Children
            </p>
            {childMembers.length > 0 ? (
              <ul>
                {childMembers.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        window.location.assign(`/t/${slug}/child/${c.id}`);
                      }}
                      data-testid={`dashboard-profile-child-${c.id}`}
                      className="group flex min-h-11 w-full items-center gap-3 rounded-lg border-2 border-black bg-white px-3 py-2.5 text-left shadow-neo-xs transition-colors motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-neo-sm hover:bg-purple-50"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-black font-heading text-sm ${CHILD_DISC_COLORS[i % CHILD_DISC_COLORS.length]}`}
                      >
                        {[...c.displayName.trim()][0]?.toUpperCase() ?? '?'}
                      </span>
                      <span className="truncate text-sm font-bold">{c.displayName}</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto shrink-0 rounded-full border-2 border-black bg-purple-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-900 group-hover:bg-purple-400"
                      >
                        View World →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onManageMembers();
                }}
                data-testid="dashboard-profile-add-first-child"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-3 py-3 text-left transition-colors hover:border-black hover:bg-gray-50"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-300 text-base"
                >
                  👋
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">No kids added yet</span>
                  <span className="text-xs font-bold text-gray-500">Add your first child</span>
                </span>
              </button>
            )}
          </div>
          <div className="space-y-2 border-t-2 border-black px-3 pb-3 pt-3">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onManageMembers();
              }}
              data-testid="dashboard-profile-manage-members"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors hover:bg-gray-100"
            >
              <Users size={16} strokeWidth={3} aria-hidden="true" />
              Manage family
            </button>
            {/* FHS-512 / FHS-514 — reward-config ("Pocket money") settings. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRewardSettings();
              }}
              data-testid="dashboard-profile-reward-settings"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors hover:bg-gray-100"
            >
              <Settings size={16} strokeWidth={3} aria-hidden="true" />
              Reward settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AppHeader ─────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  /** Which tab to highlight in the nav. Pass null when no tab is active. */
  activeTab: string | null;
  /** Called with the tab id when the user clicks a nav tab. */
  onTabChange: (tabId: string) => void;
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { user, session } = useAuth();
  const slug = useTenantSlug();
  const navigate = useNavigate();

  const [familyName, setFamilyName] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [members, setMembers] = useState<DashboardMember[] | null>(null);
  const [openTasks, setOpenTasks] = useState<number>(0);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Hydrate family name + member roster once on mount.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    Promise.all([
      fetch(`${API_BASE}/api/me`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API_BASE}/api/dashboard/today`, {
        headers: { ...headers, 'x-tenant-slug': slug },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([me, today]) => {
      if (cancelled) return;
      const tenant =
        me && Array.isArray(me.tenants)
          ? (me.tenants as MeResponseTenant[]).find((t) => t.slug === slug)
          : undefined;
      if (tenant) {
        setFamilyName(tenant.name);
        setCallerRole(tenant.role);
      }
      if (today && Array.isArray(today.members)) {
        const roster = today.members as DashboardMember[];
        setMembers(roster);
        const caller = roster.find((m) => m.id === (today.callerMemberId as string | undefined));
        setOpenTasks(caller?.tasksPending ?? 0);
        setCallerName(caller?.displayName?.trim() || null);
      }
      setHeaderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  // FHS-309 — refresh badge counts when a task/notice mutation elsewhere
  // fires the dashboard-stale signal so the badge updates live.
  const refreshToday = useCallback(() => {
    if (!session) return;
    fetch(`${API_BASE}/api/dashboard/today`, {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((today) => {
        if (today && Array.isArray(today.members)) {
          const roster = today.members as DashboardMember[];
          setMembers(roster);
          const caller = roster.find((m) => m.id === (today.callerMemberId as string | undefined));
          setOpenTasks(caller?.tasksPending ?? 0);
          setCallerName(caller?.displayName?.trim() || null);
        }
      })
      .catch(() => {});
  }, [session, slug]);
  useDashboardStaleSignal(refreshToday);

  const onLogout = useCallback(async () => {
    setSigningOut(true);
    const { error } = await signOutAll();
    if (error) {
      console.error('signOut failed', error);
      setSigningOut(false);
      return;
    }
    navigate('/', { replace: true });
  }, [navigate]);

  const onManageMembers = useCallback(() => {
    navigate(`/t/${slug}/members`);
  }, [navigate, slug]);

  const onRewardSettings = useCallback(() => {
    navigate(`/t/${slug}/reward-settings`);
  }, [navigate, slug]);

  // FHS-506 — prefer the caller's roster display name (the name shown on their
  // member card) over the auth email. Magic-link signups often carry no
  // full_name, so the email used to leak into the account menu.
  const parentName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    callerName ??
    user?.email ??
    'You';

  const childMembers = (members ?? []).filter((m) => m.role === 'child');

  const tabBadges: TabBadgeMap = { tasks: openTasks };
  const navTabs: TopNavTab[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: tabBadges[t.id] ?? 0,
  }));

  return (
    <TopNav
      brand={
        <button
          type="button"
          onClick={() => onTabChange(DEFAULT_TAB)}
          aria-label="Go to Family Dashboard"
          data-testid="dashboard-brand-home"
          className="text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          <FamilyHero
            familyName={familyName}
            memberCount={members?.length ?? null}
            loading={headerLoading}
          />
        </button>
      }
      tabs={navTabs}
      activeTab={activeTab ?? ''}
      onTabChange={onTabChange}
      rightSlot={
        <>
          <ProfilePill
            parentName={parentName}
            role={callerRole}
            childMembers={childMembers}
            onManageMembers={onManageMembers}
            onRewardSettings={onRewardSettings}
            slug={slug}
          />
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={signingOut}
            aria-label="Logout"
            data-testid="dashboard-logout"
            className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-red-500 px-4 py-2 font-bold text-white shadow-neo-sm transition-transform hover:bg-red-600 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
          >
            <LogOut size={16} strokeWidth={3} aria-hidden="true" />
            <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Logout'}</span>
          </button>
        </>
      }
      testId="dashboard-nav"
    />
  );
}
