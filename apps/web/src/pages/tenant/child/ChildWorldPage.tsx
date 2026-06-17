import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Home, PenLine, Utensils } from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
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
}

export function ChildWorldPage() {
  const slug = useTenantSlug();
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [member, setMember] = useState<MemberLite | null>(null);
  // FHS-336 — the caller's role in this family (from /api/members), so My World
  // hides admin-only controls from a normal user. Null until loaded.
  const [callerRole, setCallerRole] = useState<string | null>(null);

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
        setCallerRole((body.callerRole as string | undefined) ?? null);
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
          <button
            type="button"
            onClick={onBack}
            data-testid="child-world-back"
            className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-[#4a1578] px-4 py-2 font-bold text-white shadow-neo-sm transition-transform hover:bg-[#5a1d8a] motion-safe:hover:-translate-y-0.5"
          >
            <ArrowLeft size={16} strokeWidth={3} aria-hidden="true" />
            <span className="hidden sm:inline">Back to family</span>
          </button>
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
