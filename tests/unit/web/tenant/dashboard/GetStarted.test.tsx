import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-511 — first-run "Getting started" guide card.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { GetStarted } from '../../../../../apps/web/src/pages/tenant/dashboard/GetStarted';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const SLUG = 'khan';
const KID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY = `fh.getStarted.${SLUG}`;

function installApi(
  members: Array<{ id: string; role: string; displayName: string }>,
  callerMemberId: string = CALLER,
) {
  fetchMock.mockImplementation((url: string) => {
    if (String(url).includes('/api/dashboard/today')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members, callerMemberId }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={[`/t/${SLUG}/dashboard`]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <GetStarted />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/members" element={<div data-testid="members-route" />} />
        <Route path="/t/:slug/reward-settings" element={<div data-testid="reward-route" />} />
        <Route path="/t/:slug/child/:memberId" element={<div data-testid="child-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  installApi([
    { id: CALLER, role: 'admin', displayName: 'Nadia' },
    { id: KID, role: 'child', displayName: 'Ali' },
  ]);
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('<GetStarted /> (FHS-511)', () => {
  it('a new family sees the guide with 0 of 4 done and the first step as the CTA', async () => {
    renderAt();
    expect(await screen.findByTestId('get-started')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-count').textContent).toContain('0 of 4 done');
    expect(screen.getByTestId('get-started-cta-kids')).toHaveTextContent('Add a child');
    // Every step still open, none marked done.
    expect(screen.queryByTestId('get-started-done-kids')).not.toBeInTheDocument();
  });

  it("tapping a step's CTA navigates there and marks the step done (persisted)", async () => {
    renderAt();
    await screen.findByTestId('get-started');
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-cta-kids'));
    });
    // Navigated to Manage Members.
    await waitFor(() => expect(screen.getByTestId('members-route')).toBeInTheDocument());
    // Persisted the completed step.
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    expect(stored.completed).toContain('kids');
  });

  it('shows progress and the next highlighted step from persisted state', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ dismissed: false, completed: ['kids'] }));
    renderAt();
    expect(await screen.findByTestId('get-started')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-count').textContent).toContain('1 of 4 done');
    // First step now shows Done; the next step (PIN) carries the CTA.
    expect(screen.getByTestId('get-started-done-kids')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-cta-pins')).toHaveTextContent('Set PINs');
  });

  it('"Open their world" deep-links to the first child once members load', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ dismissed: false, completed: ['kids', 'pins', 'rate'] }),
    );
    renderAt();
    await screen.findByTestId('get-started');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {}); // flush the members fetch → firstKidId
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-cta-habits'));
    });
    await waitFor(() => expect(screen.getByTestId('child-route')).toBeInTheDocument());
  });

  it('celebrates when all four are done and "Got it" clears it for good', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ dismissed: false, completed: ['kids', 'pins', 'rate', 'habits'] }),
    );
    renderAt();
    expect(await screen.findByTestId('get-started-celebrate')).toHaveTextContent(
      'You are all set up',
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-got-it'));
    });
    expect(screen.queryByTestId('get-started-celebrate')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').dismissed).toBe(true);
  });

  it('a returning family that dismissed the guide never sees it', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ dismissed: true, completed: [] }));
    renderAt();
    // Give any async a tick; the card must not appear.
    await act(async () => {});
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
    expect(screen.queryByTestId('get-started-celebrate')).not.toBeInTheDocument();
  });

  it('the × dismiss hides the guide and persists the dismissal', async () => {
    renderAt();
    await screen.findByTestId('get-started');
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-dismiss'));
    });
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').dismissed).toBe(true);
  });

  it('does not show the guide to a non-admin caller (setup is admin-only)', async () => {
    installApi([
      { id: CALLER, role: 'adult', displayName: 'Nadia' },
      { id: KID, role: 'child', displayName: 'Ali' },
    ]);
    renderAt();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
  });

  it('recovers from corrupted localStorage and shows a fresh guide', async () => {
    window.localStorage.setItem(KEY, 'not json {{{');
    renderAt();
    expect(await screen.findByTestId('get-started')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-count').textContent).toContain('0 of 4 done');
  });
});
