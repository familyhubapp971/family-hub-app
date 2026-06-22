import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X, Trophy, ArrowRight } from 'lucide-react';
import { API_BASE } from '../../../lib/api';

// FHS-283 — interactive Learn lesson. Difficulty pills + a question/answer area
// + a streak/best/score stats bar with progress toward a certificate. Grading
// and all stats are server-authoritative (POST /api/learn/:subject/answer).

type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

interface Question {
  id: string;
  prompt: string;
  choices: string[];
}
interface Stats {
  progress: number;
  score: number;
  streak: number;
  best: number;
  answered: number;
  certificate: boolean;
}
interface QuestionsResponse {
  subject: string;
  difficulty: Difficulty;
  questions: Question[];
  stats: Stats;
}
interface AnswerResponse {
  correct: boolean;
  answerIndex: number;
  stats: Stats;
}

type Headers = Record<string, string> | null;

export function LessonView({
  subject,
  memberId,
  kidToken,
  headers,
}: {
  subject: string;
  memberId?: string;
  kidToken?: string;
  headers: Headers;
}) {
  const kid = !!kidToken;
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickError, setPickError] = useState(false);
  // Bumped on every (re)load so a slow answer POST from a previous round/
  // difficulty can't overwrite fresh state when it finally resolves.
  const roundId = useRef(0);

  const load = useCallback(() => {
    if (!headers) return;
    let cancelled = false;
    roundId.current += 1;
    setStatus('loading');
    setPicked(null);
    setResult(null);
    setPickError(false);
    setIdx(0);
    const url = kid
      ? `${API_BASE}/api/kid/learn/${encodeURIComponent(subject)}/questions?difficulty=${difficulty}`
      : `${API_BASE}/api/learn/${encodeURIComponent(subject)}/questions?memberId=${memberId}&difficulty=${difficulty}`;
    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((body: QuestionsResponse) => {
        if (cancelled) return;
        setQuestions(body.questions ?? []);
        setStats(body.stats);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [headers, kid, subject, memberId, difficulty]);

  useEffect(() => load(), [load]);

  const current = questions[idx] ?? null;

  const onPick = async (choiceIndex: number) => {
    if (!headers || !current || picked !== null || submitting) return;
    const myRound = roundId.current;
    setPicked(choiceIndex);
    setPickError(false);
    setSubmitting(true);
    try {
      const answerUrl = kid
        ? `${API_BASE}/api/kid/learn/${encodeURIComponent(subject)}/answer`
        : `${API_BASE}/api/learn/${encodeURIComponent(subject)}/answer`;
      const res = await fetch(answerUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kid
            ? { questionId: current.id, choiceIndex }
            : { memberId, questionId: current.id, choiceIndex },
        ),
      });
      if (roundId.current !== myRound) return; // difficulty/round changed — drop it
      if (res.ok) {
        const body = (await res.json()) as AnswerResponse;
        setResult(body);
        setStats(body.stats);
      } else {
        setPicked(null);
        setPickError(true);
      }
    } catch {
      if (roundId.current === myRound) {
        setPicked(null); // let the child try again instead of freezing
        setPickError(true);
      }
    } finally {
      if (roundId.current === myRound) setSubmitting(false);
    }
  };

  const onNext = () => {
    if (status === 'loading') return; // guard double-clicks
    setPicked(null);
    setResult(null);
    setPickError(false);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else load(); // start a fresh round of the same difficulty
  };

  return (
    <div className="flex flex-col gap-4" data-testid="lesson-view">
      {/* Difficulty pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            data-testid={`lesson-difficulty-${d}`}
            aria-pressed={difficulty === d}
            disabled={submitting}
            onClick={() => setDifficulty(d)}
            className={`min-h-[44px] rounded-full border-2 border-black px-4 py-2 text-sm font-black shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-60 motion-safe:enabled:hover:-translate-y-0.5 ${
              difficulty === d ? 'bg-violet-400 text-white' : 'bg-white text-gray-800'
            }`}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {stats && (
        <div
          className="grid grid-cols-3 gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm"
          data-testid="lesson-stats"
        >
          <Stat label="Streak" value={stats.streak} emoji="🔥" testid="lesson-stat-streak" />
          <Stat label="Best" value={stats.best} emoji="🏅" testid="lesson-stat-best" />
          <Stat label="Score" value={stats.score} emoji="⭐" testid="lesson-stat-score" />
        </div>
      )}

      {/* Progress + certificate */}
      {stats && (
        <div className="rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm">
          <div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-wide">
            <span>Certificate progress</span>
            <span data-testid="lesson-progress-pct">{stats.progress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100">
            <div
              data-testid="lesson-progress"
              className="h-full bg-green-400 transition-all"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          {stats.certificate && (
            <div
              data-testid="lesson-certificate"
              className="mt-3 flex items-center gap-2 rounded-lg border-2 border-black bg-yellow-200 px-3 py-2 text-sm font-black"
            >
              <Trophy size={18} aria-hidden="true" />
              {subject} certificate earned! 🎉
            </div>
          )}
        </div>
      )}

      {/* Question / answer */}
      {status === 'loading' && (
        <p
          data-testid="lesson-loading"
          aria-busy="true"
          className="text-sm font-bold text-gray-500"
        >
          Loading the lesson…
        </p>
      )}
      {status === 'error' && (
        <p data-testid="lesson-error" role="alert" className="text-sm font-bold text-red-500">
          Couldn&rsquo;t load the lesson — try again.
        </p>
      )}
      {status === 'ready' && !current && (
        <p
          data-testid="lesson-empty"
          className="rounded-xl border-2 border-black bg-white p-5 text-sm font-bold text-gray-500 shadow-neo-sm"
        >
          No questions here yet — try a different difficulty.
        </p>
      )}
      {status === 'ready' && current && (
        <div
          className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
          data-testid="lesson-question"
        >
          <p className="mb-4 font-heading text-2xl">{current.prompt}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {current.choices.map((choice, i) => {
              const isPicked = picked === i;
              const isCorrect = result !== null && result.answerIndex === i;
              const showWrong = result !== null && isPicked && !result.correct;
              return (
                <button
                  key={i}
                  type="button"
                  data-testid={`lesson-choice-${i}`}
                  disabled={picked !== null}
                  onClick={() => onPick(i)}
                  className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border-2 border-black px-4 py-3 text-left font-bold shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:cursor-default motion-safe:enabled:hover:-translate-y-0.5 ${
                    isCorrect
                      ? 'bg-green-300'
                      : showWrong
                        ? 'bg-red-300'
                        : 'bg-white disabled:opacity-60'
                  }`}
                >
                  <span>{choice}</span>
                  {isCorrect && <Check size={18} aria-hidden="true" />}
                  {showWrong && <X size={18} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {pickError && (
            <p
              data-testid="lesson-pick-error"
              role="alert"
              className="mt-4 text-sm font-black text-red-600"
            >
              Something went wrong — tap a choice to try again.
            </p>
          )}

          {result && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p
                data-testid="lesson-feedback"
                aria-live="polite"
                className={`text-sm font-black ${result.correct ? 'text-green-600' : 'text-red-600'}`}
              >
                {result.correct ? 'Correct! 🎉' : 'Not quite — keep going!'}
              </p>
              <button
                type="button"
                data-testid="lesson-next"
                onClick={onNext}
                disabled={status !== 'ready'}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-black bg-violet-400 px-4 py-2 font-black text-white shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-60 motion-safe:enabled:hover:-translate-y-0.5"
              >
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emoji,
  testid,
}: {
  label: string;
  value: number;
  emoji: string;
  testid: string;
}) {
  return (
    <div className="text-center" data-testid={testid}>
      <p className="text-2xl font-black">
        <span aria-hidden="true">{emoji}</span> {value}
      </p>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
