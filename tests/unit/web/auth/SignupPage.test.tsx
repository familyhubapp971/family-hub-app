import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignupPage } from '../../../../apps/web/src/pages/auth/SignupPage';

// Stub Supabase — we never want a real network call from a unit test.
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

  // FHS-225 — live debounced slug-availability check.
  describe('live slug-availability check (FHS-225)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    function typeFamily(value: string) {
      fireEvent.change(screen.getByTestId('signup-family-name'), {
        target: { value },
      });
    }

    function ok(body: { available: boolean; suggestions?: string[] }) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ suggestions: [], ...body }),
      } as Response);
    }

    // After a fake-timer-driven debounce fires, the fetch handler still
    // has to resolve two nested promises (the Response, then `.json()`).
    // `act(advanceTimersByTime + flush)` walks past both so the next
    // assertion sees the post-resolve render.
    async function advanceAndFlush(ms: number) {
      await act(async () => {
        vi.advanceTimersByTime(ms);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    it('shows the spinner while debounce is in flight, then a check on available', async () => {
      fetchMock.mockReturnValue(ok({ available: true }));
      renderPage();
      typeFamily('The Khan Family');
      // Spinner appears synchronously once typing starts (slug is long
      // enough and not the placeholder "family").
      expect(screen.getByTestId('signup-slug-checking')).toBeInTheDocument();
      // Server hasn't been hit yet — debounce hasn't fired.
      expect(fetchMock).not.toHaveBeenCalled();
      await advanceAndFlush(300);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/public/slug-available?slug=the-khan-family',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(screen.getByTestId('signup-slug-available')).toBeInTheDocument();
    });

    it('renders suggestions when slug is taken and disables the submit button', async () => {
      fetchMock.mockReturnValue(
        ok({ available: false, suggestions: ['the-khan-family-2', 'khan-fam'] }),
      );
      renderPage();
      typeFamily('The Khan Family');
      await advanceAndFlush(300);
      expect(screen.getByTestId('signup-slug-taken')).toBeInTheDocument();
      const suggestions = screen.getByTestId('signup-slug-suggestions');
      expect(suggestions).toHaveTextContent('the-khan-family-2');
      expect(suggestions).toHaveTextContent('khan-fam');
      const submit = screen.getByTestId('signup-submit') as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
      expect(submit.textContent).toMatch(/pick a different url/i);
    });

    it('clicking a suggestion overrides the slug without changing the family name', async () => {
      fetchMock.mockReturnValueOnce(ok({ available: false, suggestions: ['the-khan-family-2'] }));
      renderPage();
      typeFamily('The Khan Family');
      await advanceAndFlush(300);
      expect(screen.getByTestId('signup-slug-suggestions')).toBeInTheDocument();
      // Next call (for the overridden slug) returns available so the
      // submit button re-enables.
      fetchMock.mockReturnValueOnce(ok({ available: true }));
      fireEvent.click(screen.getByText('the-khan-family-2'));
      // Family name input is untouched; only the URL preview changes.
      expect((screen.getByTestId('signup-family-name') as HTMLInputElement).value).toBe(
        'The Khan Family',
      );
      expect(screen.getByTestId('signup-slug-preview').textContent).toContain(
        '/t/the-khan-family-2',
      );
      await advanceAndFlush(300);
      expect(screen.getByTestId('signup-slug-available')).toBeInTheDocument();
    });

    it('Change link reveals an editable slug input that sanitises bad chars', async () => {
      fetchMock.mockReturnValue(ok({ available: true }));
      renderPage();
      typeFamily('The Khan Family');
      await advanceAndFlush(300);
      fireEvent.click(screen.getByTestId('signup-slug-change'));
      const slugInput = screen.getByTestId('signup-slug-input') as HTMLInputElement;
      // User pastes a slug with spaces + uppercase + symbols — deriveSlug
      // sanitises it before it lands in state.
      fireEvent.change(slugInput, { target: { value: 'My Custom!! Slug' } });
      expect(slugInput.value).toBe('my-custom-slug');
      // "Use auto" reverts the override and re-derives from family name.
      fireEvent.click(screen.getByTestId('signup-slug-use-auto'));
      expect(screen.getByTestId('signup-slug-preview').textContent).toContain('/t/the-khan-family');
    });

    it('disables submit while the check is in flight', async () => {
      // Never resolve — keeps the spinner up indefinitely.
      fetchMock.mockReturnValue(new Promise(() => {}));
      renderPage();
      typeFamily('The Khan Family');
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      const submit = screen.getByTestId('signup-submit') as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
      expect(submit.textContent).toMatch(/checking url/i);
    });

    it('keeps submit disabled in the idle state (no slug entered yet)', () => {
      renderPage();
      // No typing — slug derives to the placeholder "family", which the
      // effect treats as idle (no check, no UI indicator). Submit must
      // stay disabled until the user types a real family name AND the
      // server confirms the slug is available.
      const submit = screen.getByTestId('signup-submit') as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
    });

    it('ignores stale fetch responses that resolve after a newer keystroke', async () => {
      // Two pending promises whose resolution order we control. First
      // call (for "the-khan-family") resolves SECOND with `taken` —
      // stale. Second call (for "the-khan-fa") resolves FIRST with
      // `available`. Without the `ignored` guard in the effect cleanup,
      // the late stale response would clobber the live status and the
      // UI would flip to the wrong indicator.
      let resolveFirst: (r: Response) => void = () => {};
      let resolveSecond: (r: Response) => void = () => {};
      fetchMock
        .mockReturnValueOnce(new Promise<Response>((r) => (resolveFirst = r)))
        .mockReturnValueOnce(new Promise<Response>((r) => (resolveSecond = r)));

      renderPage();
      typeFamily('The Khan Family');
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      // Now type something different — second debounce fires.
      typeFamily('The Khan Fa');
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Resolve in reversed order: live one first, stale one second.
      await act(async () => {
        resolveSecond({
          ok: true,
          json: async () => ({ available: true, suggestions: [] }),
        } as Response);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('signup-slug-available')).toBeInTheDocument();

      await act(async () => {
        resolveFirst({
          ok: true,
          json: async () => ({ available: false, suggestions: ['stale'] }),
        } as Response);
        await Promise.resolve();
        await Promise.resolve();
      });
      // The stale `taken` response was ignored; UI is still `available`.
      expect(screen.getByTestId('signup-slug-available')).toBeInTheDocument();
      expect(screen.queryByTestId('signup-slug-taken')).toBeNull();
    });

    it('stashes the overridden slug (not the auto-derived one) on submit', async () => {
      fetchMock.mockReturnValue(ok({ available: true }));
      renderPage();
      typeFamily('The Khan Family');
      await advanceAndFlush(300);
      // Override via the Change link.
      fireEvent.click(screen.getByTestId('signup-slug-change'));
      const slugInput = screen.getByTestId('signup-slug-input') as HTMLInputElement;
      fireEvent.change(slugInput, { target: { value: 'khans-house' } });
      // Re-check the new slug — endpoint still says available.
      await advanceAndFlush(300);

      fireEvent.change(screen.getByTestId('signup-display-name'), {
        target: { value: 'Sarah Khan' },
      });
      fireEvent.change(screen.getByTestId('signup-email'), {
        target: { value: 'sarah@example.com' },
      });
      signInWithOtp.mockResolvedValue({ error: null });
      fireEvent.submit(screen.getByTestId('signup-form'));
      await Promise.resolve();
      expect(JSON.parse(sessionStorage.getItem('fh.signup.intent') ?? '{}')).toMatchObject({
        familyName: 'The Khan Family',
        slug: 'khans-house',
      });
    });
  });
});
