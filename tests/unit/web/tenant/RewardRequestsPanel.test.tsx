import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-376 — parent reward-requests inbox: lists pending kid requests; admins can
// approve/decline; non-admins see them read-only. Mocks useAuth/useTenantSlug so
// the panel has a session + slug without Supabase.

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
  it('renders pending requests and approve removes the row', async () => {
    routeMock({ admin: true });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());
    expect(screen.getByText(/Iman wants/)).toHaveTextContent('Ice Cream');
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-request-approve-req1'));
    });
    await waitFor(() =>
      expect(screen.queryByTestId('reward-request-req1')).not.toBeInTheDocument(),
    );
  });

  it('hides approve/decline for non-admins and shows a read-only note', async () => {
    routeMock({ admin: false });
    render(<RewardRequestsPanel />);
    await waitFor(() => expect(screen.getByTestId('reward-request-req1')).toBeInTheDocument());
    expect(screen.getByTestId('reward-requests-readonly')).toBeInTheDocument();
    expect(screen.queryByTestId('reward-request-approve-req1')).not.toBeInTheDocument();
  });

  it('shows a savings error and keeps the row when approval is blocked (400)', async () => {
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

  it('renders nothing when there are no pending requests', async () => {
    routeMock({ admin: true, requests: { requests: [] } });
    const { container } = render(<RewardRequestsPanel />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('reward-requests-panel')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
