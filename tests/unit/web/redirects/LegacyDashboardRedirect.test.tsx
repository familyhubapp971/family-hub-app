import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-227 — bridge from un-prefixed `/dashboard` to the tenant-scoped
// `/t/<slug>/dashboard`. Covers happy path (first tenant wins),
// no-tenant fallback to `/`, and fetch failure → `/`.

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));
vi.stubGlobal('fetch', mocks.fetchMock);

const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-1' },
};
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { LegacyDashboardRedirect } from '../../../../apps/web/src/pages/redirects/LegacyDashboardRedirect';

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<LegacyDashboardRedirect />} />
        <Route path="/t/:slug/dashboard" element={<div data-testid="tenant-dashboard" />} />
        <Route path="/" element={<div data-testid="welcome" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.fetchMock.mockReset();
  authState.session = { access_token: 'tok-1' };
});

describe('<LegacyDashboardRedirect />', () => {
  it('forwards to the first tenants[].slug from /api/me', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'khans' }, { slug: 'second' }] }),
    });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('tenant-dashboard')).toBeInTheDocument());
  });

  it('falls back to / when /api/me returns no tenants', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [] }),
    });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('welcome')).toBeInTheDocument());
  });

  it('falls back to / when /api/me returns non-2xx', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('welcome')).toBeInTheDocument());
  });

  it('falls back to / when fetch rejects', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new Error('network down'));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('welcome')).toBeInTheDocument());
  });
});
