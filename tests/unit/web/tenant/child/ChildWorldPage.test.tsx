import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-268 — ChildWorld shell: five tabs (My World active, the rest
// placeholders) + a "Back to family" button.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { ChildWorldPage } from '../../../../../apps/web/src/pages/tenant/child/ChildWorldPage';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function installApi() {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: [{ id: MEMBER, displayName: 'Ali', avatarEmoji: '👦' }] }),
      });
    }
    if (u.includes('/api/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: [], stickerBalance: 0 }),
      });
    }
    if (u.includes('/api/mw/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [] }) });
    }
    if (u.includes('/api/journal')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ entries: [] }) });
    }
    if (u.includes('/api/learn')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects: [] }) });
    }
    // /api/habits
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        habits: [],
        stickers: [],
        week: { id: 'wk1', weekNumber: 9, year: 2026, startDate: '2026-02-23', isFinalized: false },
        balance: 0,
      }),
    });
  });
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <ChildWorldPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page">DASH</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  installApi();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => vi.unstubAllGlobals());

describe('<ChildWorldPage />', () => {
  it('renders the five ChildWorld tabs with My World active', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world')).toBeInTheDocument());
    for (const label of ['My World', 'Meals', 'Calendar', 'Journal', 'Learn']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByTestId('child-panel-world')).toBeInTheDocument();
  });

  it("shows the child's name in the header once members load", async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
  });

  it('switches to the Journal tab', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Journal/ }));
    });
    expect(screen.getByTestId('child-panel-journal')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
  });

  it('Back to family returns to the dashboard', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world-back')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('child-world-back'));
    });
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
  });
});
