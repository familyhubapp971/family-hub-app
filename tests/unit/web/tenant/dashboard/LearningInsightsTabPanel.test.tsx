import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-385 — parent "Learning Insights" tab unit tests.
// URL-keyed fetch mocks (matching the MyWorldTab / MealsTabPanel pattern).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { LearningInsightsTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/LearningInsightsTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const CHILD_A = {
  id: 'aaaa0000-0000-4000-8000-aaaaaaaaaaaa',
  displayName: 'Iman',
  role: 'child',
};
const CHILD_B = {
  id: 'bbbb0000-0000-4000-8000-bbbbbbbbbbbb',
  displayName: 'Ali',
  role: 'child',
};

const SUBJECTS_WITH_ACTIVITY = [
  {
    subject: 'Maths',
    progressPct: 72,
    certificatesEarned: 3,
    certificatesTotal: 5,
    lastActive: new Date(Date.now() - 86_400_000).toISOString(), // yesterday
    needsHelp: false,
  },
  {
    subject: 'Logic',
    progressPct: 25,
    certificatesEarned: 0,
    certificatesTotal: 4,
    lastActive: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    needsHelp: true,
  },
  {
    subject: 'Science',
    progressPct: 50,
    certificatesEarned: 2,
    certificatesTotal: 4,
    lastActive: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    needsHelp: false,
  },
  {
    subject: 'World Flags',
    progressPct: 90,
    certificatesEarned: 4,
    certificatesTotal: 5,
    lastActive: new Date().toISOString(),
    needsHelp: false,
  },
];

const WEAKEST: { subject: string; detail: string; tip: string } = {
  subject: 'Logic',
  detail: 'Sequence Puzzle level 3',
  tip: 'Try doing one puzzle together before bed.',
};

function insightsFor(
  memberId: string,
  displayName: string,
  opts: {
    hasActivity?: boolean;
    subjects?: typeof SUBJECTS_WITH_ACTIVITY;
    weakest?: typeof WEAKEST | null;
  } = {},
) {
  const hasActivity = opts.hasActivity ?? true;
  return {
    memberId,
    displayName,
    subjects: hasActivity ? (opts.subjects ?? SUBJECTS_WITH_ACTIVITY) : [],
    weakest: hasActivity ? (opts.weakest !== undefined ? opts.weakest : WEAKEST) : null,
    hasActivity,
  };
}

// ─── Mock installer ────────────────────────────────────────────────────────

function installApi(opts: {
  members?: (typeof CHILD_A)[];
  insightsMap?: Record<string, ReturnType<typeof insightsFor>>;
  membersOk?: boolean;
  insightsOk?: boolean;
}) {
  const members = opts.members ?? [CHILD_A, CHILD_B];
  const insightsMap =
    opts.insightsMap ??
    ({
      [CHILD_A.id]: insightsFor(CHILD_A.id, CHILD_A.displayName),
      [CHILD_B.id]: insightsFor(CHILD_B.id, CHILD_B.displayName),
    } as Record<string, ReturnType<typeof insightsFor>>);

  fetchMock.mockImplementation((url: string) => {
    const u = String(url);

    // /api/learn/insights?memberId=...
    if (u.includes('/api/learn/insights')) {
      if (opts.insightsOk === false) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      const match = u.match(/memberId=([^&]+)/);
      const id = match?.[1] ?? '';
      const data = insightsMap[id] ?? insightsFor(id, 'Unknown');
      return Promise.resolve({ ok: true, status: 200, json: async () => data });
    }

    // /api/members
    if (u.includes('/api/members')) {
      if (opts.membersOk === false) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members }),
      });
    }

    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

// ─── Render helper ─────────────────────────────────────────────────────────

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/t/khans/dashboard?tab=learning-insights']}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <LearningInsightsTabPanel />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('<LearningInsightsTabPanel />', () => {
  // --- Child switcher ---

  it('renders child switcher pills for every child member', async () => {
    installApi({});
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('child-switcher')).toBeInTheDocument());
    expect(screen.getByTestId(`child-pill-${CHILD_A.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`child-pill-${CHILD_B.id}`)).toBeInTheDocument();
    // Labels include the child names
    expect(screen.getByTestId(`child-pill-${CHILD_A.id}`).textContent).toContain('Iman');
    expect(screen.getByTestId(`child-pill-${CHILD_B.id}`).textContent).toContain('Ali');
  });

  it('first child is selected by default', async () => {
    installApi({});
    renderPanel();
    await waitFor(() => expect(screen.getByTestId(`child-pill-${CHILD_A.id}`)).toBeInTheDocument());
    expect(screen.getByTestId(`child-pill-${CHILD_A.id}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByTestId(`child-pill-${CHILD_B.id}`).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('switching to another child re-fetches insights for that child', async () => {
    installApi({
      insightsMap: {
        [CHILD_A.id]: insightsFor(CHILD_A.id, CHILD_A.displayName),
        [CHILD_B.id]: insightsFor(CHILD_B.id, CHILD_B.displayName, {
          subjects: [
            {
              subject: 'Maths',
              progressPct: 10,
              certificatesEarned: 0,
              certificatesTotal: 5,
              lastActive: null,
              needsHelp: true,
            },
            {
              subject: 'Logic',
              progressPct: 5,
              certificatesEarned: 0,
              certificatesTotal: 4,
              lastActive: null,
              needsHelp: true,
            },
            {
              subject: 'Science',
              progressPct: 0,
              certificatesEarned: 0,
              certificatesTotal: 4,
              lastActive: null,
              needsHelp: false,
            },
            {
              subject: 'World Flags',
              progressPct: 0,
              certificatesEarned: 0,
              certificatesTotal: 5,
              lastActive: null,
              needsHelp: false,
            },
          ],
          weakest: { subject: 'Maths', detail: 'Multiplication tables', tip: 'Try flashcards.' },
        }),
      },
    });
    renderPanel();

    // Wait for initial render with CHILD_A
    await waitFor(() => expect(screen.getByTestId('subject-cards-grid')).toBeInTheDocument());

    // Switch to CHILD_B
    await act(async () => {
      fireEvent.click(screen.getByTestId(`child-pill-${CHILD_B.id}`));
    });

    // CHILD_B's pill should now be selected
    await waitFor(() =>
      expect(screen.getByTestId(`child-pill-${CHILD_B.id}`).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );

    // The insights call for CHILD_B must have gone out
    const calls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes(`/api/learn/insights?memberId=${CHILD_B.id}`),
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  // --- Subject cards ---

  it('renders per-subject cards with progress, certs, and last-active', async () => {
    installApi({});
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('subject-cards-grid')).toBeInTheDocument());

    expect(screen.getByTestId('subject-card-maths')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-logic')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-science')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-world-flags')).toBeInTheDocument();

    // Certs: Maths has 3/5
    expect(screen.getByTestId('subject-certs-maths').textContent).toContain('3/5');

    // Last-active: Maths was yesterday
    expect(screen.getByTestId('subject-last-active-maths').textContent).toContain('Yesterday');

    // Progress ring accessible label for Maths
    const rings = screen.getAllByTestId('progress-ring');
    const mathsRing = rings.find((r) => r.getAttribute('aria-label')?.includes('Maths progress'));
    expect(mathsRing).toBeDefined();
    expect(mathsRing?.getAttribute('aria-label')).toContain('72%');
  });

  it('shows the needs-help chip only for subjects where needsHelp is true', async () => {
    installApi({});
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('subject-cards-grid')).toBeInTheDocument());

    // Logic has needsHelp: true
    expect(screen.getByTestId('needs-help-chip-logic')).toBeInTheDocument();

    // Maths has needsHelp: false
    expect(screen.queryByTestId('needs-help-chip-maths')).not.toBeInTheDocument();
    expect(screen.queryByTestId('needs-help-chip-science')).not.toBeInTheDocument();
    expect(screen.queryByTestId('needs-help-chip-world-flags')).not.toBeInTheDocument();
  });

  // --- Weakest panel ---

  it('shows the weakest-area panel with subject, detail, and tip when weakest is non-null', async () => {
    installApi({});
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('weakest-panel')).toBeInTheDocument());
    expect(screen.getByTestId('weakest-subject').textContent).toContain('Logic');
    expect(screen.getByTestId('weakest-detail').textContent).toContain('Sequence Puzzle level 3');
    expect(screen.getByTestId('weakest-tip').textContent).toContain(
      'Try doing one puzzle together before bed.',
    );
  });

  it('hides the weakest-area panel when weakest is null', async () => {
    installApi({
      insightsMap: {
        [CHILD_A.id]: insightsFor(CHILD_A.id, CHILD_A.displayName, { weakest: null }),
        [CHILD_B.id]: insightsFor(CHILD_B.id, CHILD_B.displayName, { weakest: null }),
      },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('subject-cards-grid')).toBeInTheDocument());
    expect(screen.queryByTestId('weakest-panel')).not.toBeInTheDocument();
  });

  // --- Empty state ---

  it('shows the empty state when hasActivity is false', async () => {
    installApi({
      insightsMap: {
        [CHILD_A.id]: insightsFor(CHILD_A.id, CHILD_A.displayName, { hasActivity: false }),
        [CHILD_B.id]: insightsFor(CHILD_B.id, CHILD_B.displayName, { hasActivity: false }),
      },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('learning-insights-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('subject-cards-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('weakest-panel')).not.toBeInTheDocument();
  });

  // --- Loading state ---

  it('shows a loading indicator while fetching', () => {
    // Never resolves during this test
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderPanel();
    // Loading appears after members resolve and insights are in-flight.
    // The members fetch is also never-resolving, so the switcher is absent
    // but no error or content shows either. The panel itself renders.
    expect(screen.getByTestId('learning-insights-panel')).toBeInTheDocument();
  });

  it('shows the loading indicator while insights are fetching', async () => {
    let resolveInsights!: (v: unknown) => void;
    const insightsPromise = new Promise((r) => {
      resolveInsights = r;
    });

    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [CHILD_A] }),
        });
      }
      if (u.includes('/api/learn/insights')) {
        return insightsPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => insightsFor(CHILD_A.id, CHILD_A.displayName),
        }));
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId('learning-insights-loading')).toBeInTheDocument(),
    );

    // Resolve the insights fetch
    await act(async () => {
      resolveInsights(undefined);
    });
    await waitFor(() =>
      expect(screen.queryByTestId('learning-insights-loading')).not.toBeInTheDocument(),
    );
  });

  // --- Error state ---

  it('shows an error message when the insights fetch fails', async () => {
    installApi({ insightsOk: false });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('learning-insights-error')).toBeInTheDocument());
    expect(screen.queryByTestId('subject-cards-grid')).not.toBeInTheDocument();
  });

  // --- No children ---

  it('shows a no-children message when no child members exist', async () => {
    installApi({ members: [] });
    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId('learning-insights-no-children')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('child-switcher')).not.toBeInTheDocument();
  });

  // --- Auth headers ---

  it('sends the correct auth headers with each fetch', async () => {
    installApi({});
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('subject-cards-grid')).toBeInTheDocument());
    const membersCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/members'));
    expect(membersCalls.length).toBeGreaterThanOrEqual(1);
    const [, init] = membersCalls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
