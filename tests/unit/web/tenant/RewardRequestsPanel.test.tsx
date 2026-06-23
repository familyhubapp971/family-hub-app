import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-379 — parent Reward Requests approval screen (restyled). Lists
// pending kid requests in a neo-brutalist card. Admins can approve
// (one click) or decline (two-step confirm). Non-admins see a muted
// "Only an admin can approve" note. Empty state shows "All caught up!".

vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => ({ session: { access_token: 'parent.tok' } }),
}));
vi.mock('../../../../apps/web/src/lib/tenant-context', () => ({
  useTenantSlug: () => 'khan',
}));

import { RewardRequestsPanel } from '../../../../apps/web/src/pages/tenant/RewardRequestsPanel';

const fetchMock = vi.fn();
const ONE_REQUEST = {
  requests: [
    {
      id: 'req1',
      memberId: 'm1',
      memberName: 'Iman',
      rewardId: 'rw1',
      rewardName: 'Ice Cream',
      rewardIcon: '🍦',
      starCost: 10,
      status: 'pending',
      requestedAt: '2026-06-20T00:00:00.000Z',
    },
  ],
};

function routeMock(opts: { admin: boolean; requests?: unknown; approve?: () => unknown }) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/members'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ callerRole: opts.admin ? 'admin' : 'adult' }),
      });
    if (u.includes('/api/mw/redemption-requests/') && init?.method === 'POST')
      return Promise.resolve(
        opts.approve
          ? opts.approve()
          : { ok: true, status: 200, json: async () => ({ id: 'req1', status: 'approved' }) },
      );
    if (u.includes('/api/mw/redemption-requests'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => opts.requests ?? ONE_REQUEST,
      });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<RewardRequestsPanel />', () => {
  it('approve removes the row', async () => {
    routeMock({ admin: true });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());
    // Row renders child name + reward
    expect(screen.getByText(/Iman wants/)).toBeInTheDocument();
    expect(screen.getByText(/Ice Cream/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-request-approve-req1'));
    });
    await waitFor(() =>
      expect(screen.queryByTestId('reward-request-req1')).not.toBeInTheDocument(),
    );
    // After last row removed, empty state shows
    expect(screen.getByText(/All caught up!/)).toBeInTheDocument();
  });

  it('two-step decline: Decline shows Confirm Decline; Confirm calls POST decline; row removed', async () => {
    routeMock({ admin: true });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());

    // Step 1: click Decline → confirm buttons appear, approve disappears
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-request-decline-req1'));
    });
    expect(screen.queryByTestId('reward-request-approve-req1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reward-request-decline-req1')).not.toBeInTheDocument();
    expect(screen.getByTestId('reward-request-confirm-decline-req1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();

    // Step 2: click Confirm Decline → POST is called, row removed
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-request-confirm-decline-req1'));
    });
    await waitFor(() =>
      expect(screen.queryByTestId('reward-request-req1')).not.toBeInTheDocument(),
    );
    // Verify POST to decline endpoint was called
    const declineCall = fetchMock.mock.calls.find(
      ([url, init]: [string, RequestInit]) =>
        String(url).includes('/req1/decline') && init?.method === 'POST',
    );
    expect(declineCall).toBeDefined();
  });

  it('Cancel in decline confirm restores the Approve/Decline buttons', async () => {
    routeMock({ admin: true });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());

    // Enter confirm state
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-request-decline-req1'));
    });
    expect(screen.getByTestId('reward-request-confirm-decline-req1')).toBeInTheDocument();

    // Cancel → back to default buttons
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    });
    expect(screen.getByTestId('reward-request-approve-req1')).toBeInTheDocument();
    expect(screen.getByTestId('reward-request-decline-req1')).toBeInTheDocument();
    expect(screen.queryByTestId('reward-request-confirm-decline-req1')).not.toBeInTheDocument();
  });

  it('non-admin: shows "Only an admin can approve" note, no action buttons', async () => {
    routeMock({ admin: false });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());
    expect(screen.getByTestId('reward-requests-readonly')).toBeInTheDocument();
    expect(screen.queryByTestId('reward-request-approve-req1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reward-request-decline-req1')).not.toBeInTheDocument();
  });

  it('empty state shows "All caught up!" panel', async () => {
    routeMock({ admin: true, requests: { requests: [] } });
    render(<RewardRequestsPanel />);
    // Panel always renders on its dedicated tab (never returns null)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId('reward-requests-panel')).toBeInTheDocument();
    expect(screen.getByText(/All caught up!/)).toBeInTheDocument();
  });

  it('400 from approve shows inline error and keeps the row', async () => {
    routeMock({
      admin: true,
      approve: () => ({
        ok: false,
        status: 400,
        json: async () => ({ errorCode: 'INSUFFICIENT_SAVINGS' }),
      }),
    });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-request-approve-req1'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('reward-request-error-req1')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument();
  });

  it('pending count badge reflects the number of requests', async () => {
    routeMock({ admin: true });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-requests-count')).toBeInTheDocument());
    expect(screen.getByTestId('reward-requests-count').textContent).toContain('1');
  });
});
