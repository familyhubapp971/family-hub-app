import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-257 — kid dashboard shell. Renders for a child signed in with a
// kid JWT: kid TopNav (no parent profile pill / admin links), three kid
// tabs, and a Switch user button that drops the token + returns to
// kid-login.

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

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('<KidDashboardShell />', () => {
  it('renders the kid shell with three kid tabs and a Switch user button', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.getByTestId('kid-switch-user')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Today/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tasks/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Notices/ })).toBeInTheDocument();
  });

  it('shows none of the parent profile / admin affordances', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-profile-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Members/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Calendar/ })).not.toBeInTheDocument();
  });

  it('confirms the kid session against GET /api/kid/me', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/kid/me');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringContaining('Bearer '),
    });
  });

  it('switches the active tab', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-panel-today')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Tasks/ }));
    });
    expect(screen.getByTestId('kid-panel-tasks')).toBeInTheDocument();
  });

  // FHS-355 — the Notices tab shows the kid's real family notices.
  it('Notices tab renders notices from GET /api/kid/notices', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/kid/notices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
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
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Notices/ }));
    });
    await waitFor(() => expect(screen.getByTestId('kid-notices-list')).toBeInTheDocument());
    expect(screen.getByText('Tidy your room')).toBeInTheDocument();
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
    // No token set.
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
    // URL slug is "khan"; the confirmed session is for "other".
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
    // Did not falsely announce an active session on the offline path.
    expect(screen.getByTestId('kid-session-confirmed').textContent).toBe('');
  });
});
