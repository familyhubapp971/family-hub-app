// FHS-575: a dead sign-in link used to land on the loading screen's stalled
// state, saying "This is taking longer than usual." with a progress bar still
// creeping along while nothing was loading. It has its own screen now.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LinkExpired, reasonFromError } from '../../../../apps/web/src/pages/auth/LinkExpired';

const signInWithOtp = vi.fn();
vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } },
}));

function renderScreen(props: Parameters<typeof LinkExpired>[0] = {}) {
  return render(
    <MemoryRouter>
      <LinkExpired {...props} />
    </MemoryRouter>,
  );
}

describe('reasonFromError', () => {
  it.each([
    ['That sign-in link has expired or already been used.', 'used'],
    ['Email link is invalid or has expired', 'invalid'],
    ['something else entirely', 'expired'],
    [undefined, 'expired'],
  ])('maps %s to %s', (message, expected) => {
    expect(reasonFromError(message)).toBe(expected);
  });
});

describe('LinkExpired', () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    sessionStorage.clear();
  });

  // The whole point of the ticket.
  it('never says the app is still loading', () => {
    renderScreen({ reason: 'expired' });
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/expired/i);
    expect(document.body.textContent).not.toMatch(/taking longer than usual/i);
    expect(screen.queryByTestId('loading-progress')).not.toBeInTheDocument();
  });

  it('words each case differently', () => {
    const { unmount } = renderScreen({ reason: 'used' });
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/already been used/i);
    unmount();

    renderScreen({ reason: 'invalid' });
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/didn't come through/i);
  });

  // Design revision: when we know the address we state it rather than
  // asking someone to retype what we can already see.
  it('states the address we know instead of asking for it again', () => {
    renderScreen({ email: 'sarah@khan.family' });
    expect(screen.getByTestId('link-expired-known-address').textContent).toContain(
      'sarah@khan.family',
    );
    expect(screen.queryByTestId('link-expired-email')).not.toBeInTheDocument();
  });

  it('asks for the address when we do not have one', () => {
    renderScreen();
    expect(screen.getByTestId('link-expired-email')).toHaveValue('');
    expect(screen.queryByTestId('link-expired-known-address')).not.toBeInTheDocument();
  });

  it('lets someone switch to a different address', () => {
    renderScreen({ email: 'wrong@khan.family' });
    fireEvent.click(screen.getByTestId('link-expired-different-email'));
    expect(screen.getByTestId('link-expired-email')).toBeInTheDocument();
  });

  it('sends a new link and confirms it', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderScreen({ email: 'sarah@khan.family' });

    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    await waitFor(() => expect(screen.getByTestId('link-expired-sent')).toBeInTheDocument());
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sarah@khan.family' }),
    );
    expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    // So /verify-email and a later retry know who we are.
    expect(sessionStorage.getItem('fh.signup.email')).toBe('sarah@khan.family');
  });

  it('rejects a bad address without calling Supabase', async () => {
    renderScreen({ email: 'not-an-email' });

    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/valid email/i));
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('surfaces a send failure in friendly words', async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 30 seconds.' },
    });
    renderScreen({ email: 'sarah@khan.family' });

    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/wait 30 seconds/i));
  });

  it('offers a way back to sign in', () => {
    renderScreen();
    expect(screen.getByTestId('link-expired-back')).toHaveAttribute('href', '/login');
  });

  it('keeps its controls above the tap floor', () => {
    renderScreen();
    expect(screen.getByTestId('link-expired-email').className).toContain('min-h-[48px]');
    expect(screen.getByTestId('link-expired-send').className).toContain('min-h-[48px]');
    expect(screen.getByTestId('link-expired-back').className).toContain('min-h-[44px]');
  });
});
