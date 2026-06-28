/**
 * Unit tests for BetaFeedbackWidget — FHS-418
 *
 * Covers:
 *  - button renders and opens dialog
 *  - submit disabled with nothing answered
 *  - answering one question enables submit
 *  - recommendScore = 0 is a valid answer (falsy-value guard)
 *  - submit POSTs the right body and shows thank-you
 *  - re-opening after success shows a blank form (not thank-you)
 *  - error response shows inline error message
 *  - widget renders null when no session
 *  - widget renders null when session present but no tenant slug
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (before import of component) ───────────────────────────────────────

// react-router-dom: useParams returns { slug: 'test-family' } by default
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
    expect(screen.getByTestId('beta-feedback-submit')).toBeDisabled();
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

  it('submit button becomes enabled after selecting recommend score = 9', () => {
    renderWidget();
    openDialog();
    fireEvent.click(screen.getByTestId('beta-feedback-recommend-9'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  // Blocker 1 — falsy-value guard: 0 is a valid recommendScore
  it('recommendScore = 0 enables submit and is included in the POST body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();

    // Score 0 is falsy — must use !== undefined check, not truthiness
    fireEvent.click(screen.getByTestId('beta-feedback-recommend-0'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.recommendScore).toBe(0);
  });

  it('POSTs the correct body and shows the thank-you state on 201', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'fb1' }),
    });

    renderWidget();
    openDialog();

    fireEvent.click(screen.getByTestId('beta-feedback-pmf-somewhat'));
    fireEvent.change(screen.getByTestId('beta-feedback-feature'), {
      target: { value: 'Shared shopping list' },
    });

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-thanks')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/feedback');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.pmfDisappointment).toBe('somewhat');
    expect(body.featureRequest).toBe('Shared shopping list');
    expect(body).not.toHaveProperty('recommendScore');
    expect(body).not.toHaveProperty('solvesProblem');

    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer parent.jwt.tok');
    expect(headers['x-tenant-slug']).toBe('test-family');
  });

  // New test — re-opening after success shows a blank form, not thank-you
  it('re-opening the widget after a successful submit shows a blank form', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();

    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    // Wait for thank-you
    await waitFor(() => expect(screen.getByTestId('beta-feedback-thanks')).toBeInTheDocument());

    // Close via the thank-you Close button
    fireEvent.click(screen.getByRole('button', { name: /^Close$/i }));

    // Re-open
    openDialog();

    // Thank-you state must not be showing
    expect(screen.queryByTestId('beta-feedback-thanks')).not.toBeInTheDocument();
    // Submit must be disabled again (blank form)
    expect(screen.getByTestId('beta-feedback-submit')).toBeDisabled();
    // The PMF buttons must all be unselected
    expect(screen.getByTestId('beta-feedback-pmf-very')).toHaveAttribute('aria-pressed', 'false');
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
    expect(screen.queryByTestId('beta-feedback-thanks')).not.toBeInTheDocument();
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
});

// ── Guard tests (no session / no slug) ───────────────────────────────────────

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

describe('<BetaFeedbackWidget /> — session present, no tenant slug', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders nothing when useParams returns no slug (legacy routes)', async () => {
    // Override react-router-dom to return empty params (no :slug)
    vi.doMock('react-router-dom', () => ({
      useParams: () => ({}),
    }));
    vi.doMock('../../../../apps/web/src/lib/auth-context', () => ({
      useAuth: () => ({ session: { access_token: 'tok' } }),
    }));
    vi.doMock('../../../../apps/web/src/lib/supabase', () => ({
      supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
    }));
    const { BetaFeedbackWidget: Widget } = await import(
      '../../../../apps/web/src/components/BetaFeedbackWidget'
    );
    render(<Widget />);
    expect(screen.queryByTestId('beta-feedback-button')).not.toBeInTheDocument();
  });
});
