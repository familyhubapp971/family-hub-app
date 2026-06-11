import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Home,
  LogOut,
  Plus,
  Utensils,
} from 'lucide-react';
import { Card, TopNav, type TopNavTab } from '@familyhub/ui';
import { signOutAll, useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';
import { TodayTabPanel } from './dashboard/TodayTabPanel';
import { MealsTabPanel } from './dashboard/MealsTabPanel';
import { CalendarTabPanel } from './dashboard/CalendarTabPanel';
import { AssignmentsTabPanel } from './dashboard/AssignmentsTabPanel';
import { NoticeboardTabPanel } from './dashboard/NoticeboardTabPanel';
import { TasksTabPanel } from './dashboard/TasksTabPanel';

// FHS-227 + FHS-261 — Parent Dashboard shell. Six tabs gated by the
// `?tab=<id>` URL query so deep-links + browser back-button work.
// Default tab = `home` (TodayTabPanel / FHS-228).
//
// FHS-261 replaced the original "Family Hub" wordmark + email + Log out
// header with:
//   • a family-name hero (avatar disc + uppercase name + members-active pulse)
//   • per-tab lucide-react icons + numeric badges (badge prop wires once
//     FHS-262 expands /api/dashboard/today with the counts)
//   • a profile pill dropdown that lists the family's children with
//     "View World →" deep-links (the destination route lands in FHS-268),
//     an "Add Child" affordance, and Log out at the bottom
//
// The family name + member list are fetched from the existing
// `/api/me` + `/api/dashboard/today` endpoints on mount. Both are
// expected to be expanded in FHS-262; for now this page keeps its
// own small fetch so it doesn't piggy-back on TodayTabPanel's state.

interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  ticket: string;
  description: string;
}

const TABS: TabDef[] = [
  {
    id: 'home',
    label: 'Family Dashboard',
    icon: <Home size={16} aria-hidden="true" />,
    ticket: 'FHS-228',
    description: 'Family member grid + today snapshot.',
  },
  {
    id: 'meals',
    label: 'Meals',
    icon: <Utensils size={16} aria-hidden="true" />,
    ticket: 'FHS-229',
    description: 'Weekly meal planner.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: <CalendarDays size={16} aria-hidden="true" />,
    ticket: 'FHS-230',
    description: 'Week view with events.',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    icon: <BookOpen size={16} aria-hidden="true" />,
    ticket: 'FHS-231',
    description: 'Homework list per child.',
  },
  {
    id: 'noticeboard',
    label: 'Noticeboard',
    icon: <Bell size={16} aria-hidden="true" />,
    ticket: 'FHS-232',
    description: 'Pinned family notes.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: <CheckSquare size={16} aria-hidden="true" />,
    ticket: 'FHS-233',
    description: 'Per-parent to-do list.',
  },
];

const DEFAULT_TAB = 'home';

// In-app tab badge counts come from the expanded `/api/dashboard/today`
// response in FHS-262. Until that lands every tab badge is 0 — kept as
// a typed map so the wiring is in place and FHS-262 can flip the
// values without re-shuffling the render tree.
type TabBadgeMap = Partial<Record<(typeof TABS)[number]['id'], number>>;

function isKnownTab(id: string | null): id is string {
  return id !== null && TABS.some((t) => t.id === id);
}

interface DashboardMember {
  id: string;
  displayName: string;
  role: string;
  avatarEmoji: string | null;
}

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

// Build the hero title from the tenant's stored name. We always append
// "Family Hub" so the header reads as a branded surface (matches MP),
// but skip the append when the user already named their family ending
// in "Family" or "Family Hub" so we don't end up with "KHAN FAMILY
// FAMILY HUB".
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

function ProfilePill({
  parentName,
  childMembers,
  onAddChild,
  slug,
}: {
  parentName: string;
  childMembers: DashboardMember[];
  onAddChild: () => void;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape so the dropdown behaves like a
  // standard menu without us pulling in a menu library.
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
  // MP shows the first name only, uppercase, in the pill trigger.
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
              <div>
                <p
                  className="truncate font-heading text-sm uppercase tracking-wide"
                  data-testid="dashboard-profile-parent-name"
                >
                  {parentName}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Parent · Admin
                </p>
              </div>
            </div>
          </div>
          {childMembers.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Children
              </p>
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
                      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100"
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
                        className="ml-auto text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-purple-600"
                      >
                        View World →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="px-3 pb-3">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAddChild();
              }}
              data-testid="dashboard-profile-add-child"
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 px-3 py-2.5 text-purple-500 transition-colors hover:border-purple-500 hover:bg-purple-50 hover:text-purple-700"
            >
              <Plus size={16} strokeWidth={3} aria-hidden="true" />
              <span className="text-sm font-bold">Add Child</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [params, setParams] = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);

  const [familyName, setFamilyName] = useState<string | null>(null);
  const [members, setMembers] = useState<DashboardMember[] | null>(null);
  const [openTasks, setOpenTasks] = useState<number>(0);
  const [headerLoading, setHeaderLoading] = useState(true);

  const requested = params.get('tab');
  const activeTab = isKnownTab(requested) ? requested : DEFAULT_TAB;

  // Hydrate the family name + member list once on mount. The shape
  // intentionally mirrors what /api/dashboard/today.members will
  // expand to in FHS-262 so the rest of the page can lift state to
  // here later without changing types.
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
      if (tenant) setFamilyName(tenant.name);
      if (today && Array.isArray(today.members)) setMembers(today.members as DashboardMember[]);
      // Tasks tab badge = the family's still-open tasks (FHS-262 counts).
      if (today && today.counts) {
        const c = today.counts as { tasksDoneToday?: number; tasksTotalToday?: number };
        setOpenTasks(Math.max(0, (c.tasksTotalToday ?? 0) - (c.tasksDoneToday ?? 0)));
      }
      setHeaderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  const onTabChange = useCallback(
    (tabId: string) => {
      const next = new URLSearchParams(params);
      if (tabId === DEFAULT_TAB) {
        next.delete('tab');
      } else {
        next.set('tab', tabId);
      }
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const onLogout = useCallback(async () => {
    setSigningOut(true);
    // FHS-253 — signOutAll clears both the parent Supabase session AND
    // the kid JWT in localStorage. Calling supabase.auth.signOut directly
    // would leave fh.kid.token behind on the iPad, so a kid stayed
    // "logged in" after the parent walked away.
    const { error } = await signOutAll();
    if (error) {
      console.error('signOut failed', error);
      setSigningOut(false);
      return;
    }
    navigate('/', { replace: true });
  }, [navigate]);

  const onAddChild = useCallback(() => {
    navigate(`/t/${slug}/members?add=child`);
  }, [navigate, slug]);

  // Tab badges. Tasks = open tasks from /api/dashboard/today counts;
  // assignments/noticeboard counts wire up when those tabs are
  // redesigned (their APIs don't expose totals yet).
  const tabBadges: TabBadgeMap = { tasks: openTasks };

  const navTabs: TopNavTab[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: tabBadges[t.id] ?? 0,
  }));
  const active = TABS.find((t) => t.id === activeTab)!;

  const parentName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    'You';
  const childMembers = (members ?? []).filter((m) => m.role === 'child');

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      <TopNav
        brand={
          <FamilyHero
            familyName={familyName}
            memberCount={members?.length ?? null}
            loading={headerLoading}
          />
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        rightSlot={
          <>
            <ProfilePill
              parentName={parentName}
              childMembers={childMembers}
              onAddChild={onAddChild}
              slug={slug}
            />
            <button
              type="button"
              onClick={onLogout}
              disabled={signingOut}
              aria-label="Logout"
              data-testid="dashboard-logout"
              className="flex items-center gap-2 rounded-md border-2 border-black bg-red-500 px-4 py-2 font-bold text-white shadow-neo-sm transition-transform hover:bg-red-600 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
            >
              <LogOut size={16} strokeWidth={3} aria-hidden="true" />
              <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Logout'}</span>
            </button>
          </>
        }
        testId="dashboard-nav"
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`dashboard-panel-${active.id}`}
        >
          {/* MP renders tab content straight on the kingdom-purple
              background (each tab brings its own cards). The home tab is
              already rebuilt that way — wrapping it in a white card would
              hide its white headings. Tabs not yet redesigned keep the
              white card until their own MP rebuild lands. */}
          {active.id === 'home' ? (
            <TodayTabPanel />
          ) : (
            <Card className="bg-white p-6 text-gray-900 md:p-8">
              {active.id === 'meals' ? (
                <MealsTabPanel />
              ) : active.id === 'calendar' ? (
                <CalendarTabPanel />
              ) : active.id === 'assignments' ? (
                <AssignmentsTabPanel />
              ) : active.id === 'noticeboard' ? (
                <NoticeboardTabPanel />
              ) : active.id === 'tasks' ? (
                <TasksTabPanel />
              ) : (
                <PlaceholderPanel
                  label={active.label}
                  ticket={active.ticket}
                  description={active.description}
                />
              )}
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

function PlaceholderPanel({
  label,
  ticket,
  description,
}: {
  label: string;
  ticket: string;
  description: string;
}) {
  return (
    <>
      <header className="mb-3 flex items-baseline justify-between">
        <h1
          className="font-heading text-2xl text-black md:text-3xl"
          data-testid="dashboard-panel-title"
        >
          {label}
        </h1>
        <span className="font-mono text-xs text-gray-500">{ticket}</span>
      </header>
      <p className="text-sm text-gray-700">{description}</p>
      <p className="mt-4 text-sm font-bold text-gray-600">Coming soon — tracked under {ticket}.</p>
    </>
  );
}
