// FHS-394 — MathsSubject unit tests.
// Covers: placement vs journey branching, operation switch, trophy toggle,
// learn-stage wiring (MathsAILesson), and coming-soon placeholders.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsSubject } from '../../../../../../../apps/web/src/pages/tenant/child/learn/maths/MathsSubject';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-subject-tok';

// URL-keyed mock — maps URL substring to response.
function installFetch(overrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = (init as RequestInit | undefined)?.method ?? 'GET';

    // Placement POST
    if (u.includes('/api/kid/maths/placement') && method === 'POST') {
      const r = overrides['placement'] ?? { unlocked: [] };
      return Promise.resolve({ ok: true, status: 200, json: async () => r });
    }
    // Progress PUT (learn complete)
    if (u.includes('/api/kid/maths/progress') && method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    // Progress GET
    if (u.includes('/api/kid/maths/progress')) {
      const r = overrides['progress'] ?? { progress: [] };
      return Promise.resolve({ ok: true, status: 200, json: async () => r });
    }
    // Certificates GET
    if (u.includes('/api/kid/maths/certificates')) {
      const r = overrides['certificates'] ?? { certificates: [] };
      return Promise.resolve({ ok: true, status: 200, json: async () => r });
    }
    // AI lesson (MathsAILesson auto-starts in table mode)
    if (u.includes('/api/kid/learn/maths/ai-lesson')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ enabled: false }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// ─── First-time entry → placement test ───────────────────────────────────────

describe('MathsSubject — placement vs journey branching', () => {
  it('shows the placement test when there is no progress for the operation', async () => {
    // progress endpoint returns empty array → no progress → placement.
    installFetch({ progress: { progress: [] } });
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('placement-test')).toBeInTheDocument());
    // The intro phase of the placement test is shown.
    expect(screen.getByTestId('placement-begin')).toBeInTheDocument();
  });

  it('shows the journey when progress already exists for the operation', async () => {
    installFetch({
      progress: {
        progress: [
          {
            operation: 'addition',
            tableNumber: 1,
            learnCompleted: false,
            practiceCorrect: 0,
            proveScore: 0,
            proveAvgTime: 0,
          },
        ],
      },
    });
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    expect(screen.queryByTestId('placement-test')).not.toBeInTheDocument();
  });
});

// ─── Operation switch ─────────────────────────────────────────────────────────

describe('MathsSubject — operation switch', () => {
  it('renders four operation buttons', async () => {
    installFetch();
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-operation-selector')).toBeInTheDocument());
    expect(screen.getByTestId('maths-op-addition')).toBeInTheDocument();
    expect(screen.getByTestId('maths-op-subtraction')).toBeInTheDocument();
    expect(screen.getByTestId('maths-op-multiplication')).toBeInTheDocument();
    expect(screen.getByTestId('maths-op-division')).toBeInTheDocument();
  });

  it('switching operation re-fetches progress and may show placement', async () => {
    // addition has progress; multiplication has none.
    let callCount = 0;
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/maths/certificates')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ certificates: [] }) });
      }
      if (u.includes('/api/kid/maths/progress')) {
        callCount++;
        const progress =
          callCount === 1
            ? // First call for addition — has progress
              [
                {
                  operation: 'addition',
                  tableNumber: 1,
                  learnCompleted: false,
                  practiceCorrect: 0,
                  proveScore: 0,
                  proveAvgTime: 0,
                },
              ]
            : // Second call for multiplication — no progress
              [];
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress }) });
      }
      if (u.includes('/api/kid/learn/maths/ai-lesson')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ enabled: false }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<MathsSubject kidToken={KID_TOKEN} />);
    // Initial: addition has progress → journey
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());

    // Switch to multiplication
    await act(async () => {
      fireEvent.click(screen.getByTestId('maths-op-multiplication'));
    });

    // Now no progress → placement
    await waitFor(() => expect(screen.getByTestId('placement-test')).toBeInTheDocument());
  });
});

// ─── Trophy toggle ────────────────────────────────────────────────────────────

describe('MathsSubject — trophy toggle', () => {
  it('clicking trophy shows the achievements panel', async () => {
    installFetch({ progress: { progress: [] } });
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-subject')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('maths-trophy-toggle'));
    });
    expect(screen.getByTestId('maths-achievements')).toBeInTheDocument();
  });

  it('clicking trophy again from achievements returns to journey/placement', async () => {
    installFetch({ progress: { progress: [] } });
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-subject')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('maths-trophy-toggle'));
    });
    expect(screen.getByTestId('maths-achievements')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('maths-trophy-toggle'));
    });
    // Back to placement (no progress)
    await waitFor(() => expect(screen.getByTestId('placement-test')).toBeInTheDocument());
    expect(screen.queryByTestId('maths-achievements')).not.toBeInTheDocument();
  });

  it('trophy button has aria-pressed=true when achievements is shown', async () => {
    installFetch({ progress: { progress: [] } });
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-subject')).toBeInTheDocument());

    const trophy = screen.getByTestId('maths-trophy-toggle');
    expect(trophy).toHaveAttribute('aria-pressed', 'false');
    await act(async () => {
      fireEvent.click(trophy);
    });
    expect(trophy).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─── Learn stage wiring ───────────────────────────────────────────────────────

describe('MathsSubject — learn stage wiring', () => {
  it('when journey starts the learn stage, MathsAILesson is rendered (or its null/disabled state)', async () => {
    // Set up: multiplication table 1 with learn not yet completed
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/maths/certificates'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ certificates: [] }) });
      if (u.includes('/api/kid/maths/progress'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            progress: [
              {
                operation: 'addition',
                tableNumber: 1,
                learnCompleted: false,
                practiceCorrect: 0,
                proveScore: 0,
                proveAvgTime: 0,
              },
            ],
          }),
        });
      if (u.includes('/api/kid/learn/maths/ai-lesson'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ enabled: false }) });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());

    // Click the Continue button to start the learn stage
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });

    // The AI lesson fires and the feature flag is off → component renders null (disabled).
    // We verify the learn stage is entered by confirming the journey panel is gone.
    await waitFor(() => expect(screen.queryByTestId('maths-journey')).not.toBeInTheDocument());
  });
});

// ─── Coming-soon placeholders ─────────────────────────────────────────────────

describe('MathsSubject — coming-soon seams', () => {
  it('Practice stage shows the "coming soon" card (seam for PR3)', async () => {
    // progress: learn done, practiceCorrect < 10 → practice is next stage
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/maths/certificates'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ certificates: [] }) });
      if (u.includes('/api/kid/maths/progress'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            progress: [
              {
                operation: 'addition',
                tableNumber: 1,
                learnCompleted: true,
                practiceCorrect: 5,
                proveScore: 0,
                proveAvgTime: 0,
              },
            ],
          }),
        });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());

    // Click Continue — active stage is practice
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('maths-coming-soon-practice')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('coming-soon-back')).toBeInTheDocument();
  });
});
