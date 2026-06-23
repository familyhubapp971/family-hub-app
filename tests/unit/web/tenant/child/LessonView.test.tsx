import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { LessonView } from '../../../../../apps/web/src/pages/tenant/child/LessonView';

// FHS-283 — the interactive lesson UI: renders questions, grades a pick via the
// API, shows feedback + a Next button, and reveals a certificate at 100%.

const fetchMock = vi.fn();
const HEADERS = { Authorization: 'Bearer tok', 'x-tenant-slug': 'khan' };
const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const QUESTION = { id: 'q1', prompt: '2 + 2 = ?', choices: ['3', '4', '5'] };

function installApi(answer: { correct: boolean; answerIndex: number; stats: object }) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: async () => answer });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        subject: 'Maths',
        difficulty: 'easy',
        questions: [QUESTION],
        stats: { progress: 0, score: 0, streak: 0, best: 0, answered: 0, certificate: false },
      }),
    });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<LessonView />', () => {
  it('renders the question, choices, difficulty pills and stats', async () => {
    installApi({ correct: true, answerIndex: 1, stats: {} });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    expect(screen.getByText('2 + 2 = ?')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-difficulty-hard')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-stat-streak')).toBeInTheDocument();
  });

  it('does NOT render sub-topic pills for a non-Logic subject (Maths)', async () => {
    installApi({ correct: true, answerIndex: 1, stats: {} });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    expect(screen.queryByTestId('lesson-subtopic-patterns')).not.toBeInTheDocument();
  });

  it('renders all 4 Logic sub-topic pills when subject is Logic', async () => {
    installApi({ correct: true, answerIndex: 1, stats: {} });
    render(<LessonView subject="Logic" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-subtopic-patterns')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-subtopic-odd-one-out')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-subtopic-if-then')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-subtopic-sorting')).toBeInTheDocument();
  });

  it('patterns pill is active by default (aria-pressed=true)', async () => {
    installApi({ correct: true, answerIndex: 1, stats: {} });
    render(<LessonView subject="Logic" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-subtopic-patterns')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-subtopic-patterns')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('lesson-subtopic-sorting')).toHaveAttribute('aria-pressed', 'false');
  });

  it('selecting a sub-topic refetches with subtopic= in the URL', async () => {
    installApi({ correct: true, answerIndex: 1, stats: {} });
    render(<LessonView subject="Logic" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-subtopic-sorting')).toBeInTheDocument());

    fetchMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-subtopic-sorting'));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string][];
      const refetch = calls.find(([url]) => String(url).includes('subtopic=sorting'));
      expect(refetch).toBeTruthy();
    });
  });

  it('grades a pick, shows feedback + a Next button, and updates the score', async () => {
    installApi({
      correct: true,
      answerIndex: 1,
      stats: { progress: 10, score: 1, streak: 1, best: 1, answered: 1, certificate: false },
    });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('lesson-feedback').textContent).toMatch(/Correct/),
    );
    expect(screen.getByTestId('lesson-next')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-stat-score').textContent).toContain('1');
  });

  it('recovers when the answer POST fails — re-enables choices + shows an error', async () => {
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          subject: 'Maths',
          difficulty: 'easy',
          questions: [QUESTION],
          stats: { progress: 0, score: 0, streak: 0, best: 0, answered: 0, certificate: false },
        }),
      });
    });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-pick-error')).toBeInTheDocument());
    // Choices are tappable again (not frozen).
    expect((screen.getByTestId('lesson-choice-0') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the certificate when progress hits 100', async () => {
    installApi({
      correct: true,
      answerIndex: 1,
      stats: { progress: 100, score: 10, streak: 10, best: 10, answered: 10, certificate: true },
    });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-certificate')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-progress-pct').textContent).toContain('100');
  });
});
