import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '../../../apps/web/src/pages/auth/LoginPage';

// FHS-224 — passwordless login. Tests cover the rewritten UX:
// magic-link via signInWithOtp, Google via signInWithOAuth, no
// password field, redirect to /verify-email after magic-link send.

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock('../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<div data-testid="route-marker">verify-email</div>} />
        <Route path="/signup" element={<div data-testid="route-marker">signup</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<LoginPage />', () => {
  afterEach(() => {
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    sessionStorage.clear();
  });

  it('renders the magic-link form (no password field) and the Google button', () => {
    renderPage();
    expect(screen.getByTestId('login-email')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
    // Confirm the legacy password field is gone.
    expect(screen.queryByTestId('login-password')).toBeNull();
  });

  it('rejects an invalid email + does not call Supabase', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
  });

  it('calls signInWithOtp + redirects to /verify-email on submit with a valid email', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('verify-email'),
    );
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'sarah@example.com',
      options: {
        emailRedirectTo: expect.stringContaining('/auth/callback'),
        // /login must NOT silently create accounts — keeps signup/login
        // semantically distinct (AC1).
        shouldCreateUser: false,
      },
    });
    // Email is stashed for /verify-email to render "Check your inbox at <email>".
    expect(sessionStorage.getItem('fh.signup.email')).toBe('sarah@example.com');
  });

  it('renders the Supabase error inline when signInWithOtp fails', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limit' } });
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByTestId('login-error').textContent).toContain('rate limit');
    expect(screen.queryByTestId('route-marker')).toBeNull();
  });

  it('Google button kicks off signInWithOAuth with provider=google', () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.click(screen.getByTestId('login-google'));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });

  it('"Create an account" link routes to /signup', () => {
    renderPage();
    fireEvent.click(screen.getByRole('link', { name: /create an account/i }));
    expect(screen.getByTestId('route-marker').textContent).toBe('signup');
  });
});
