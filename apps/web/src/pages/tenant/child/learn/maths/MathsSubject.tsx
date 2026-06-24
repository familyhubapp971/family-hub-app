// FHS-394 — Maths subject orchestrator.
// Replaces the legacy MathsSubject.tsx for the kid Learn tab.
//
// Auth: all /api/kid/maths/* calls use Bearer kidToken (no memberId).
// On mount it fetches progress. First-time entry (no progress for the
// selected operation) → shows MathsPlacementTest. Otherwise shows
// MathsJourney.
//
// Learn stage → MathsAILesson (FHS-389); on completion PUT progress.
// Practice / Prove stages → "Coming soon" placeholder (PR3/PR4 seam).
// Achievements (trophy) → future certificates view placeholder.

import { useState, useCallback, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { API_BASE } from '../../../../../lib/api';
import { MathsPlacementTest } from './MathsPlacementTest';
import { MathsJourney } from './MathsJourney';
import { MathsAILesson } from './MathsAILesson';
import { MathsTablePractice } from './MathsTablePractice';
import { MathsStageComplete } from './MathsStageComplete';
import type { Operation, TableNumber } from './maths-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MathsProgress {
  operation: Operation;
  tableNumber: number;
  learnCompleted: boolean;
  practiceCorrect: number;
  proveScore: number;
  proveAvgTime: number;
}

type ActiveView = 'journey' | 'placement' | 'learn' | 'practice' | 'prove' | 'achievements';

interface MathsSubjectProps {
  kidToken: string;
}

// ─── Operation catalogue ──────────────────────────────────────────────────────

const OPERATIONS: { key: Operation; label: string; symbol: string; color: string }[] = [
  { key: 'addition', label: 'Add', symbol: '+', color: 'from-blue-500 to-cyan-500' },
  { key: 'subtraction', label: 'Subtract', symbol: '−', color: 'from-orange-500 to-amber-500' },
  { key: 'multiplication', label: 'Times', symbol: '×', color: 'from-purple-500 to-pink-500' },
  { key: 'division', label: 'Divide', symbol: '÷', color: 'from-green-500 to-emerald-500' },
];

// ─── Coming-soon placeholder (seam for PR3 / PR4) ────────────────────────────

function ComingSoonCard({ stage, onBack }: { stage: 'Practice' | 'Prove It'; onBack: () => void }) {
  return (
    <div
      data-testid={`maths-coming-soon-${stage.toLowerCase().replace(' ', '-')}`}
      className="space-y-4"
    >
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-8 shadow-neo text-center space-y-4">
        <div className="text-5xl" aria-hidden="true">
          {stage === 'Practice' ? '🎯' : '⚡'}
        </div>
        <h3 className="font-black text-xl text-gray-800">{stage} — Coming Soon!</h3>
        <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">
          This part of your maths journey is on its way. Check back soon to unlock it!
        </p>
        <button
          data-testid="coming-soon-back"
          type="button"
          onClick={onBack}
          className="min-h-[44px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all"
        >
          ← Back to Journey
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MathsSubject({ kidToken }: MathsSubjectProps) {
  const [operation, setOperation] = useState<Operation>('addition');
  const [activeView, setActiveView] = useState<ActiveView>('journey');
  const [activeTableNumber, setActiveTableNumber] = useState<TableNumber>(1);
  const [journeyKey, setJourneyKey] = useState(0);
  // Practice stage result — passed from MathsTablePractice → MathsStageComplete
  const [lastPracticeCorrect, setLastPracticeCorrect] = useState(0);
  const [showPracticeComplete, setShowPracticeComplete] = useState(false);

  // Whether this operation has any progress at all — controls placement vs journey.
  const [hasProgress, setHasProgress] = useState<boolean | null>(null); // null = loading

  // Fetch progress on mount and whenever the operation changes.
  const checkProgress = useCallback(
    async (op: Operation) => {
      setHasProgress(null);
      try {
        const res = await fetch(`${API_BASE}/api/kid/maths/progress`, {
          headers: { Authorization: `Bearer ${kidToken}` },
        });
        if (!res.ok) {
          // Fail safe: assume no progress → show placement.
          setHasProgress(false);
          return;
        }
        const data = (await res.json()) as { progress: MathsProgress[] };
        const opProgress = (data.progress ?? []).filter((p) => p.operation === op);
        setHasProgress(opProgress.length > 0);
      } catch {
        setHasProgress(false);
      }
    },
    [kidToken],
  );

  useEffect(() => {
    void checkProgress(operation);
  }, [operation, checkProgress]);

  // After placement completes, always go to the journey — never bounce back to
  // the placement test. MathsJourney fetches its own progress, so we don't
  // refetch here (a failed refetch must not flip hasProgress back to false and
  // re-show placement, which would loop on a flaky network).
  const handlePlacementComplete = useCallback(() => {
    setHasProgress(true);
    setActiveView('journey');
    setJourneyKey((k) => k + 1);
  }, []);

  // Learn stage complete → PUT progress then back to journey.
  const handleLearnComplete = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/kid/maths/progress`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${kidToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          tableNumber: activeTableNumber,
          learnCompleted: true,
        }),
      });
    } catch (err) {
      console.error('Failed to save learn progress:', err);
    }
    setActiveView('journey');
    setJourneyKey((k) => k + 1);
  }, [kidToken, operation, activeTableNumber]);

  // Practice stage complete → PUT progress then show MathsStageComplete.
  const handlePracticeComplete = useCallback(
    async (correct: number) => {
      try {
        await fetch(`${API_BASE}/api/kid/maths/progress`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${kidToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation,
            tableNumber: activeTableNumber,
            practiceCorrect: correct,
          }),
        });
      } catch (err) {
        console.error('Failed to save practice progress:', err);
      }
      setLastPracticeCorrect(correct);
      setShowPracticeComplete(true);
    },
    [kidToken, operation, activeTableNumber],
  );

  const isAchievements = activeView === 'achievements';

  // ── Loading ───────────────────────────────────────────────────────────────

  if (hasProgress === null) {
    return (
      <div data-testid="maths-subject" className="flex items-center justify-center py-12">
        <div
          className="text-4xl motion-safe:animate-pulse"
          aria-busy="true"
          aria-label="Loading maths"
        >
          🔢
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div data-testid="maths-subject" className="space-y-4 sm:space-y-6">
      {/* Operation selector + Trophy toggle */}
      <div className="flex items-center gap-2">
        <div
          data-testid="maths-operation-selector"
          className="flex-1 bg-white border-2 sm:border-[3px] border-black rounded-2xl p-1.5 sm:p-2 grid grid-cols-2 sm:flex gap-1.5 sm:gap-2 shadow-neo"
          role="group"
          aria-label="Select operation"
        >
          {OPERATIONS.map((op) => (
            <button
              key={op.key}
              data-testid={`maths-op-${op.key}`}
              type="button"
              aria-pressed={operation === op.key}
              onClick={() => {
                if (op.key === operation && activeView === 'journey') return;
                setOperation(op.key);
                setActiveView('journey');
                setJourneyKey((k) => k + 1);
              }}
              className={`flex-1 min-h-[44px] py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all ${
                operation === op.key
                  ? `bg-gradient-to-r ${op.color} text-white shadow-neo-xs`
                  : 'text-gray-500 motion-safe:hover:bg-gray-50'
              }`}
            >
              {op.symbol} {op.label}
            </button>
          ))}
        </div>
        <button
          data-testid="maths-trophy-toggle"
          type="button"
          aria-label={isAchievements ? 'Back to journey' : 'View achievements'}
          aria-pressed={isAchievements}
          onClick={() => {
            if (isAchievements) {
              setActiveView('journey');
              setJourneyKey((k) => k + 1);
            } else {
              setActiveView('achievements');
            }
          }}
          className={`flex-shrink-0 min-h-[44px] p-3 sm:p-4 rounded-2xl border-2 sm:border-[3px] border-black transition-all ${
            isAchievements
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-neo'
              : 'bg-white text-gray-400 motion-safe:hover:text-amber-500 motion-safe:hover:border-amber-400 shadow-neo'
          }`}
        >
          <Trophy className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Placement test (first entry for this operation) */}
      {!hasProgress && activeView !== 'achievements' && (
        <MathsPlacementTest
          kidToken={kidToken}
          operation={operation}
          onComplete={handlePlacementComplete}
          onBack={() => {
            // If they back out of placement, stay on the subject page but
            // pretend they have progress so the journey renders (empty state).
            setHasProgress(true);
            setActiveView('journey');
          }}
        />
      )}

      {/* Journey view */}
      {hasProgress && activeView === 'journey' && (
        <MathsJourney
          key={`journey-${operation}-${journeyKey}`}
          kidToken={kidToken}
          operation={operation}
          onStartLearn={(t) => {
            setActiveTableNumber(t);
            setActiveView('learn');
          }}
          onStartPractice={(t) => {
            setActiveTableNumber(t);
            setActiveView('practice');
          }}
          onStartProve={(t) => {
            setActiveTableNumber(t);
            setActiveView('prove');
          }}
        />
      )}

      {/* Learn stage — uses MathsAILesson (FHS-389) */}
      {activeView === 'learn' && (
        <MathsAILesson
          kidToken={kidToken}
          operation={operation}
          tableNumber={activeTableNumber}
          onComplete={() => void handleLearnComplete()}
          onBack={() => setActiveView('journey')}
        />
      )}

      {/* Practice stage — MathsTablePractice (PR3) */}
      {activeView === 'practice' && !showPracticeComplete && (
        <MathsTablePractice
          operation={operation}
          tableNumber={activeTableNumber}
          onComplete={(correct) => void handlePracticeComplete(correct)}
          onBack={() => setActiveView('journey')}
        />
      )}

      {/* Practice stage complete — celebrate then offer Prove (PR4 seam) */}
      {activeView === 'practice' && showPracticeComplete && (
        <MathsStageComplete
          operation={operation}
          tableNumber={activeTableNumber}
          completedStage="practice"
          practiceCorrect={lastPracticeCorrect}
          onContinue={() => {
            setShowPracticeComplete(false);
            setActiveView('prove');
          }}
          onBackToJourney={() => {
            setShowPracticeComplete(false);
            setActiveView('journey');
            setJourneyKey((k) => k + 1);
          }}
        />
      )}

      {/* Prove stage — PR4 seam */}
      {activeView === 'prove' && (
        <ComingSoonCard stage="Prove It" onBack={() => setActiveView('journey')} />
      )}

      {/* Achievements (placeholder until certificates view ships) */}
      {activeView === 'achievements' && (
        <div
          data-testid="maths-achievements"
          className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-8 shadow-neo text-center space-y-4"
        >
          <div className="text-5xl" aria-hidden="true">
            🏆
          </div>
          <h3 className="font-black text-xl text-gray-800">Your Certificates</h3>
          <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">
            Earn certificates by mastering each table through Learn, Practice, and Prove.
          </p>
          <p className="text-xs text-gray-400 font-bold">Full certificates view — coming soon!</p>
          <button
            data-testid="achievements-back"
            type="button"
            onClick={() => {
              setActiveView('journey');
              setJourneyKey((k) => k + 1);
            }}
            className="min-h-[44px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all"
          >
            ← Back to Journey
          </button>
        </div>
      )}
    </div>
  );
}
