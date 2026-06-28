/**
 * BetaFeedbackWidget — FHS-418 (frontend)
 *
 * A floating "Give feedback" button fixed to the bottom-right of every
 * signed-in /t/:slug/* page. Opens a friendly dialog where beta testers
 * answer a few optional questions and submit to POST /api/feedback.
 *
 * Mounted once in ProtectedRoute. Hidden when:
 *  - no Supabase parent session (kid-JWT-only or logged-out), OR
 *  - no tenant slug in the URL (legacy /dashboard, /me routes where the
 *    API would return 400 TENANT_REQUIRED without x-tenant-slug).
 */

import { useState, useCallback, useId } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button, Dialog } from '@familyhub/ui';
import { useAuth } from '../lib/auth-context';
import { API_BASE } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type PmfChoice = 'very' | 'somewhat' | 'not';

interface FeedbackBody {
  pmfDisappointment?: PmfChoice;
  recommendScore?: number;
  solvesProblem?: number;
  easeOfUse?: number;
  keepUsing?: number;
  painPoint?: string;
  featureRequest?: string;
  otherFeedback?: string;
}

const MAX_CHARS = 2000;

// ── PMF disappointment buttons ────────────────────────────────────────────────

const PMF_OPTIONS: { label: string; value: PmfChoice; testId: string }[] = [
  { label: 'Very disappointed', value: 'very', testId: 'beta-feedback-pmf-very' },
  { label: 'Somewhat disappointed', value: 'somewhat', testId: 'beta-feedback-pmf-somewhat' },
  { label: 'Not disappointed', value: 'not', testId: 'beta-feedback-pmf-not' },
];

// ── Character counter ─────────────────────────────────────────────────────────

function CharCount({ value }: { value: string }) {
  const len = value.length;
  const near = len > MAX_CHARS * 0.85;
  return (
    <span className={`text-xs ${near ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
      {len}/{MAX_CHARS}
    </span>
  );
}

// ── Rating row (1..N tappable numbers) ───────────────────────────────────────

function RatingRow({
  max,
  value,
  onChange,
  lowLabel,
  highLabel,
  testIdPrefix,
}: {
  max: number;
  value: number | undefined;
  onChange: (n: number) => void;
  lowLabel?: string;
  highLabel?: string;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(n)}
              data-testid={`${testIdPrefix}-${n}`}
              className={[
                'flex h-11 min-w-[44px] items-center justify-center rounded-xl border-2 border-black px-2 text-sm font-black transition-all',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
                selected
                  ? 'bg-pink-400 text-black shadow-neo-sm'
                  : 'bg-white text-black hover:bg-yellow-100',
              ].join(' ')}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(lowLabel ?? highLabel) && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Recommend row (0..10) ─────────────────────────────────────────────────────
// End labels sit on their own line above the number grid so the 11 buttons
// can wrap to two centered rows on 375 px mobile without looking broken.

function RecommendRow({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      {/* End labels — always on their own line */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      {/* Buttons wrap and center when they overflow one line */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: 11 }, (_, i) => {
          const selected = value === i;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(i)}
              data-testid={`beta-feedback-recommend-${i}`}
              className={[
                'flex h-10 min-w-[36px] items-center justify-center rounded-xl border-2 border-black px-1.5 text-sm font-black transition-all',
                'sm:h-11 sm:min-w-[40px]',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
                selected
                  ? 'bg-pink-400 text-black shadow-neo-sm'
                  : 'bg-white text-black hover:bg-yellow-100',
              ].join(' ')}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Textarea with counter ─────────────────────────────────────────────────────

function CountedTextarea({
  id,
  testId,
  rows,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  testId: string;
  rows: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <textarea
        id={id}
        data-testid={testId}
        rows={rows}
        value={value}
        maxLength={MAX_CHARS}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 border-black p-3 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400"
      />
      <div className="flex justify-end">
        <CharCount value={value} />
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function BetaFeedbackWidget() {
  const { session } = useAuth();
  const titleId = useId();

  // Read :slug from the URL — present on /t/:slug/* routes, absent on legacy
  // routes like /dashboard and /me. useParams is safe to call outside a
  // matching route; it just returns an empty object.
  const { slug: tenantSlug } = useParams<{ slug?: string }>();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Answers
  const [pmf, setPmf] = useState<PmfChoice | undefined>();
  const [recommend, setRecommend] = useState<number | undefined>();
  const [solves, setSolves] = useState<number | undefined>();
  const [ease, setEase] = useState<number | undefined>();
  const [keep, setKeep] = useState<number | undefined>();
  const [pain, setPain] = useState('');
  const [feature, setFeature] = useState('');
  const [other, setOther] = useState('');

  // Submit enabled when at least one answer provided.
  // Use !== undefined (not truthiness) so recommendScore = 0 counts.
  const hasAnswer =
    pmf !== undefined ||
    recommend !== undefined ||
    solves !== undefined ||
    ease !== undefined ||
    keep !== undefined ||
    pain.trim() !== '' ||
    feature.trim() !== '' ||
    other.trim() !== '';

  const resetForm = useCallback(() => {
    setPmf(undefined);
    setRecommend(undefined);
    setSolves(undefined);
    setEase(undefined);
    setKeep(undefined);
    setPain('');
    setFeature('');
    setOther('');
    setState('idle');
    setErrorMsg('');
  }, []);

  const handleOpen = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!hasAnswer || state === 'submitting') return;
    setState('submitting');
    setErrorMsg('');

    const body: FeedbackBody = {};
    if (pmf !== undefined) body.pmfDisappointment = pmf;
    if (recommend !== undefined) body.recommendScore = recommend;
    if (solves !== undefined) body.solvesProblem = solves;
    if (ease !== undefined) body.easeOfUse = ease;
    if (keep !== undefined) body.keepUsing = keep;
    if (pain.trim()) body.painPoint = pain.trim();
    if (feature.trim()) body.featureRequest = feature.trim();
    if (other.trim()) body.otherFeedback = other.trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    if (tenantSlug) {
      headers['x-tenant-slug'] = tenantSlug;
    }

    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.status === 201 || res.ok) {
        setState('success');
      } else {
        let msg = 'Something went wrong. Please try again.';
        try {
          const j = (await res.json()) as { error?: string; message?: string };
          if (j.error ?? j.message) msg = String(j.error ?? j.message);
        } catch {
          // ignore
        }
        setState('error');
        setErrorMsg(msg);
      }
    } catch {
      setState('error');
      setErrorMsg('Could not reach the server. Check your connection and try again.');
    }
  }, [
    hasAnswer,
    state,
    pmf,
    recommend,
    solves,
    ease,
    keep,
    pain,
    feature,
    other,
    session,
    tenantSlug,
  ]);

  // Hide when no parent session or no tenant slug — without the slug the
  // API rejects the request with 400 TENANT_REQUIRED.
  if (!session || !tenantSlug) return null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        aria-label="Give feedback"
        onClick={handleOpen}
        data-testid="beta-feedback-button"
        className={[
          'fixed bottom-6 right-6 z-40',
          'flex items-center gap-2 rounded-2xl border-2 border-black bg-pink-400 px-4 py-3',
          'font-black text-sm text-black shadow-neo',
          'transition-all duration-150',
          'motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-neo-md',
          'active:translate-y-1 active:shadow-none',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-600 focus-visible:ring-offset-2',
        ].join(' ')}
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Give feedback</span>
      </button>

      {/* Dialog */}
      <Dialog
        isOpen={open}
        onClose={handleClose}
        testId="beta-feedback-dialog"
        ariaLabelledBy={titleId}
      >
        <div className="relative w-full max-w-lg rounded-2xl border-2 border-black bg-white shadow-neo-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 rounded-t-2xl border-b-2 border-black bg-pink-400 px-5 py-4">
            <h2 id={titleId} className="font-display text-xl font-black text-black">
              Help shape Family Hub
            </h2>
            <p className="mt-0.5 text-sm font-medium text-black/80">
              You&apos;re a beta tester — tell us how it&apos;s going (takes ~1 min).
            </p>
            <button
              type="button"
              aria-label="Close feedback dialog"
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-lg border-2 border-black bg-white p-1 text-black hover:bg-yellow-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-600"
            >
              <span aria-hidden="true" className="block h-5 w-5 text-center font-black leading-5">
                ✕
              </span>
            </button>
          </div>

          {/* Body */}
          {state === 'success' ? (
            <div
              className="flex flex-col items-center gap-4 px-5 py-10 text-center"
              data-testid="beta-feedback-thanks"
            >
              <span className="text-5xl" aria-hidden="true">
                🎉
              </span>
              <h3 className="font-display text-2xl font-black">Thank you!</h3>
              <p className="text-gray-700">
                Your feedback helps us build a better Family Hub for every family. We really
                appreciate you taking the time.
              </p>
              <Button onClick={handleClose} variant="primary">
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-6 px-5 py-5">
              {/* Q1 — PMF */}
              <fieldset>
                <legend className="mb-2 font-black text-sm text-black">
                  How would you feel if you could no longer use Family Hub?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {PMF_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={pmf === opt.value}
                      onClick={() => setPmf(pmf === opt.value ? undefined : opt.value)}
                      data-testid={opt.testId}
                      className={[
                        'flex min-h-[44px] items-center justify-center rounded-xl border-2 border-black px-4 py-2 text-sm font-black transition-all',
                        'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
                        pmf === opt.value
                          ? 'bg-pink-400 text-black shadow-neo-sm'
                          : 'bg-white text-black hover:bg-yellow-100',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Q2 — Recommend (0..10) */}
              <fieldset>
                <legend className="mb-2 font-black text-sm text-black">
                  How likely are you to recommend it to another family?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </legend>
                <RecommendRow value={recommend} onChange={setRecommend} />
              </fieldset>

              {/* Q3 — Solves a problem (1..5) */}
              <fieldset>
                <legend className="mb-2 font-black text-sm text-black">
                  How well does it solve a real problem for your family?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </legend>
                <RatingRow
                  max={5}
                  value={solves}
                  onChange={(n) => setSolves(solves === n ? undefined : n)}
                  lowLabel="Not at all"
                  highLabel="Extremely well"
                  testIdPrefix="beta-feedback-solves"
                />
              </fieldset>

              {/* Q4 — Ease of use (1..5) */}
              <fieldset>
                <legend className="mb-2 font-black text-sm text-black">
                  How easy is it to use?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </legend>
                <RatingRow
                  max={5}
                  value={ease}
                  onChange={(n) => setEase(ease === n ? undefined : n)}
                  lowLabel="Very hard"
                  highLabel="Very easy"
                  testIdPrefix="beta-feedback-ease"
                />
              </fieldset>

              {/* Q5 — Keep using (1..5) */}
              <fieldset>
                <legend className="mb-2 font-black text-sm text-black">
                  After the beta, how likely are you to keep using it?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </legend>
                <RatingRow
                  max={5}
                  value={keep}
                  onChange={(n) => setKeep(keep === n ? undefined : n)}
                  lowLabel="Not likely"
                  highLabel="Definitely"
                  testIdPrefix="beta-feedback-keep"
                />
              </fieldset>

              {/* Q6 — Pain point */}
              <div>
                <label
                  htmlFor="beta-feedback-pain"
                  className="mb-1 block font-black text-sm text-black"
                >
                  What&apos;s the biggest problem you&apos;re hoping Family Hub solves?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </label>
                <CountedTextarea
                  id="beta-feedback-pain"
                  testId="beta-feedback-pain"
                  rows={3}
                  value={pain}
                  onChange={setPain}
                  placeholder="e.g. Keeping everyone in sync on chores and activities…"
                />
              </div>

              {/* Q7 — Feature request */}
              <div>
                <label
                  htmlFor="beta-feedback-feature"
                  className="mb-1 block font-black text-sm text-black"
                >
                  What&apos;s one feature you wish it had?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </label>
                <CountedTextarea
                  id="beta-feedback-feature"
                  testId="beta-feedback-feature"
                  rows={3}
                  value={feature}
                  onChange={setFeature}
                  placeholder="e.g. A shared shopping list that everyone can add to…"
                />
              </div>

              {/* Q8 — Anything else */}
              <div>
                <label
                  htmlFor="beta-feedback-other"
                  className="mb-1 block font-black text-sm text-black"
                >
                  Anything else?
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </label>
                <CountedTextarea
                  id="beta-feedback-other"
                  testId="beta-feedback-other"
                  rows={3}
                  value={other}
                  onChange={setOther}
                  placeholder="Anything else on your mind…"
                />
              </div>

              {/* Error message */}
              {state === 'error' && (
                <p
                  role="alert"
                  data-testid="beta-feedback-error"
                  className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {errorMsg}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t-2 border-black pt-4">
                <p className="text-xs text-gray-500">Answer at least one question to submit.</p>
                <Button
                  variant="primary"
                  disabled={!hasAnswer || state === 'submitting'}
                  onClick={handleSubmit}
                  testId="beta-feedback-submit"
                >
                  {state === 'submitting' ? 'Sending…' : 'Send feedback'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
