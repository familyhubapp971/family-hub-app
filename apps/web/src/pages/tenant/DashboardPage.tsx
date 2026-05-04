import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button, Card, TopNav, type TopNavTab } from '@familyhub/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { TodayTabPanel } from './dashboard/TodayTabPanel';
import { MealsTabPanel } from './dashboard/MealsTabPanel';
import { CalendarTabPanel } from './dashboard/CalendarTabPanel';
import { AssignmentsTabPanel } from './dashboard/AssignmentsTabPanel';
import { NoticeboardTabPanel } from './dashboard/NoticeboardTabPanel';
import { TasksTabPanel } from './dashboard/TasksTabPanel';

// FHS-227 — Parent Dashboard shell. Six tabs gated by tenant_features
// (FHS-50 — deferred). Each tab's actual content ships in its own
// sibling ticket (FHS-228..FHS-233); for now every tab renders a
// "Coming soon" placeholder that names the ticket.
//
// Active tab is driven by the `?tab=<id>` URL query param so deep-links
// + browser back-button work. Default = "home" (TabDashboard / FHS-228).

interface TabDef {
  id: string;
  label: string;
  ticket: string;
  description: string;
}

const TABS: TabDef[] = [
  {
    id: 'home',
    label: 'Dashboard',
    ticket: 'FHS-228',
    description: 'Family member grid + today snapshot.',
  },
  {
    id: 'meals',
    label: 'Meals',
    ticket: 'FHS-229',
    description: 'Weekly meal planner.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    ticket: 'FHS-230',
    description: 'Week view with events.',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    ticket: 'FHS-231',
    description: 'Homework list per child.',
  },
  {
    id: 'noticeboard',
    label: 'Noticeboard',
    ticket: 'FHS-232',
    description: 'Pinned family notes.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    ticket: 'FHS-233',
    description: 'Per-parent to-do list.',
  },
];

const DEFAULT_TAB = 'home';

function isKnownTab(id: string | null): id is string {
  return id !== null && TABS.some((t) => t.id === id);
}

export function DashboardPage() {
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);

  const requested = params.get('tab');
  const activeTab = isKnownTab(requested) ? requested : DEFAULT_TAB;

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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('signOut failed', err);
      setSigningOut(false);
      return;
    }
    navigate('/', { replace: true });
  }, [navigate]);

  const navTabs: TopNavTab[] = TABS.map((t) => ({ id: t.id, label: t.label }));
  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      <TopNav
        brand={
          <Link to={`/t/${slug}/dashboard`} className="block">
            Family Hub
          </Link>
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        rightSlot={
          <div className="flex items-center gap-3">
            <span
              className="hidden truncate text-sm font-bold text-white sm:inline-block sm:max-w-[180px]"
              data-testid="dashboard-user-email"
              title={user?.email ?? ''}
            >
              {user?.email ?? '—'}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onLogout}
              disabled={signingOut}
              testId="dashboard-logout"
            >
              {signingOut ? 'Signing out…' : 'Log out'}
            </Button>
          </div>
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
          <Card className="bg-white p-6 text-gray-900 md:p-8">
            {active.id === 'home' ? (
              <TodayTabPanel />
            ) : active.id === 'meals' ? (
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
