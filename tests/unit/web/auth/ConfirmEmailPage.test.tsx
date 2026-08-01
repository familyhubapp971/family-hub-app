import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfirmEmailPage } from '../../../../apps/web/src/pages/auth/ConfirmEmailPage';

// FHS-510 — the landing page for an admin-initiated sign-in email change.
// Three states: checking (spinner) → done (new email + back button) or
// expired (missing/used/expired link + back button).

const apiFetch = vi.fn();
vi.mock('../../../../apps/web/src/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/confirm-email/:memberId" element={<ConfirmEmailPage />} />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-route" />} />
        <Route path="/" element={<div data-testid="home-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
});

describe('<ConfirmEmailPage />', () => {
  it('shows the checking state with a spinner while the request is in flight', () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    renderAt('/confirm-email/member-1?token=abc123');
    expect(screen.getByText('Checking your link')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-email-spinner')).toBeInTheDocument();
  });

  it('goes straight to expired when the URL has no token', async () => {
    renderAt('/confirm-email/member-1');
    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('posts memberId + token anonymously, then shows the done state on success', async () => {
    apiFetch.mockResolvedValue({
      newEmail: 'yusuf.new@example.com',
      memberName: 'Yusuf',
      tenantSlug: 'khans',
    });
    renderAt('/confirm-email/member-1?token=the-raw-token');

    await waitFor(() => expect(screen.getByText('Email updated')).toBeInTheDocument());
    expect(screen.getByTestId('confirm-email-new-address').textContent).toBe(
      'yusuf.new@example.com',
    );
    expect(screen.getByText(/Yusuf now signs in with/)).toBeInTheDocument();

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/members/email-change/confirm',
      expect.objectContaining({
        method: 'POST',
        anonymous: true,
        body: JSON.stringify({ memberId: 'member-1', token: 'the-raw-token' }),
      }),
    );
  });

  it('"Back to the family" navigates to the tenant dashboard after a successful confirm', async () => {
    apiFetch.mockResolvedValue({
      newEmail: 'yusuf.new@example.com',
      memberName: 'Yusuf',
      tenantSlug: 'khans',
    });
    renderAt('/confirm-email/member-1?token=the-raw-token');
    await waitFor(() => expect(screen.getByTestId('confirm-email-back')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('confirm-email-back'));
    await waitFor(() => expect(screen.getByTestId('dashboard-route')).toBeInTheDocument());
  });

  it('shows the expired state on a 410 / any failure, with no member email leaked', async () => {
    apiFetch.mockRejectedValue(new Error('api /api/members/email-change/confirm → 410'));
    renderAt('/confirm-email/member-1?token=used-token');
    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument());
    expect(
      screen.getByText(/ask an admin to send a new one/i, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-email-new-address')).not.toBeInTheDocument();
  });

  it('"Back to the family" on the expired state falls back to "/" (no tenant known)', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    renderAt('/confirm-email/member-1?token=used-token');
    await waitFor(() => expect(screen.getByTestId('confirm-email-back')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('confirm-email-back'));
    await waitFor(() => expect(screen.getByTestId('home-route')).toBeInTheDocument());
  });
});
