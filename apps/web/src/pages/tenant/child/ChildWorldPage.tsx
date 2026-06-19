import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Home, LogOut, PenLine, Utensils } from 'lucide-react';
import { TopNav, type TopNavTab, Dropdown } from '@familyhub/ui';
import { useAuth, signOutAll } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';
import { MyWorldTab } from './MyWorldTab';
import { MealsTab } from './MealsTab';
import { CalendarTab } from './CalendarTab';
import { JournalTab } from './JournalTab';
import { LearnTab } from './LearnTab';

// FHS-268 — ChildWorld shell.
//
// A friendly per-child surface at /t/:slug/child/:memberId, reached from
// the parent dashboard's "View World" links. Five tabs: My World (this
// ticket — habit tracker + rewards shop), then Meals + Calendar
// (FHS-269) and Journal + Learn (FHS-270) as placeholders for now.

interface ChildTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const CHILD_TABS: ChildTab[] = [
  { id: 'world', label: 'My World', icon: <Home size={16} aria-hidden="true" /> },
  { id: 'meals', label: 'Meals', icon: <Utensils size={16} aria-hidden="true" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} aria-hidden="true" /> },
  { id: 'journal', label: 'Journal', icon: <PenLine size={16} aria-hidden="true" /> },
  { id: 'learn', label: 'Learn', icon: <BookOpen size={16} aria-hidden="true" /> },
];

const DEFAULT_TAB = 'world';

interface MemberLite {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
  isChild: boolean;
}

interface ChildBalance {
  savedStickers: number;
  savedCash: number;
}

export function ChildWorldPage() {
  const slug = useTenantSlug();
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [members, setMembers] = useState<MemberLite[]>([]);
  // FHS-336 — the caller's role in this family (from /api/members), so My World
  // hides admin-only controls from a normal user. Null until loaded.
  const [callerRole, setCallerRole] = useState<string | null>(null);
  // FHS-288 — the child's banked balance for the header chips.
  const [balance, setBalance] = useState<ChildBalance | null>(null);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  useEffect(() => {
    if (!headers) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/members`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setMembers(((body.members as MemberLite[]) ?? []).map((m) => ({ ...m })));
        setCallerRole(typeof body.callerRole === 'string' ? body.callerRole : null);
      })
      .catch(() => {
        /* leave members empty — header falls back to a generic greeting */
      });
    return () => {
      cancelled = true;
    };
  }, [headers]);

  // FHS-288 — the child's banked balance (stars + cash) for the header chips.
  useEffect(() => {
    if (!headers || !memberId) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/mw/financial/savings?memberId=${memberId}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setBalance({
          savedStickers: Number(body.savedStickers ?? 0),
          savedCash: Number(body.savedCash ?? 0),
        });
      })
      .catch(() => {
        /* leave balance null — the chips just hide */
      });
    return () => {
      cancelled = true;
    };
  }, [headers, memberId]);

  const member = useMemo(() => members.find((m) => m.id === memberId) ?? null, [members, memberId]);
  const siblings = useMemo(() => members.filter((m) => m.isChild), [members]);

  const onBack = useCallback(() => navigate(`/t/${slug}/dashboard`), [navigate, slug]);
  const onSelectChild = useCallback(
    (id: string) => {
      if (id && id !== memberId) navigate(`/t/${slug}/child/${id}`);
    },
    [navigate, slug, memberId],
  );
  const onLogout = useCallback(async () => {
    await signOutAll();
    navigate('/login', { replace: true });
  }, [navigate]);

  const navTabs: TopNavTab[] = CHILD_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: 0,
  }));
  const active = CHILD_TABS.find((t) => t.id === activeTab) ?? CHILD_TABS[0]!;
  const childName = member?.displayName ?? 'My';

  return (
    <div
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
      data-testid="child-world"
    >
      <TopNav
        brand={
          <div className="flex items-center gap-3" data-testid="child-world-brand">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-gradient-to-br from-cyan-300 to-violet-400 text-2xl shadow-neo-sm"
            >
              {member?.avatarEmoji ?? '🌟'}
            </span>
            <div>
              <h1
                className="font-heading text-2xl uppercase tracking-wide text-white drop-shadow-md md:text-3xl"
                data-testid="child-world-name"
              >
                {childName === 'My' ? 'My World' : `${childName}'s World`}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-300">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full border border-black bg-green-400 motion-safe:animate-pulse"
                />
                Magic Active
              </p>
            </div>
          </div>
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={
          <div className="flex items-center gap-2">
            {/* FHS-288 — the child's banked balance (stars + cash). Always
                visible: one compact combined badge on phones, two chips from sm. */}
            {balance && (
              <div className="flex items-center gap-2" data-testid="child-world-balance">
                <span
                  aria-label={`${balance.savedStickers} stars, ${balance.savedCash} cash`}
                  className="flex items-center gap-1.5 rounded-md border-2 border-black bg-yellow-200 px-2 py-1.5 text-xs font-bold text-black shadow-neo-sm sm:hidden"
                >
                  <span aria-hidden="true">⭐ {balance.savedStickers}</span>
                  <span aria-hidden="true">💰 {balance.savedCash}</span>
                </span>
                <span className="hidden items-center gap-1 rounded-md border-2 border-black bg-yellow-300 px-2.5 py-1.5 text-sm font-bold text-black shadow-neo-sm sm:flex">
                  <span aria-hidden="true">⭐</span>
                  <span aria-label="stars">{balance.savedStickers}</span>
                </span>
                <span className="hidden items-center gap-1 rounded-md border-2 border-black bg-green-300 px-2.5 py-1.5 text-sm font-bold text-black shadow-neo-sm sm:flex">
                  <span aria-hidden="true">💰</span>
                  <span aria-label="cash">{balance.savedCash}</span>
                </span>
              </div>
            )}
            {/* FHS-288 — switch to a sibling's world (only when there's more than
                one kid). FHS-359 — in-app dropdown, not the native OS menu. */}
            {siblings.length > 1 && (
              <Dropdown
                ariaLabel="Switch child"
                testId="child-world-switcher"
                value={memberId}
                onChange={onSelectChild}
                options={siblings.map((s) => ({
                  value: s.id,
                  label: `${s.avatarEmoji ?? '🌟'} ${s.displayName}`,
                }))}
              />
            )}
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to family"
              data-testid="child-world-back"
              className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-[#4a1578] px-3 py-2 font-bold text-white shadow-neo-sm transition-transform hover:bg-[#5a1d8a] motion-safe:hover:-translate-y-0.5"
            >
              <ArrowLeft size={16} strokeWidth={3} aria-hidden="true" />
              <span className="hidden lg:inline">Back to family</span>
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              aria-label="Log out"
              data-testid="child-world-logout"
              className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-white px-3 py-2 font-bold text-purple-900 shadow-neo-sm transition-transform hover:bg-red-50 motion-safe:hover:-translate-y-0.5"
            >
              <LogOut size={16} strokeWidth={3} aria-hidden="true" />
              <span className="hidden lg:inline">Logout</span>
            </button>
          </div>
        }
        testId="child-world-nav"
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`child-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`child-panel-${active.id}`}
        >
          {active.id === 'world' ? (
            <MyWorldTab memberId={memberId} isAdmin={callerRole === 'admin'} />
          ) : active.id === 'meals' ? (
            <MealsTab memberId={memberId} />
          ) : active.id === 'calendar' ? (
            <CalendarTab memberId={memberId} />
          ) : active.id === 'journal' ? (
            <JournalTab memberId={memberId} />
          ) : (
            <LearnTab memberId={memberId} />
          )}
        </section>
      </main>
    </div>
  );
}
