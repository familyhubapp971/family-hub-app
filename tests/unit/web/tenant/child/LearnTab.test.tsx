import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-270 — ChildWorld Learn tab (subject cards + progress bars).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { LearnTab } from '../../../../../apps/web/src/pages/tenant/child/LearnTab';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function installApi(subjects: Array<{ subject: string; progress: number }>) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ subjects }) });
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <LearnTab memberId={CHILD} />
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
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => vi.unstubAllGlobals());

describe('<LearnTab />', () => {
  it('renders a card + progress bar per subject', async () => {
    installApi([
      { subject: 'Maths', progress: 40 },
      { subject: 'Reading', progress: 0 },
    ]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-tab')).toBeInTheDocument());
    expect(screen.getByTestId('learn-card-Maths')).toBeInTheDocument();
    expect(screen.getByTestId('learn-card-Reading')).toBeInTheDocument();
    const bar = screen.getByTestId('learn-progress-Maths');
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
  });

  it('clamps an out-of-range progress value', async () => {
    installApi([{ subject: 'Maths', progress: 250 }]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-card-Maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-progress-Maths').getAttribute('aria-valuenow')).toBe('100');
  });

  it('renders an error state on a failed load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-error')).toBeInTheDocument());
  });

  it('is read-only — no buttons or inputs', async () => {
    installApi([{ subject: 'Maths', progress: 40 }]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-tab')).toBeInTheDocument());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
