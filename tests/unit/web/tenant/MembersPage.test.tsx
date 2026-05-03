import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MembersPage } from '../../../../apps/web/src/pages/tenant/MembersPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// FHS-108 — Lists tenant members with role + status badges. Tests
// cover loading / error / empty / populated states + the active vs
// unclaimed status derivation.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'fake-jwt' },
};
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/members"
          element={
            <TenantProvider>
              <MembersPage />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'fake-jwt' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<MembersPage />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/members');
    expect(screen.getByTestId('members-loading')).toBeInTheDocument();
  });

  it('renders the empty state when the tenant has no members', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [] }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-error')).toBeInTheDocument());
  });

  it('renders one row per member with role + status badges', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        members: [
          {
            id: 'm1',
            displayName: 'Sarah Khan',
            role: 'admin',
            avatarEmoji: '👩',
            status: 'active',
            createdAt: '2026-05-02T00:00:00.000Z',
          },
          {
            id: 'm2',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            status: 'unclaimed',
            createdAt: '2026-05-02T00:00:00.000Z',
          },
        ],
      }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());

    // Row 0 — Sarah / admin / active
    expect(screen.getByTestId('members-row-0-name').textContent).toBe('Sarah Khan');
    expect(screen.getByTestId('members-row-0-role').textContent?.toLowerCase()).toContain('admin');
    expect(screen.getByTestId('members-row-0-status').textContent).toBe('Active');

    // Row 1 — Iman / child / unclaimed
    expect(screen.getByTestId('members-row-1-name').textContent).toBe('Iman');
    expect(screen.getByTestId('members-row-1-role').textContent?.toLowerCase()).toContain('child');
    expect(screen.getByTestId('members-row-1-status').textContent).toBe('Unclaimed');
  });

  it('passes the tenant slug + bearer token on the request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [] }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/members');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer fake-jwt',
      'x-tenant-slug': 'khans',
    });
  });
});
