import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignupPage } from '../../../apps/web/src/pages/auth/SignupPage';

// Stub Supabase — we never want a real network call from a unit test.
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

describe('<SignupPage />', () => {
  afterEach(() => {
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    sessionStorage.clear();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
  }

  it('renders both panels — left social proof + right form', () => {
    renderPage();
    expect(screen.getByText(/2,400\+ families/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create your family/i })).toBeInTheDocument();
    expect(screen.getByTestId('signup-family-name')).toBeInTheDocument();
    expect(screen.getByTestId('signup-display-name')).toBeInTheDocument();
    expect(screen.getByTestId('signup-email')).toBeInTheDocument();
    expect(screen.getByTestId('signup-submit')).toBeInTheDocument();
    expect(screen.getByTestId('signup-google')).toBeInTheDocument();
  });

  it('auto-derives the URL slug from the family name as the user types', () => {
    renderPage();
    const familyInput = screen.getByTestId('signup-family-name') as HTMLInputElement;
    fireEvent.change(familyInput, { target: { value: 'The Khan Family!' } });
    const preview = screen.getByTestId('signup-slug-preview');
    expect(preview.textContent).toContain('/t/the-khan-family');
  });

  it('falls back to /t/family when the family name has no usable chars', () => {
    renderPage();
    const familyInput = screen.getByTestId('signup-family-name') as HTMLInputElement;
    fireEvent.change(familyInput, { target: { value: '!!!' } });
    expect(screen.getByTestId('signup-slug-preview').textContent).toContain('/t/family');
  });

  it('rejects invalid email + does not call Supabase', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('signup-family-name'), {
      target: { value: 'The Khan Family' },
    });
    fireEvent.change(screen.getByTestId('signup-display-name'), { target: { value: 'Sarah' } });
    fireEvent.change(screen.getByTestId('signup-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('signup-form'));
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByTestId('signup-error')).toBeInTheDocument();
  });

  it('calls signInWithOtp with the email and stashes the signup intent on submit', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByTestId('signup-family-name'), {
      target: { value: 'The Khan Family' },
    });
    fireEvent.change(screen.getByTestId('signup-display-name'), {
      target: { value: 'Sarah Khan' },
    });
    fireEvent.change(screen.getByTestId('signup-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('signup-form'));
    // Allow microtasks to flush
    await Promise.resolve();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'sarah@example.com',
      options: { emailRedirectTo: expect.stringContaining('/auth/callback') },
    });
    expect(JSON.parse(sessionStorage.getItem('fh.signup.intent') ?? '{}')).toMatchObject({
      familyName: 'The Khan Family',
      displayName: 'Sarah Khan',
      slug: 'the-khan-family',
    });
    expect(sessionStorage.getItem('fh.signup.email')).toBe('sarah@example.com');
  });

  it('Google button kicks off signInWithOAuth with provider=google', () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.click(screen.getByTestId('signup-google'));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });
});
