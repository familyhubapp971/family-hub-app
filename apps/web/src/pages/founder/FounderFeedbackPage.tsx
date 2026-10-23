/**
 * FounderFeedbackPage: FHS-672, at /admin.
 *
 * The founder enters the passcode and reads every family's feedback: a
 * per-screen summary, then each person's answers grouped by visit, with
 * filters and a spreadsheet download. The passcode is checked on the server
 * (FOUNDER_PASSCODE); the page only keeps the 8-hour token it gets back, in
 * this browser tab.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@familyhub/ui';
import { API_BASE } from '../../lib/api';
import {
  SOURCE_LABEL,
  groupByPersonAndVisit,
  screenLabel,
  summariseByScreen,
  toCsv,
  type FeedbackRow,
} from '../../lib/founder-feedback';

const TOKEN_KEY = 'fh-founder-token';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing: the page still works until it is reloaded.
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FounderFeedbackPage() {
  const [token, setToken] = useState<string | null>(readToken);
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const signOut = useCallback(() => {
    writeToken(null);
    setToken(null);
    setRows(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadError('');
    fetch(`${API_BASE}/api/founder/feedback`, { headers: { 'x-founder-token': token } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return signOut();
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { rows: FeedbackRow[] };
        if (!cancelled) setRows(body.rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load feedback. Check your connection and refresh.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, signOut]);

  return (
    <div className="min-h-screen bg-kingdom-bg px-4 py-6 text-white sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl uppercase tracking-wide sm:text-3xl">
            Family Hub feedback
          </h1>
          {token && (
            <Button variant="secondary" onClick={signOut} testId="founder-sign-out">
              Lock
            </Button>
          )}
        </header>

        {!token ? (
          <PasscodeForm
            onUnlocked={(t) => {
              writeToken(t);
              setToken(t);
            }}
          />
        ) : loadError ? (
          <p role="alert" className="rounded-xl border-2 border-black bg-red-50 p-4 text-red-700">
            {loadError}
          </p>
        ) : rows === null ? (
          <p className="text-purple-200" data-testid="founder-loading">
            Loading feedback…
          </p>
        ) : (
          <FeedbackView rows={rows} />
        )}
      </div>
    </div>
  );
}

function PasscodeForm({ onUnlocked }: { onUnlocked: (token: string) => void }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy || !passcode) return;
      setBusy(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/founder/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode }),
        });
        if (res.ok) {
          const body = (await res.json()) as { token: string };
          onUnlocked(body.token);
          return;
        }
        if (res.status === 429) {
          const body = (await res.json().catch(() => ({}))) as { retryAfter?: number };
          const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 900) / 60));
          setError(`Too many tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
        } else if (res.status === 404) {
          setError('This page is switched off on this server.');
        } else {
          setError('That passcode is wrong.');
        }
        setPasscode('');
      } catch {
        setError('Could not reach the server. Check your connection and try again.');
      } finally {
        setBusy(false);
      }
    },
    [busy, passcode, onUnlocked],
  );

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-sm rounded-2xl border-2 border-black bg-white p-5 text-black shadow-neo sm:p-6"
    >
      <label htmlFor="founder-passcode" className="mb-3 block font-heading text-xl">
        Enter the passcode
      </label>
      <Input
        id="founder-passcode"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        maxLength={12}
        value={passcode}
        onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'founder-error' : undefined}
        testId="founder-passcode"
      />
      {error && (
        <p
          id="founder-error"
          role="alert"
          className="mt-3 text-sm font-bold text-red-600"
          data-testid="founder-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        disabled={busy || passcode.length === 0}
        testId="founder-open"
        fullWidth
        className="mt-4"
      >
        {busy ? 'Opening…' : 'Open'}
      </Button>
    </form>
  );
}

function Rating({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <span className="rounded-full border-2 border-black bg-yellow-100 px-2.5 py-0.5 text-xs font-bold">
      {label} {value}/5
    </span>
  );
}

function FeedbackView({ rows }: { rows: FeedbackRow[] }) {
  const [source, setSource] = useState<'all' | FeedbackRow['source']>('all');
  const [family, setFamily] = useState('all');
  const [screen, setScreen] = useState('all');

  const families = useMemo(
    () =>
      [
        ...new Set(rows.map((r) => r.familyName ?? r.familySlug).filter(Boolean) as string[]),
      ].sort(),
    [rows],
  );
  const screens = useMemo(
    () => [...new Set(rows.map((r) => r.screen).filter(Boolean) as string[])].sort(),
    [rows],
  );

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (source === 'all' || r.source === source) &&
          (family === 'all' || (r.familyName ?? r.familySlug) === family) &&
          (screen === 'all' || r.screen === screen),
      ),
    [rows, source, family, screen],
  );
  const summary = useMemo(() => summariseByScreen(shown), [shown]);
  const people = useMemo(() => groupByPersonAndVisit(shown), [shown]);

  const download = useCallback(() => {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-hub-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [shown]);

  return (
    <div className="space-y-8">
      <div className="grid gap-3 rounded-2xl border-2 border-black bg-white p-4 text-black shadow-neo sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold">
          Where from
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            testId="founder-filter-source"
          >
            <option value="all">Everywhere</option>
            {(Object.keys(SOURCE_LABEL) as Array<FeedbackRow['source']>).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-bold">
          Family
          <Select
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            testId="founder-filter-family"
          >
            <option value="all">Every family</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-bold">
          Screen
          <Select
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
            testId="founder-filter-screen"
          >
            <option value="all">Every screen</option>
            {screens.map((s) => (
              <option key={s} value={s}>
                {screenLabel(s)}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-end">
          <Button variant="primary" onClick={download} testId="founder-download">
            Download spreadsheet
          </Button>
        </div>
      </div>

      <p className="text-sm text-purple-200" data-testid="founder-count">
        {shown.length} answer{shown.length === 1 ? '' : 's'} from {people.length}{' '}
        {people.length === 1 ? 'person' : 'people'}
      </p>

      <section>
        <h2 className="mb-3 font-heading text-xl">By screen</h2>
        {summary.length === 0 ? (
          <p className="text-purple-200">No per-screen answers yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-black bg-white text-black shadow-neo">
            <table className="w-full min-w-[640px] text-left text-sm" data-testid="founder-summary">
              <thead className="bg-pink-100">
                <tr>
                  <th className="p-3">Screen</th>
                  <th className="p-3">Answers</th>
                  <th className="p-3">People</th>
                  <th className="p-3">Solves a problem</th>
                  <th className="p-3">Easy to use</th>
                  <th className="p-3">Keep using</th>
                  <th className="p-3">Parts mentioned</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.screen} className="border-t-2 border-black/10">
                    <td className="p-3 font-bold">{screenLabel(s.screen)}</td>
                    <td className="p-3">{s.answers}</td>
                    <td className="p-3">{s.people}</td>
                    <td className="p-3">{s.solvesProblem ?? '-'}</td>
                    <td className="p-3">{s.easeOfUse ?? '-'}</td>
                    <td className="p-3">{s.keepUsing ?? '-'}</td>
                    <td className="p-3">
                      {s.features.map((f) => `${f.name} (${f.count})`).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl">Answers by person and visit</h2>
        {people.length === 0 ? (
          <p className="text-purple-200">No feedback matches these filters.</p>
        ) : (
          <div className="space-y-4">
            {people.map((p) => (
              <article
                key={p.key}
                className="rounded-2xl border-2 border-black bg-white p-4 text-black shadow-neo"
                data-testid="founder-person"
              >
                <h3 className="break-words font-heading text-lg">{p.person}</h3>
                {p.family && <p className="text-sm text-gray-600">{p.family}</p>}
                <div className="mt-3 space-y-3">
                  {p.visits.map((v, i) => (
                    <div
                      key={v.visitId ?? `${p.key}-${i}`}
                      className="rounded-xl border-2 border-dashed border-gray-300 p-3"
                      data-testid="founder-visit"
                    >
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        {v.visitId
                          ? `Visit · ${v.rows.length} answer${v.rows.length === 1 ? '' : 's'}`
                          : SOURCE_LABEL[v.rows[0]!.source]}
                      </p>
                      <ul className="space-y-3">
                        {v.rows.map((r, j) => (
                          <li key={`${r.createdAt}-${j}`} className="space-y-1.5">
                            <p className="text-sm font-bold">
                              {r.screen ? screenLabel(r.screen) : SOURCE_LABEL[r.source]}
                              <span className="ml-2 font-normal text-gray-500">
                                {formatWhen(r.createdAt)}
                              </span>
                            </p>
                            {r.features.length > 0 && (
                              <p className="flex flex-wrap gap-1.5">
                                {r.features.map((f) => (
                                  <span
                                    key={f}
                                    className="rounded-full border-2 border-black bg-pink-200 px-2.5 py-0.5 text-xs font-bold"
                                  >
                                    {f}
                                  </span>
                                ))}
                              </p>
                            )}
                            <p className="flex flex-wrap gap-1.5">
                              <Rating label="Solves" value={r.solvesProblem} />
                              <Rating label="Easy" value={r.easeOfUse} />
                              <Rating label="Keep" value={r.keepUsing} />
                              {r.recommendScore !== null && (
                                <span className="rounded-full border-2 border-black bg-cyan-100 px-2.5 py-0.5 text-xs font-bold">
                                  Recommend {r.recommendScore}/10
                                </span>
                              )}
                              {r.pmfDisappointment && (
                                <span className="rounded-full border-2 border-black bg-green-100 px-2.5 py-0.5 text-xs font-bold">
                                  Without it: {r.pmfDisappointment} disappointed
                                </span>
                              )}
                            </p>
                            {[r.painPoint, r.featureRequest, r.otherFeedback]
                              .filter(Boolean)
                              .map((t, k) => (
                                <p key={k} className="whitespace-pre-wrap break-words text-sm">
                                  “{t}”
                                </p>
                              ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
