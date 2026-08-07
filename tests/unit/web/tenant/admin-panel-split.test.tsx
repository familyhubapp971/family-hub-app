import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { KidsMoneyPage } from '../../../../apps/web/src/pages/tenant/KidsMoneyPage';
import { FamilySettingsPage } from '../../../../apps/web/src/pages/tenant/FamilySettingsPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// FHS-621: the Admin Panel is split into pages named after the job they do.
// Each page shows its own half and nothing else, so a parent never lands on a
// tab they have to guess at.

vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => ({
    session: { access_token: 'tok' },
    user: { id: 'u1', email: 'a@b.c' },
    loading: false,
  }),
  signOutAll: vi.fn(),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole: 'admin',
          members: [{ id: 'kid1', displayName: 'Amina', role: 'child', isChild: true }],
        }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
});

function renderPage(page: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:slug/*" element={<TenantProvider>{page}</TenantProvider>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('the Admin Panel split (FHS-621)', () => {
  it('Kids money shows the money tabs and never the settings one', async () => {
    renderPage(<KidsMoneyPage />, '/t/khan/money');
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-balance')).toBeInTheDocument());
    expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument();
    expect(screen.getByTestId('admin-panel-tab-history')).toBeInTheDocument();
    expect(screen.getByTestId('admin-panel-tab-rewards')).toBeInTheDocument();
    // The rare and dangerous things live behind their own door now.
    expect(screen.queryByTestId('admin-panel-tab-settings')).not.toBeInTheDocument();
  });

  it('Family settings shows only its own half, with no tabs to choose between', async () => {
    renderPage(<FamilySettingsPage />, '/t/khan/family-settings');
    await waitFor(() => expect(screen.queryByTestId('admin-panel-tab-balance')).toBeNull());
    // One job, so there is nothing to tab between.
    expect(screen.queryByTestId('admin-panel-tab-settings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-panel-tab-rewards')).not.toBeInTheDocument();
  });
});
