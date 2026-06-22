import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-257 / FHS-362 — kid dashboard shell. Renders for a child signed in
// with a kid JWT: the MP header (avatar + name + banked stars/cash), the
// five-tab kid world (My World, Meals, Calendar, Journal, Learn — no parent
// profile pill / admin links), and a Switch user button that drops the token
// + returns to kid-login. My World carries the kid's habits, tasks, notices.

import { KidDashboardShell } from '../../../../apps/web/src/pages/tenant/KidDashboardShell';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';
import { KID_TOKEN_STORAGE_KEY } from '../../../../apps/web/src/lib/auth-context';

const fetchMock = vi.fn();

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fakeKidJwt(expSecondsFromNow = 3600): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    scope: 'child',
  });
  return `${header}.${payload}.sig`;
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/dashboard']}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <KidDashboardShell />
            </TenantProvider>
          }
        />
        <Route
          path="/t/:slug/kid-login"
          element={<div data-testid="kid-login-page">KID LOGIN</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

// The shell makes two boot calls: GET /api/kid/me (session confirm) and
// GET /api/kid/profile (header). This default routes both; the My World
// data feeds (today/tasks/notices) fall through to empty.
function mockKidBoot(over?: (url: string) => unknown) {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    const custom = over?.(u);
    if (custom !== undefined) {
      return Promise.resolve({ ok: true, status: 200, json: async () => custom });
    }
    if (u.includes('/api/kid/profile')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          displayName: 'Amina',
          avatarEmoji: '🦊',
          savedStickers: 12,
          savedCash: 6,
          currency: 'AED',
        }),
      });
    }
    if (u.includes('/api/kid/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [] }) });
    }
    if (u.includes('/api/kid/habits')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          habits: [],
          stickers: [],
          week: {
            id: 'w1',
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-15',
            isFinalized: false,
          },
          balance: 0,
          currency: 'AED',
        }),
      });
    }
    // /api/kid/me + any unrouted feed.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
    });
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  mockKidBoot();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('<KidDashboardShell />', () => {
  it('renders the five kid tabs and a Switch user button', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.getByTestId('kid-switch-user')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /My World/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Meals/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Journal/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Learn/ })).toBeInTheDocument();
  });

  it('shows the kid name + banked stars/cash from GET /api/kid/profile', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-title')).toHaveTextContent(/Amina/));
    expect(screen.getByTestId('kid-stars')).toHaveTextContent('12');
    expect(screen.getByTestId('kid-cash')).toHaveTextContent('AED 6.00');
  });

  it('falls back to the generic header when GET /api/kid/profile fails (404)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/kid/profile')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
      });
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    // No crash; the header shows the generic brand and no balance chips.
    expect(screen.getByTestId('kid-title')).toHaveTextContent('My Hub');
    expect(screen.queryByTestId('kid-balance')).not.toBeInTheDocument();
  });

  it('shows none of the parent profile / admin affordances', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-profile-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Members/ })).not.toBeInTheDocument();
  });

  it('confirms the kid session against GET /api/kid/me', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/kid/me'))).toBe(true),
    );
    const meCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/kid/me'))!;
    expect((meCall[1] as RequestInit).headers).toMatchObject({
      Authorization: expect.stringContaining('Bearer '),
    });
  });

  it('switches the active tab to a coming-soon tab', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-panel-world')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Meals/ }));
    });
    expect(screen.getByTestId('kid-panel-meals')).toBeInTheDocument();
    expect(screen.getByTestId('kid-coming-soon')).toBeInTheDocument();
  });

  // FHS-355 / FHS-362 — the My World tab shows the kid's family notices.
  it('My World shows notices from GET /api/kid/notices', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    mockKidBoot((u) =>
      u.includes('/api/kid/notices')
        ? {
            notices: [
              {
                id: 'n1',
                body: 'Tidy your room',
                pinned: false,
                authorName: 'Mum',
                icon: '📣',
                createdAt: '2026-06-18T00:00:00.000Z',
              },
            ],
          }
        : undefined,
    );
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-notices-list')).toBeInTheDocument());
    expect(screen.getByText('Tidy your room')).toBeInTheDocument();
  });

  // FHS-355 / FHS-362 — My World lists the kid's tasks; ticking PATCHes.
  it('My World lists the kid tasks and ticking one PATCHes /api/kid/tasks/:id', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    const patchCalls: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/tasks/')) {
        patchCalls.push(u);
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      if (u.includes('/api/kid/tasks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            tasks: [{ id: 't1', title: 'Brush teeth', dueDate: null, done: false }],
          }),
        });
      }
      if (u.includes('/api/kid/profile')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            displayName: 'Amina',
            avatarEmoji: '🦊',
            savedStickers: 0,
            savedCash: 0,
            currency: 'AED',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
      });
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-tasks-list')).toBeInTheDocument());
    expect(screen.getByText('Brush teeth')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-task-check'));
    });
    await waitFor(() => expect(patchCalls.length).toBe(1));
    expect(patchCalls[0]).toContain('/api/kid/tasks/t1');
  });

  // FHS-363 — My World shows the kid's interactive habits (GET /api/kid/habits).
  it('My World shows the kid habits from GET /api/kid/habits', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    mockKidBoot((u) =>
      u.includes('/api/kid/habits')
        ? {
            habits: [
              {
                id: 'h1',
                name: 'Read a book',
                description: null,
                color: '#facc15',
                icon: '📚',
                isBonus: false,
              },
            ],
            stickers: [],
            week: {
              id: 'w1',
              weekNumber: 24,
              year: 2026,
              startDate: '2026-06-15',
              isFinalized: false,
            },
            balance: 0,
            currency: 'AED',
          }
        : undefined,
    );
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-habits')).toBeInTheDocument());
    expect(screen.getByText('Read a book')).toBeInTheDocument();
  });

  it('Switch user clears the kid token and returns to kid-login', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-switch-user')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-switch-user'));
    });
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
  });

  it('bounces to kid-login when there is no kid token', async () => {
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
  });

  it('ejects to kid-login when /api/kid/me returns 401 (revoked token)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('ejects when the token is for a different tenant than the URL', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'other' }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('keeps the shell up when /api/kid/me fails with a network error', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockRejectedValue(new Error('offline'));
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByTestId('kid-login-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('kid-session-confirmed').textContent).toBe('');
  });
});
