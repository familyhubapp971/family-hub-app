import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@familyhub/ui';

// FHS-419 — branded full-screen loader. Replaces the bare grey "Loading…" /
// "Signing you in…" states (which looked broken on the dark bg) with the
// kingdom starfield, a pulsing FamilyHub mark, and rotating reassurance copy.
// Reused for the magic-link callback, the protected-route session load, and
// the kid family load. Degrades fully under prefers-reduced-motion.

type LoadingContext = 'callback' | 'protected' | 'kid';

const MESSAGES: Record<LoadingContext, string[]> = {
  callback: [
    "Getting your family's space ready…",
    'Checking in with the hub…',
    'Almost there — just a moment!',
    "Pulling up your family's world…",
    'Fetching the latest from your hub…',
  ],
  protected: [
    'Picking up where you left off…',
    'Checking in with the hub…',
    'Almost there — just a moment!',
    'Loading your dashboard…',
    'Fetching the latest from your hub…',
  ],
  kid: [
    'Loading your world…',
    'Checking your streaks…',
    'Getting your tasks ready…',
    'Almost there!',
    'Your family hub is loading…',
  ],
};

const ARIA_LABEL: Record<LoadingContext, string> = {
  callback: 'Signing in to FamilyHub',
  protected: 'Loading FamilyHub',
  kid: 'Loading your world',
};

// If neither a session nor an error arrives within this window, surface the
// error state so the user is never stranded on an infinite loader.
const TIMEOUT_MS = 15_000;

export function LoadingScreen({
  context = 'callback',
  error = null,
  onRetry,
}: {
  context?: LoadingContext;
  error?: { message: string } | null;
  onRetry?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const messages = MESSAGES[context];
  const [index, setIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // Rotate the reassurance message (skipped under reduced motion).
  useEffect(() => {
    if (reduceMotion || error) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), 2800);
    return () => clearInterval(id);
  }, [reduceMotion, error, messages.length]);

  // Safety timeout so the loader can't spin forever.
  useEffect(() => {
    if (error) return;
    const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [error]);

  const isError = Boolean(error) || timedOut;
  const errorMessage = error?.message ?? 'Something went wrong — please try again.';

  return (
    <div
      role="main"
      aria-label={ARIA_LABEL[context]}
      className="space-bg flex min-h-screen flex-col items-center justify-center px-4"
      data-testid="loading-screen"
    >
      {/* Brand link top-left, matching the auth shell. */}
      <Link
        to="/"
        className="absolute left-6 top-6 font-heading text-2xl text-white transition-opacity hover:opacity-90 sm:left-10 sm:top-8"
      >
        FamilyHub
      </Link>

      <div className="flex flex-col items-center gap-4 text-center">
        {/* Brand mark — heartbeat pulse (static under reduced motion). */}
        <motion.div
          aria-label="FamilyHub logo"
          className="grid h-20 w-20 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-pink-400 to-purple-500 shadow-neo-lg"
          {...(reduceMotion || isError
            ? {}
            : {
                animate: { scale: [1, 1.06, 1] },
                transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
              })}
        >
          <span className="font-heading text-4xl text-white" aria-hidden="true">
            F
          </span>
        </motion.div>

        {/* App name + rule — fade in once. */}
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        >
          <h2 className="font-heading text-4xl text-white">FamilyHub</h2>
          <span
            className={`h-1 w-10 rounded-full ${isError ? 'bg-red-400' : 'bg-yellow-400'}`}
            aria-hidden="true"
          />
        </motion.div>

        {isError ? (
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-xs font-body text-sm text-red-300" role="alert">
              {errorMessage}
            </p>
            {onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry} testId="loading-retry">
                Try again
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm" testId="loading-back-to-login">
                  Back to login
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="font-heading text-xl text-white">Signing you in…</p>
            <div
              className="min-h-[1.25rem] max-w-xs font-body text-sm text-white/80"
              role="status"
              aria-live="polite"
            >
              {reduceMotion ? (
                <span>{messages[0]}</span>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {messages[index]}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
