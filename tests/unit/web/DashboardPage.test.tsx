import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// FHS-227 — Parent Dashboard shell. The actual tab CONTENT lives in
// sibling tickets (FHS-228..FHS-233); this suite covers framework
// invariants only: 6 tabs render, default = home, ?tab= drives the
// active panel, clicking a tab updates the URL + content, sign-out
// wires through.

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: mocks.signOut,
    },
  },
}));

const authState: { user: { email?: string; id?: string } | null } = {
  user: { email: 'sarah@example.com', id: 'u-1' },
};
vi.mock('../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { DashboardPage } from '../../../apps/web/src/pages/DashboardPage';
import { TenantProvider } from '../../../apps/web/src/lib/tenant-context';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location-search">{loc.search}</span>;
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <DashboardPage />
              <LocationProbe />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.signOut.mockReset();
  mocks.signOut.mockResolvedValue({});
  authState.user = { email: 'sarah@example.com', id: 'u-1' };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<DashboardPage /> — tab framework', () => {
  it('renders all six tabs in the nav', () => {
    renderAt('/t/khans/dashboard');
    for (const label of ['Dashboard', 'Meals', 'Calendar', 'Assignments', 'Noticeboard', 'Tasks']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('defaults to the home (Dashboard) panel when ?tab is absent', () => {
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-panel-title').textContent).toBe('Dashboard');
  });

  it('honours ?tab=meals on initial render', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    expect(screen.getByTestId('dashboard-panel-meals')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-panel-title').textContent).toBe('Meals');
  });

  it('falls back to the default panel when ?tab is unknown', () => {
    renderAt('/t/khans/dashboard?tab=does-not-exist');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
  });

  it('clicking a tab updates the active panel content + URL ?tab param', () => {
    renderAt('/t/khans/dashboard');
    const calendarTab = screen.getByRole('tab', { name: 'Calendar' });
    act(() => {
      fireEvent.click(calendarTab);
    });
    expect(screen.getByTestId('dashboard-panel-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-panel-title').textContent).toBe('Calendar');
    expect(screen.queryByTestId('dashboard-panel-home')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=calendar');
  });

  it('clicking back to Dashboard removes the ?tab param entirely', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=meals');
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Dashboard' }));
    });
    expect(screen.getByTestId('location-search').textContent).toBe('');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true and others false', () => {
    renderAt('/t/khans/dashboard?tab=tasks');
    const tasks = screen.getByRole('tab', { name: 'Tasks' });
    const meals = screen.getByRole('tab', { name: 'Meals' });
    expect(tasks.getAttribute('aria-selected')).toBe('true');
    expect(meals.getAttribute('aria-selected')).toBe('false');
  });

  it('renders the signed-in user email in the right slot', () => {
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-user-email').textContent).toBe('sarah@example.com');
  });

  it('renders an em-dash when the auth context has no email', () => {
    authState.user = { email: undefined, id: 'u-1' };
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-user-email').textContent).toBe('—');
  });

  it('clicking Log out calls supabase.auth.signOut()', async () => {
    renderAt('/t/khans/dashboard');
    const btn = screen.getByTestId('dashboard-logout');
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
