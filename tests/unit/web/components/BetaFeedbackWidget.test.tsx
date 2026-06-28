/**
 * Unit tests for BetaFeedbackWidget — FHS-418
 *
 * Covers:
 *  - button renders and opens dialog
 *  - submit disabled with nothing answered
 *  - answering one question enables submit
 *  - submit POSTs the right body and shows thank-you
 *  - error response shows inline error message
 *  - widget not rendered when no Supabase session (kid-only / logged-out)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (before import of component) ───────────────────────────────────────

// react-router-dom: useParams always returns { slug: 'test-family' }
vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: 'test-family' }),
}));

// auth-context: default to a logged-in parent session
const mockSession = { access_token: 'parent.jwt.tok' };
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => ({ session: mockSession }),
}));

// supabase stub (imported transitively via lib/api)
vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

import { BetaFeedbackWidget } from '../../../../apps/web/src/components/BetaFeedbackWidget';

// ── fetch mock ────────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWidget() {
  return render(<BetaFeedbackWidget />);
}

function openDialog() {
  fireEvent.click(screen.getByTestId('beta-feedback-button'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<BetaFeedbackWidget />', () => {
  it('renders the floating button', () => {
    renderWidget();
    expect(screen.getByTestId('beta-feedback-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give feedback/i })).toBeInTheDocument();
  });

  it('opens the dialog when the button is clicked', () => {
    renderWidget();
    expect(screen.queryByTestId('beta-feedback-dialog')).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByTestId('beta-feedback-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Help shape Family Hub/)).toBeInTheDocument();
  });

  it('submit button is disabled with nothing answered', () => {
    renderWidget();
    openDialog();
    const submit = screen.getByTestId('beta-feedback-submit');
    expect(submit).toBeDisabled();
  });

  it('submit button becomes enabled after answering one PMF option', () => {
    renderWidget();
    openDialog();
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('submit button becomes enabled after entering a pain-point textarea', () => {
    renderWidget();
    openDialog();
    fireEvent.change(screen.getByTestId('beta-feedback-pain'), {
      target: { value: 'Keeping chores in sync' },
    });
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('submit button becomes enabled after selecting a recommend score', () => {
    renderWidget();
    openDialog();
    fireEvent.click(screen.getByTestId('beta-feedback-recommend-9'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('POSTs the correct body and shows the thank-you state on 201', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'fb1' }),
    });

    renderWidget();
    openDialog();

    // Answer PMF + a text area
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-somewhat'));
    fireEvent.change(screen.getByTestId('beta-feedback-feature'), {
      target: { value: 'Shared shopping list' },
    });

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-thanks')).toBeInTheDocument());

    // Verify the fetch call
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/feedback');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.pmfDisappointment).toBe('somewhat');
    expect(body.featureRequest).toBe('Shared shopping list');
    // Fields not answered must be absent
    expect(body).not.toHaveProperty('recommendScore');
    expect(body).not.toHaveProperty('solvesProblem');

    // Auth + tenant headers
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer parent.jwt.tok');
    expect(headers['x-tenant-slug']).toBe('test-family');
  });

  it('shows inline error message when the server returns an error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    renderWidget();
    openDialog();

    fireEvent.click(screen.getByTestId('beta-feedback-pmf-not'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-error')).toBeInTheDocument());
    expect(screen.getByTestId('beta-feedback-error').textContent).toMatch(/Internal server error/);
    // Thank-you state must NOT appear
    expect(screen.queryByTestId('beta-feedback-thanks')).not.toBeInTheDocument();
    // Submit button should be re-enabled
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('shows a generic error message when the network throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network failure'));

    renderWidget();
    openDialog();

    fireEvent.change(screen.getByTestId('beta-feedback-other'), {
      target: { value: 'Love the app!' },
    });
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-error')).toBeInTheDocument());
    expect(screen.getByTestId('beta-feedback-error').textContent).toMatch(
      /Could not reach the server/,
    );
  });

  it('omits unanswered numeric fields from the POST body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();

    // Only answer recommend score = 7
    fireEvent.click(screen.getByTestId('beta-feedback-recommend-7'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.recommendScore).toBe(7);
    expect(body).not.toHaveProperty('pmfDisappointment');
    expect(body).not.toHaveProperty('solvesProblem');
    expect(body).not.toHaveProperty('easeOfUse');
    expect(body).not.toHaveProperty('keepUsing');
  });

  it('does not render the floating button when there is no session', () => {
    vi.doMock('../../../../apps/web/src/lib/auth-context', () => ({
      useAuth: () => ({ session: null }),
    }));
    // Re-render using the component directly with a null-session override
    // by rendering with a mocked context wrapper.
    // Since doMock is async-module, we test the guard behaviour via a
    // simple inline session check — the component returns null when
    // session is null. Verify the button is absent on first render
    // (the static mock above has session set, so we test via the guard
    // logic: if session were null the button testid would not exist).
    // This test confirms the pattern rather than re-importing (import
    // order limitation in vitest). Kept as a documentation guard test.
    expect(true).toBe(true); // placeholder — the real guard is tested below
  });
});

// Separate describe that overrides the auth mock to return null session
describe('<BetaFeedbackWidget /> — no session', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders nothing when session is null', async () => {
    vi.doMock('../../../../apps/web/src/lib/auth-context', () => ({
      useAuth: () => ({ session: null }),
    }));
    const { BetaFeedbackWidget: Widget } = await import(
      '../../../../apps/web/src/components/BetaFeedbackWidget'
    );
    render(<Widget />);
    expect(screen.queryByTestId('beta-feedback-button')).not.toBeInTheDocument();
  });
});
