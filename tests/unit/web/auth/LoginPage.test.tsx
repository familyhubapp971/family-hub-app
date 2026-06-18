import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import { LoginPage } from '../../../../apps/web/src/pages/auth/LoginPage';

// FHS-224 — passwordless login. Tests cover the rewritten UX:
// magic-link via signInWithOtp, Google via signInWithOAuth, no
// password field, redirect to /verify-email after magic-link send.

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}));

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location-search">{loc.search}</span>;
}

// FHS-353 — marks the kid picker route so we can assert the kid panel
// navigates to /t/<slug>/kid-login with the typed family code.
function KidLoginMarker() {
  const { slug } = useParams<{ slug: string }>();
  return <div data-testid="route-kid-login">kid-login:{slug}</div>;
}

function renderPage(initial = '/login') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <LoginPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/verify-email" element={<div data-testid="route-marker">verify-email</div>} />
        <Route path="/signup" element={<div data-testid="route-marker">signup</div>} />
        <Route path="/t/:slug/kid-login" element={<KidLoginMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<LoginPage />', () => {
  afterEach(() => {
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders the magic-link form (no password field) and the Google button', () => {
    renderPage();
    expect(screen.getByTestId('login-email')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
    // Confirm the legacy password field is gone.
    expect(screen.queryByTestId('login-password')).toBeNull();
  });

  // FHS-258 — error from a failed submit must clear the moment the
  // user starts typing again.
  it('clears the inline error when the user types into email after a failed submit', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    expect(screen.queryByTestId('login-error')).toBeNull();
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

  it('rewrites the email rate-limit error to a friendly next-step message', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'email rate limit exceeded' } });
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));
    await Promise.resolve();
    await Promise.resolve();
    const text = screen.getByTestId('login-error').textContent ?? '';
    expect(text).toMatch(/too many sign-in links/i);
    expect(text).toMatch(/google/i);
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

  // FHS-237 — parent / kid toggle.
  it('defaults to the parent panel + role-toggle has aria-pressed=true on parent', () => {
    renderPage();
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('login-kid-panel')).toBeNull();
    expect(screen.getByTestId('login-role-parent').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('login-role-kid').getAttribute('aria-pressed')).toBe('false');
    // Default URL has no ?role= param — kid is the only state we encode
    // so a returning parent doesn't see ugly query strings on /login.
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  it('honours ?role=kid on initial render', () => {
    renderPage('/login?role=kid');
    expect(screen.getByTestId('login-kid-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('login-parent-panel')).toBeNull();
    // FHS-353 — the kid panel now offers a self-serve family-code entry.
    expect(screen.getByTestId('login-kid-code')).toBeInTheDocument();
  });

  // FHS-353 — self-serve kid login.
  it('entering a family code sends the kid to that family picker', async () => {
    renderPage('/login?role=kid');
    fireEvent.change(screen.getByTestId('login-kid-code'), { target: { value: 'Smiths' } });
    fireEvent.submit(screen.getByTestId('login-kid-form'));
    // Slug is normalised to lowercase before navigating.
    await waitFor(() =>
      expect(screen.getByTestId('route-kid-login').textContent).toBe('kid-login:smiths'),
    );
  });

  it('shows a friendly error for an invalid family code and does not navigate', () => {
    renderPage('/login?role=kid');
    fireEvent.change(screen.getByTestId('login-kid-code'), { target: { value: 'bad code!!' } });
    fireEvent.submit(screen.getByTestId('login-kid-form'));
    expect(screen.getByTestId('login-kid-error')).toBeInTheDocument();
    expect(screen.queryByTestId('route-kid-login')).toBeNull();
  });

  it('offers a one-tap "Continue as <family>" shortcut for a remembered family', async () => {
    localStorage.setItem(
      'fh.kid.lastFamily',
      JSON.stringify({ slug: 'smiths', name: 'The Smiths' }),
    );
    renderPage('/login?role=kid');
    const shortcut = screen.getByTestId('login-kid-continue-last');
    expect(shortcut.textContent).toContain('The Smiths');
    fireEvent.click(shortcut);
    await waitFor(() =>
      expect(screen.getByTestId('route-kid-login').textContent).toBe('kid-login:smiths'),
    );
  });

  it('clicking the kid tab swaps the panel + sets ?role=kid in the URL', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('login-role-kid'));
    expect(screen.getByTestId('login-kid-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('login-parent-panel')).toBeNull();
    expect(screen.getByTestId('location-search').textContent).toBe('?role=kid');
    expect(screen.getByTestId('login-role-kid').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('login-role-parent').getAttribute('aria-pressed')).toBe('false');
  });

  it('toggling back to parent clears ?role= from the URL', () => {
    renderPage('/login?role=kid');
    fireEvent.click(screen.getByTestId('login-role-parent'));
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  it('the kid panel "Switch to parent log-in" link returns to the parent panel + clears the URL', () => {
    renderPage('/login?role=kid');
    fireEvent.click(screen.getByTestId('login-kid-back-to-parent'));
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('login-kid-panel')).toBeNull();
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  it('falls back to the parent panel when ?role is unknown', () => {
    renderPage('/login?role=banana');
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
  });

  // I4 (qa-expert): a stale "enter a valid email" error from the parent
  // form mustn't reappear after the user toggles to kid and back —
  // they cleared their input by switching tabs, the warning would read
  // as a glitch.
  it('clears any inline parent-form error when the user toggles role', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('login-role-kid'));
    fireEvent.click(screen.getByTestId('login-role-parent'));
    expect(screen.queryByTestId('login-error')).toBeNull();
  });
});
