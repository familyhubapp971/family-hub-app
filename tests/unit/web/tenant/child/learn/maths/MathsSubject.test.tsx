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

// ─── Practice stage wiring ────────────────────────────────────────────────────

// Stable mock for generateTableProblem so the practice questions are deterministic.
vi.mock(
  '../../../../../../../apps/web/src/pages/tenant/child/learn/maths/maths-utils',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../../../../apps/web/src/pages/tenant/child/learn/maths/maths-utils')
      >();
    return {
      ...actual,
      generateTableProblem: () => ({
        a: 3,
        b: 4,
        operation: 'addition',
        answer: 12,
        emoji: 'star',
        choices: [10, 12, 14, 16],
      }),
    };
  },
);

describe('MathsSubject — practice stage wiring', () => {
  // Install progress so the journey renders with practice as the active stage.
  function installPracticeReady() {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (u.includes('/api/kid/maths/certificates'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ certificates: [] }) });
      if (u.includes('/api/kid/maths/progress') && method === 'PUT')
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
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
                practiceCorrect: 0,
                proveScore: 0,
                proveAvgTime: 0,
              },
            ],
          }),
        });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  }

  // Answer all 10 questions in MathsTablePractice using the seeded correct answer.
  async function answerAll10() {
    for (let q = 0; q < 10; q++) {
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Answer 12' }));
      });
      await act(async () => {
        vi.advanceTimersByTime(700);
      });
    }
  }

  it('clicking Continue on the journey when practice is active renders MathsTablePractice', async () => {
    installPracticeReady();
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument());
    expect(screen.queryByTestId('maths-coming-soon-practice')).not.toBeInTheDocument();
  });

  it('completing practice PUTs practiceCorrect then shows MathsStageComplete (no internal done-screen)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installPracticeReady();
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument());

    // Answer all 10 — onComplete fires automatically (no internal done-screen to tap)
    await answerAll10();

    // PUT /api/kid/maths/progress should have been called with practiceCorrect
    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      const putCall = calls.find(
        ([url, init]) =>
          (url as string).includes('/api/kid/maths/progress') &&
          (init as RequestInit)?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({ practiceCorrect: 10 });
    });

    // MathsStageComplete for practice is the ONLY celebration screen
    await waitFor(() => expect(screen.getByTestId('stage-complete')).toBeInTheDocument());
    // No internal "practice-complete-continue" button — parent owns it
    expect(screen.queryByTestId('practice-complete-continue')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('Back to Journey from MathsTablePractice returns to journey without stage-complete', async () => {
    installPracticeReady();
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('practice-back-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    expect(screen.queryByTestId('stage-complete')).not.toBeInTheDocument();
  });

  it('re-entry: after stage-complete → Back to Journey → start practice again shows fresh questions (not stale stage-complete)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installPracticeReady();
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());

    // --- First practice run ---
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument());
    await answerAll10();
    await waitFor(() => expect(screen.getByTestId('stage-complete')).toBeInTheDocument());

    // --- Back to Journey from stage-complete ---
    await act(async () => {
      fireEvent.click(screen.getByTestId('stage-complete-journey'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());

    // --- Second practice run (re-entry) ---
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });

    // Must show fresh questions — NOT the stale stage-complete
    await waitFor(() => expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument());
    expect(screen.queryByTestId('stage-complete')).not.toBeInTheDocument();
    expect(screen.getByTestId('practice-progress')).toHaveTextContent('Question 1 of 10');
    vi.useRealTimers();
  });

  it('Continue from stage-complete navigates to the Prove coming-soon stub (PR4 seam)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installPracticeReady();
    render(<MathsSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument());
    await answerAll10();
    await waitFor(() => expect(screen.getByTestId('stage-complete')).toBeInTheDocument());

    // Tap "Continue to Prove It" on MathsStageComplete
    await act(async () => {
      fireEvent.click(screen.getByTestId('stage-complete-continue'));
    });

    // Prove coming-soon stub renders (PR4 seam, testid from ComingSoonCard)
    await waitFor(() =>
      expect(screen.getByTestId('maths-coming-soon-prove-it')).toBeInTheDocument(),
    );
    vi.useRealTimers();
  });
});
