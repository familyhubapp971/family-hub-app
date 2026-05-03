import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { VerifyEmailPage } from '../../../../apps/web/src/pages/auth/VerifyEmailPage';

// FHS-223 — confirmation page after signup. Tests cover the four AC
// dimensions: email source priority, Open Gmail link, resend cooldown,
// back-link target.

const signInWithOtp = vi.fn();
vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
    },
  },
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/signup" element={<div data-testid="route-marker">signup</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<VerifyEmailPage />', () => {
  beforeEach(() => {
    sessionStorage.clear();
    signInWithOtp.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('renders the email from the ?email= query param when present', () => {
    sessionStorage.setItem('fh.signup.email', 'sessionstore@example.com');
    renderAt('/verify-email?email=fromquery@example.com');
    expect(screen.getByTestId('verify-email-address').textContent).toBe('fromquery@example.com');
  });

  it('falls back to sessionStorage fh.signup.email when no query param', () => {
    sessionStorage.setItem('fh.signup.email', 'stash@example.com');
    renderAt('/verify-email');
    expect(screen.getByTestId('verify-email-address').textContent).toBe('stash@example.com');
  });

  it('renders generic copy and disables Resend when no email is known', () => {
    renderAt('/verify-email');
    expect(screen.queryByTestId('verify-email-address')).toBeNull();
    // The JSX uses &rsquo; (curly apostrophe) so we match without it.
    expect(screen.getByText(/sent you a magic link/i)).toBeInTheDocument();
    const resend = screen.getByTestId('verify-email-resend') as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
  });

  it('Open Gmail link points at mail.google.com and opens in a new tab', () => {
    sessionStorage.setItem('fh.signup.email', 'sarah@example.com');
    renderAt('/verify-email');
    const link = screen.getByTestId('verify-email-open-gmail') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://mail.google.com/');
    expect(link.getAttribute('target')).toBe('_blank');
    // Security — `target=_blank` without rel=noopener can be exploited.
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('Back link routes to /signup', () => {
    sessionStorage.setItem('fh.signup.email', 'sarah@example.com');
    renderAt('/verify-email');
    fireEvent.click(screen.getByTestId('verify-email-back'));
    expect(screen.getByTestId('route-marker').textContent).toBe('signup');
  });

  it('clicking Resend calls signInWithOtp with the same email and starts the 60s cooldown', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    sessionStorage.setItem('fh.signup.email', 'sarah@example.com');
    renderAt('/verify-email');
    const button = screen.getByTestId('verify-email-resend') as HTMLButtonElement;
    fireEvent.click(button);
    // Resolves on the next microtask; flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'sarah@example.com',
      options: { emailRedirectTo: expect.stringContaining('/auth/callback') },
    });
    // Button now in cooldown — disabled and shows "Resend in 60s".
    expect(button.disabled).toBe(true);
    expect(button.textContent).toMatch(/resend in 60s/i);
  });

  it('cooldown counts down each second and re-enables at zero', async () => {
    vi.useFakeTimers();
    signInWithOtp.mockResolvedValue({ error: null });
    sessionStorage.setItem('fh.signup.email', 'sarah@example.com');
    renderAt('/verify-email');
    const button = screen.getByTestId('verify-email-resend') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(button);
      // Flush the awaited signInWithOtp microtask.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(button.textContent).toMatch(/resend in 60s/i);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(button.textContent).toMatch(/resend in 59s/i);
    // Each tick schedules the NEXT setTimeout from inside the effect's
    // cleanup chain, so React must reconcile between ticks. Walking the
    // remaining 60 seconds one tick at a time gives the effect a chance
    // to re-arm between each timer fire.
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(button.disabled).toBe(false);
    expect(button.textContent).toMatch(/didn't get it\? resend/i);
  });

  it('renders the Supabase error inline when resend fails', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limit hit' } });
    sessionStorage.setItem('fh.signup.email', 'sarah@example.com');
    renderAt('/verify-email');
    fireEvent.click(screen.getByTestId('verify-email-resend'));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByTestId('verify-email-resend-error').textContent).toContain('rate limit hit');
  });
});
