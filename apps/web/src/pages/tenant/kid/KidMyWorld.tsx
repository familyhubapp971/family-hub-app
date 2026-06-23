import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Check, ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react';
import { useKidMyWorld } from './myworld/useKidMyWorld';
import { weekRangeLabel } from './myworld/icons';
import { KidHabitCard } from './myworld/KidHabitCard';
import { KidMoneySkills } from './myworld/KidMoneySkills';
import { KidRewardShop } from './myworld/KidRewardShop';
import { KidWeeklyAccount } from './myworld/KidWeeklyAccount';
import { KidStats } from './myworld/KidStats';

// FHS-376 — the dedicated kid "My World". A DISTINCT design from the parent's
// MyWorldTab (which this no longer reuses): a Weekly Habits / Analytics toggle,
// the kid's own week banner + read-only habit cards, a Money Skills explainer,
// and a Reward Goals + My Account sidebar — all pixel-matched to the Magic
// Patterns kid mock and fed by the self-scoped /api/kid/* endpoints.

type View = 'habits' | 'analytics';

export function KidMyWorld({
  kidToken,
  displayName,
}: {
  kidToken: string | null;
  displayName: string;
}) {
  const [view, setView] = useState<View>('habits');
  // Only the first successful load plays the slide-in; a retry/remount (e.g.
  // after the error state) should not re-animate (FHS-377).
  const animatedOnce = useRef(false);
  const data = useKidMyWorld(kidToken);

  if (data.status === 'loading') {
    return (
      <div
        data-testid="kid-myworld-loading"
        aria-busy="true"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <Sparkles
          size={36}
          className="mx-auto text-pink-400 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <p className="mt-3 font-heading uppercase tracking-wide text-gray-700">
          Loading your world…
        </p>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div
        data-testid="kid-myworld-error"
        role="alert"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <p className="text-5xl" aria-hidden="true">
          😕
        </p>
        <p className="mt-3 font-heading uppercase tracking-wide text-gray-700">
          We couldn&rsquo;t load your world
        </p>
        <button
          type="button"
          onClick={data.reload}
          className="mt-4 rounded-lg border-2 border-black bg-pink-400 px-5 py-2.5 font-heading text-sm uppercase text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
        >
          Try again
        </button>
      </div>
    );
  }

  const week = data.weeks[data.weekIndex];
  const doneThisView = data.habits.reduce((sum, h) => sum + h.progress, 0);
  const totalThisView = data.habits.length * 7;

  // ── economy-derived numbers ──────────────────────────────────────────────
  const savedStickers = data.savings?.savedStickers ?? 0;
  const savedCash = data.savings?.savedCash ?? 0;
  const currency = data.savings?.currency ?? data.currency;
  // FHS-376 — a reward request is paid from SAVINGS on approval, so Reward Goals
  // affordability + "more to go" are measured against savings (banked stars +
  // banked cash at 0.5/star), not the spendable week balance.
  const savingsStars = savedStickers + Math.floor(savedCash / 0.5);
  const planted = data.investments.reduce((s, inv) => s + inv.originalInvestedStickers, 0);
  const bonus = Math.max(
    0,
    data.investments.reduce(
      (s, inv) => s + (inv.currentValueStickers - inv.originalInvestedStickers),
      0,
    ),
  );

  // My Account "earned this week" = sum of the live week's habit progress.
  const earnedThisWeek = doneThisView;
  const weeklyValue = (earnedThisWeek * 0.5).toFixed(2);

  const playEnter = !animatedOnce.current;
  animatedOnce.current = true;
  const panelLabelId = view === 'habits' ? 'kid-myworld-tab-habits' : 'kid-myworld-tab-analytics';

  return (
    <motion.div
      data-testid="kid-myworld"
      className="grid grid-cols-1 gap-6 xl:grid-cols-12"
      initial={playEnter ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* LEFT column */}
      <div className="flex flex-col gap-4 xl:col-span-8">
        {/* Toggle */}
        <div
          role="tablist"
          aria-label="My World view"
          className="flex gap-1 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-sm"
        >
          <button
            type="button"
            role="tab"
            id="kid-myworld-tab-habits"
            aria-controls="kid-myworld-panel"
            aria-selected={view === 'habits'}
            data-testid="kid-myworld-habits-tab"
            onClick={() => setView('habits')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm uppercase tracking-wide transition-colors ${
              view === 'habits'
                ? 'border-2 border-black bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'border-2 border-transparent text-gray-500'
            }`}
          >
            <Check size={16} aria-hidden="true" /> Weekly Habits
          </button>
          <button
            type="button"
            role="tab"
            id="kid-myworld-tab-analytics"
            aria-controls="kid-myworld-panel"
            aria-selected={view === 'analytics'}
            data-testid="kid-myworld-stats-tab"
            onClick={() => setView('analytics')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm uppercase tracking-wide transition-colors ${
              view === 'analytics'
                ? 'border-2 border-black bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'border-2 border-transparent text-gray-500'
            }`}
          >
            <BarChart2 size={16} aria-hidden="true" /> Analytics
          </button>
        </div>

        <div
          role="tabpanel"
          id="kid-myworld-panel"
          aria-labelledby={panelLabelId}
          tabIndex={0}
          className="flex flex-col gap-4 focus:outline-none"
        >
          {view === 'habits' ? (
            <>
              {/* Week banner */}
              {week && (
                <div className="flex items-center gap-3 rounded-xl border-2 border-black bg-gradient-to-br from-[#6b21a8] to-[#7e22ce] p-6 text-white shadow-neo-sm">
                  <button
                    type="button"
                    aria-label="Previous week"
                    data-testid="kid-week-prev"
                    onClick={data.goPrevWeek}
                    disabled={data.weekIndex === 0}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-black transition-transform disabled:opacity-30 motion-safe:hover:-translate-y-0.5"
                  >
                    <ChevronLeft size={20} strokeWidth={3} aria-hidden="true" />
                  </button>

                  <div className="flex-1 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="font-heading text-xl uppercase tracking-wide">
                        Week {week.weekNumber}, {week.year}
                      </h2>
                      <span
                        className={`rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase ${
                          week.isFinalized ? 'bg-green-300 text-black' : 'bg-yellow-300 text-black'
                        }`}
                      >
                        {week.isFinalized ? '✓ Finalized' : 'Current'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-purple-200">
                      {weekRangeLabel(week.startDate)}
                    </p>
                    <p className="mt-1 font-heading text-sm text-yellow-300">
                      {doneThisView}/{totalThisView} DONE ✨
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Next week"
                    data-testid="kid-week-next"
                    onClick={data.goNextWeek}
                    disabled={data.isCurrentWeek}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-black transition-transform disabled:opacity-30 motion-safe:hover:-translate-y-0.5"
                  >
                    <ChevronRight size={20} strokeWidth={3} aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* My Habits label row */}
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-black bg-pink-300 shadow-neo-xs">
                  <Star size={16} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="font-heading text-sm uppercase tracking-widest text-pink-300">
                  My Habits
                </span>
                <span className="h-0.5 flex-1 rounded-full bg-pink-200" aria-hidden="true" />
              </div>

              {/* How are you doing this week */}
              <div className="flex items-center gap-4 rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-black bg-yellow-100 text-3xl">
                  <span aria-hidden="true">🎯</span>
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-base text-black">
                    How are you doing this week?
                  </h3>
                  <p className="mt-1 text-sm font-bold text-gray-700">
                    You&rsquo;ve completed {doneThisView} out of {totalThisView} habit days! Keep it
                    up!
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={doneThisView}
                    aria-valuemin={0}
                    aria-valuemax={totalThisView}
                    aria-label="Habit days completed this week"
                    className="mt-2 h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                  >
                    <div
                      className="h-full bg-green-400"
                      style={{
                        width: `${totalThisView > 0 ? (doneThisView / totalThisView) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Habit cards — spinner while a navigated week loads, retry on
                failure, then the real empty/cards state (FHS-377). */}
              {data.viewWeekStatus === 'loading' ? (
                <div
                  data-testid="kid-week-loading"
                  aria-busy="true"
                  className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
                >
                  <Sparkles
                    size={32}
                    className="mx-auto text-pink-400 motion-safe:animate-pulse"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-bold text-gray-600">Loading this week…</p>
                </div>
              ) : data.viewWeekStatus === 'error' ? (
                <div
                  data-testid="kid-week-error"
                  role="alert"
                  className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
                >
                  <p className="text-4xl" aria-hidden="true">
                    😕
                  </p>
                  <p className="mt-3 text-sm font-bold text-gray-600">
                    We couldn&rsquo;t load this week.
                  </p>
                  <button
                    type="button"
                    data-testid="kid-week-retry"
                    onClick={data.retryWeek}
                    className="mt-4 rounded-lg border-2 border-black bg-pink-400 px-5 py-2.5 font-heading text-sm uppercase text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
                  >
                    Try again
                  </button>
                </div>
              ) : data.habits.length === 0 ? (
                <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm">
                  <p className="text-5xl" aria-hidden="true">
                    🌱
                  </p>
                  <p className="mt-3 text-sm font-bold text-gray-600">
                    No habits yet — ask a grown-up to add some!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {data.habits.map((h) => (
                    <KidHabitCard key={h.id} habit={h} isCurrentWeek={data.isCurrentWeek} />
                  ))}
                </div>
              )}

              {/* Money skills */}
              <KidMoneySkills
                stickerBalance={data.balance}
                savedStickers={savedStickers}
                savedCash={savedCash}
                currency={currency}
                planted={planted}
                bonus={bonus}
                hasInvestments={data.investments.length > 0}
              />
            </>
          ) : (
            <KidStats
              name={displayName}
              analytics={data.analytics}
              habits={data.habits}
              savedCash={savedCash}
              currency={currency}
            />
          )}
        </div>
      </div>

      {/* RIGHT column */}
      <div className="flex flex-col gap-6 xl:col-span-4">
        <KidRewardShop
          rewards={data.rewards}
          savingsStars={savingsStars}
          onRequest={data.requestReward}
        />
        <KidWeeklyAccount
          habits={data.habits}
          earnedThisWeek={earnedThisWeek}
          weeklyValue={weeklyValue}
          currency={currency}
        />
      </div>
    </motion.div>
  );
}
