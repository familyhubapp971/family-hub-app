import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CurrencyPicker,
  Input,
  Label,
  Select,
  StepperHeader,
  TimezonePicker,
  detectBrowserCurrency,
  detectBrowserTimezone,
} from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';

// FHS-36 / FHS-37 — OnboardingWizard at /t/:slug/onboarding.
//
// Multi-step wizard the founding admin walks through once per family
// right after signup. Local state until the very end; one POST to
// /api/onboarding/complete on the final step. Returning users with
// `tenant.onboarding_completed === true` are bounced to /dashboard
// before the wizard ever paints.
//
// Steps:
//   1. Welcome
//   2. Add 1–8 members (name + role + emoji)
//   3. Pick timezone (FHS-38 will replace the textarea-style input
//      with a proper IANA picker)
//   4. Pick currency (FHS-39 will replace with an ISO 4217 picker)
//   5. Done — POSTs everything, redirects to /dashboard

const STEPS = ['Welcome', 'Members', 'Timezone', 'Currency', 'Done'] as const;

const ROLE_OPTIONS = [
  { value: 'adult', label: 'Adult' },
  { value: 'teen', label: 'Teen' },
  { value: 'child', label: 'Child' },
  { value: 'guest', label: 'Guest' },
] as const;

const EMOJI_PALETTE = ['👩', '👨', '👧', '👦', '🧒', '👵', '👴', '🐱', '🐶', '⭐'];

interface WizardMember {
  // Local-only id so React can key the rows; never sent to the server.
  uiId: string;
  displayName: string;
  role: 'adult' | 'teen' | 'child' | 'guest';
  avatarEmoji?: string;
}

function makeUiId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type Status =
  | { kind: 'loading' }
  | { kind: 'gated' } // user has completed onboarding — redirecting
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

interface MeResponse {
  tenants: Array<{ slug: string; onboardingCompleted: boolean }>;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [step, setStep] = useState(1);
  const [members, setMembers] = useState<WizardMember[]>([
    { uiId: makeUiId(), displayName: '', role: 'adult' },
  ]);
  const [timezone, setTimezone] = useState<string>(() => detectBrowserTimezone());
  const [currency, setCurrency] = useState<string>(() => detectBrowserCurrency());

  // Gate check on mount: hit /api/me, find this slug in tenants[],
  // bounce to /dashboard if onboarding_completed=true. Renders the
  // wizard only for first-timers.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          // 401/403 → bail out, AuthProvider will route to /login.
          if (!cancelled) setStatus({ kind: 'ready' });
          return;
        }
        const body = (await res.json()) as MeResponse;
        const t = body.tenants.find((x) => x.slug === slug);
        if (!cancelled) {
          if (t && t.onboardingCompleted) {
            setStatus({ kind: 'gated' });
            navigate(`/t/${slug}/dashboard`, { replace: true });
          } else {
            setStatus({ kind: 'ready' });
          }
        }
      } catch {
        // Network blip — let the user see the wizard; the final
        // submit will surface any real backend issue.
        if (!cancelled) setStatus({ kind: 'ready' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, slug, navigate]);

  const stepLabel = STEPS[step - 1] ?? '';
  const isFinalStep = step === STEPS.length;
  const canAdvance = useMemo(() => {
    if (step === 2) {
      return (
        members.length >= 1 &&
        members.length <= 8 &&
        members.every((m) => m.displayName.trim().length >= 1)
      );
    }
    if (step === 3) return timezone.trim().length > 0;
    if (step === 4) return /^[A-Z]{3}$/.test(currency);
    return true;
  }, [step, members, timezone, currency]);

  function addMember() {
    if (members.length >= 8) return;
    setMembers((prev) => [...prev, { uiId: makeUiId(), displayName: '', role: 'adult' }]);
  }

  function removeMember(uiId: string) {
    setMembers((prev) => (prev.length === 1 ? prev : prev.filter((m) => m.uiId !== uiId)));
  }

  function patchMember(uiId: string, patch: Partial<WizardMember>) {
    setMembers((prev) => prev.map((m) => (m.uiId === uiId ? { ...m, ...patch } : m)));
  }

  async function submit() {
    if (!session) return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-tenant-slug': slug,
        },
        body: JSON.stringify({
          timezone,
          currency,
          members: members.map((m) => ({
            displayName: m.displayName.trim(),
            role: m.role,
            ...(m.avatarEmoji ? { avatarEmoji: m.avatarEmoji } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
        setStatus({
          kind: 'error',
          message: body.detail ?? body.error ?? `Server returned ${res.status}`,
        });
        return;
      }
      navigate(`/t/${slug}/dashboard`, { replace: true });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error — try again.',
      });
    }
  }

  if (status.kind === 'loading' || status.kind === 'gated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kingdom-bg p-6 font-body text-white">
        <p data-testid="onboarding-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg p-6 font-body text-white">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-2 font-heading text-3xl text-yellow-300">Set up your family</h1>
        <p className="mb-6 text-purple-100">
          A few quick choices and we&rsquo;ll have your hub ready. Step {step} of {STEPS.length} —{' '}
          <span className="font-bold text-white">{stepLabel}</span>.
        </p>

        <StepperHeader
          steps={STEPS.length}
          current={step}
          labels={[...STEPS]}
          testId="onboarding-stepper"
        />

        <Card className="mt-8 bg-white p-6 text-gray-900 md:p-8" data-testid="onboarding-card">
          {step === 1 && (
            <div data-testid="onboarding-step-welcome">
              <h2 className="mb-3 font-heading text-2xl">Welcome aboard.</h2>
              <p className="mb-4 font-bold text-gray-700">
                Five quick steps and your family is good to go. Add the people in your family, pick
                your time zone and currency, and you&rsquo;re live.
              </p>
              <p className="text-sm text-gray-600">
                You can always change any of this later from settings.
              </p>
            </div>
          )}

          {step === 2 && (
            <div data-testid="onboarding-step-members">
              <h2 className="mb-3 font-heading text-2xl">Who&rsquo;s in the family?</h2>
              <p className="mb-4 font-bold text-gray-600">
                Add 1–8 people. You can always invite more later.
              </p>
              <ul className="space-y-3" data-testid="onboarding-members-list">
                {members.map((m, idx) => (
                  <li
                    key={m.uiId}
                    className="rounded-md border-2 border-black bg-yellow-50 p-3 shadow-neo-sm"
                    data-testid={`onboarding-member-${idx}`}
                  >
                    <div className="grid gap-3 md:grid-cols-[1fr,140px,90px,40px]">
                      <div>
                        <Label htmlFor={`member-name-${m.uiId}`}>Name</Label>
                        <Input
                          id={`member-name-${m.uiId}`}
                          value={m.displayName}
                          onChange={(e) => patchMember(m.uiId, { displayName: e.target.value })}
                          placeholder="e.g. Iman"
                          testId={`onboarding-member-name-${idx}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`member-role-${m.uiId}`}>Role</Label>
                        <Select
                          id={`member-role-${m.uiId}`}
                          value={m.role}
                          onChange={(e) =>
                            patchMember(m.uiId, { role: e.target.value as WizardMember['role'] })
                          }
                          data-testid={`onboarding-member-role-${idx}`}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`member-emoji-${m.uiId}`}>Emoji</Label>
                        <Select
                          id={`member-emoji-${m.uiId}`}
                          value={m.avatarEmoji ?? ''}
                          onChange={(e) => {
                            // exactOptionalPropertyTypes wants the key
                            // omitted (not set-to-undefined) when the
                            // user clears the picker.
                            const next = e.target.value;
                            setMembers((prev) =>
                              prev.map((row) => {
                                if (row.uiId !== m.uiId) return row;
                                if (next) return { ...row, avatarEmoji: next };
                                const cleared: WizardMember = {
                                  uiId: row.uiId,
                                  displayName: row.displayName,
                                  role: row.role,
                                };
                                return cleared;
                              }),
                            );
                          }}
                          data-testid={`onboarding-member-emoji-${idx}`}
                        >
                          <option value="">—</option>
                          {EMOJI_PALETTE.map((emoji) => (
                            <option key={emoji} value={emoji}>
                              {emoji}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => removeMember(m.uiId)}
                          disabled={members.length === 1}
                          className="rounded-md border-2 border-black bg-red-200 p-2 text-black shadow-neo-sm transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Remove member ${idx + 1}`}
                          data-testid={`onboarding-member-remove-${idx}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={addMember}
                disabled={members.length >= 8}
                testId="onboarding-add-member"
                className="mt-4"
              >
                + Add another
              </Button>
            </div>
          )}

          {step === 3 && (
            <div data-testid="onboarding-step-timezone">
              <h2 className="mb-3 font-heading text-2xl">Where in the world?</h2>
              <p className="mb-4 font-bold text-gray-600">
                We default to your browser&rsquo;s timezone — change it if you&rsquo;re setting this
                up for someone elsewhere.
              </p>
              <Label htmlFor="onboarding-timezone-trigger">Timezone</Label>
              <TimezonePicker
                id="onboarding-timezone-trigger"
                value={timezone}
                onChange={setTimezone}
                testId="onboarding-timezone"
              />
            </div>
          )}

          {step === 4 && (
            <div data-testid="onboarding-step-currency">
              <h2 className="mb-3 font-heading text-2xl">Pick a currency</h2>
              <p className="mb-4 font-bold text-gray-600">
                We&rsquo;ll show prices and rewards in this currency. Inferred from your
                browser&rsquo;s region — change it if it&rsquo;s wrong.
              </p>
              <Label htmlFor="onboarding-currency-trigger">Currency</Label>
              <CurrencyPicker
                id="onboarding-currency-trigger"
                value={currency}
                onChange={setCurrency}
                testId="onboarding-currency"
              />
            </div>
          )}

          {step === 5 && (
            <div data-testid="onboarding-step-done">
              <h2 className="mb-3 font-heading text-2xl">All set?</h2>
              <p className="mb-4 font-bold text-gray-600">
                You&rsquo;re about to add <span className="text-black">{members.length}</span>{' '}
                family member{members.length === 1 ? '' : 's'}, set your timezone to{' '}
                <span className="text-black">{timezone}</span>, and pick{' '}
                <span className="text-black">{currency}</span> as your currency.
              </p>
              <p className="mb-4 text-sm text-gray-600">
                Click <strong>Finish setup</strong> to land on your dashboard. You can edit any of
                this later from settings.
              </p>
            </div>
          )}

          {status.kind === 'error' && (
            <p
              className="mt-4 text-sm font-bold text-red-600"
              role="alert"
              data-testid="onboarding-error"
            >
              {status.message}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || status.kind === 'submitting'}
              testId="onboarding-back"
            >
              Back
            </Button>
            {isFinalStep ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={submit}
                disabled={status.kind === 'submitting'}
                testId="onboarding-finish"
              >
                {status.kind === 'submitting' ? 'Setting up…' : 'Finish setup'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
                disabled={!canAdvance}
                testId="onboarding-next"
              >
                Next →
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
