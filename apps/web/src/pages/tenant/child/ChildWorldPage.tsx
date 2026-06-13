import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, GraduationCap, Sparkles, Utensils } from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';
import { MyWorldTab } from './MyWorldTab';
import { MealsTab } from './MealsTab';
import { CalendarTab } from './CalendarTab';

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
  { id: 'world', label: 'My World', icon: <Sparkles size={16} aria-hidden="true" /> },
  { id: 'meals', label: 'Meals', icon: <Utensils size={16} aria-hidden="true" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} aria-hidden="true" /> },
  { id: 'journal', label: 'Journal', icon: <BookOpen size={16} aria-hidden="true" /> },
  { id: 'learn', label: 'Learn', icon: <GraduationCap size={16} aria-hidden="true" /> },
];

const DEFAULT_TAB = 'world';

interface MemberLite {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

export function ChildWorldPage() {
  const slug = useTenantSlug();
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [member, setMember] = useState<MemberLite | null>(null);

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
        const found = (body.members as MemberLite[]).find((m) => m.id === memberId) ?? null;
        setMember(found);
      })
      .catch(() => {
        /* leave member null — header falls back to a generic greeting */
      });
    return () => {
      cancelled = true;
    };
  }, [headers, memberId]);

  const onBack = useCallback(() => navigate(`/t/${slug}/dashboard`), [navigate, slug]);

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
            <h1
              className="font-heading text-2xl uppercase tracking-wide text-white drop-shadow-md md:text-3xl"
              data-testid="child-world-name"
            >
              {childName === 'My' ? 'My World' : `${childName}'s World`}
            </h1>
          </div>
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={
          <button
            type="button"
            onClick={onBack}
            data-testid="child-world-back"
            className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-white px-4 py-2 font-bold text-purple-900 shadow-neo-sm transition-transform hover:bg-yellow-50 motion-safe:hover:-translate-y-0.5"
          >
            <ArrowLeft size={16} strokeWidth={3} aria-hidden="true" />
            <span className="hidden sm:inline">Back to family</span>
          </button>
        }
        testId="child-world-nav"
      />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`child-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`child-panel-${active.id}`}
        >
          {active.id === 'world' ? (
            <MyWorldTab memberId={memberId} />
          ) : active.id === 'meals' ? (
            <MealsTab memberId={memberId} />
          ) : active.id === 'calendar' ? (
            <CalendarTab memberId={memberId} />
          ) : (
            <div
              data-testid={`child-panel-soon-${active.id}`}
              className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
            >
              <p aria-hidden="true" className="text-5xl">
                {active.id === 'meals'
                  ? '🍽️'
                  : active.id === 'calendar'
                    ? '📅'
                    : active.id === 'journal'
                      ? '📔'
                      : '📚'}
              </p>
              <h2 className="mt-3 font-heading text-2xl text-black">{active.label}</h2>
              <p className="mt-2 text-sm font-bold text-purple-700">Coming soon!</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
