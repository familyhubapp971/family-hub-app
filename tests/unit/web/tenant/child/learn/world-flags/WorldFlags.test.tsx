import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// World Flags container — Explore / Learn path / Certificates sub-tabs.
// Tests cover both parent mode (memberId) and kid mode (kidToken).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => children ?? null,
  TileLayer: () => null,
  Marker: ({ children }: { children?: unknown }) => children ?? null,
  Popup: ({ children }: { children?: unknown }) => children ?? null,
}));
vi.mock('leaflet', () => ({ default: { icon: () => ({}) }, icon: () => ({}) }));

import { WorldFlags } from '../../../../../../../apps/web/src/pages/tenant/child/learn/world-flags/WorldFlags';
import { TenantProvider } from '../../../../../../../apps/web/src/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const KID_TOKEN = 'kid.jwt.tok';

function installFetch(opts: { explored?: string[]; progress?: Record<string, number[]> } = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    if (
      (url as string).includes('/api/world-flags/learn') ||
      (url as string).includes('/api/kid/world-flags/learn')
    ) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ progress: opts.progress ?? {} }),
      });
    }
    if (
      (url as string).includes('/api/world-flags') ||
      (url as string).includes('/api/kid/world-flags')
    ) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ explored: opts.explored ?? [] }),
      });
    }
    // Wikipedia landmark lookups etc. → fail to placeholder.
    return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  });
}

function renderWorldFlags() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <WorldFlags memberId={CHILD} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWorldFlagsKid() {
  // Must be under a /t/:slug route so TenantProvider can read the slug param
  // (useTenantSlug() throws outside it). The slug value is irrelevant for kid
  // mode — only the kidToken is used to build headers.
  return render(
    <MemoryRouter initialEntries={['/t/khan/kid']}>
      <Routes>
        <Route
          path="/t/:slug/kid"
          element={
            <TenantProvider>
              <WorldFlags kidToken={KID_TOKEN} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('WorldFlags sub-tabs', () => {
  it('defaults to Explore and shows all three sub-tab buttons', async () => {
    installFetch();
    renderWorldFlags();
    expect(screen.getByTestId('world-subtab-explore')).toBeInTheDocument();
    expect(screen.getByTestId('world-subtab-learn')).toBeInTheDocument();
    expect(screen.getByTestId('world-subtab-certificates')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
  });

  it('switches to the Learn path tab and shows the continent picker', async () => {
    installFetch();
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-learn'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument();
  });

  it('switches to the Certificates tab and shows the progress bar', async () => {
    installFetch();
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-certificates'));
    });
    await waitFor(() => expect(screen.getByTestId('wfcert')).toBeInTheDocument());
    expect(screen.getByTestId('wfcert-progress-bar')).toBeInTheDocument();
  });
});

describe('WorldFlags Learn path', () => {
  it('picking a continent unlocks set 1 and locks the rest', async () => {
    installFetch({ progress: {} });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-learn'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-0')).toBeInTheDocument());
    // First set is unlocked, second is locked (disabled) until set 0 passes.
    expect(screen.getByTestId('wfpath-set-0')).not.toBeDisabled();
    expect(screen.getByTestId('wfpath-set-1')).toBeDisabled();
  });

  it('answering every question correctly completes the set and POSTs once', async () => {
    installFetch({ progress: {} });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-learn'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-set-0'));
    });
    // Study phase — click through all 5 cards (last "Next" starts the quiz).
    await waitFor(() => expect(screen.getByTestId('wfpath-study')).toBeInTheDocument());
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.click(screen.getByTestId('wfpath-study-next'));
      });
    }
    // Quiz phase — answer each of the 5 questions correctly. The flag image's
    // alt text ("Flag of X") reveals the country whose name is the answer.
    await waitFor(() => expect(screen.getByTestId('wfpath-quiz')).toBeInTheDocument());
    for (let q = 0; q < 5; q++) {
      const img = screen.getByTestId('world-flag-image') as HTMLImageElement;
      const name = img.alt.replace(/^Flag of /, '');
      const choices = screen.getAllByTestId(/^wfpath-quiz-choice-/);
      const target = choices.find((b) => b.textContent === name);
      expect(target, `choice for "${name}" present`).toBeTruthy();
      await act(async () => {
        fireEvent.click(target!);
      });
      // Each correct answer auto-advances after 500ms.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
    }
    // Set passed → results screen + exactly one learn-complete POST.
    await waitFor(() => expect(screen.getByTestId('wfpath-results')).toBeInTheDocument());
    const completeCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/world-flags/learn-complete') && init?.method === 'POST',
    );
    expect(completeCalls).toHaveLength(1);
  }, 15000);

  it('completed sets from the server are marked and unlock the next set', async () => {
    installFetch({ progress: { Africa: [0] } });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-learn'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-1')).toBeInTheDocument());
    // Set 0 done → set 1 now unlocked.
    expect(screen.getByTestId('wfpath-set-1')).not.toBeDisabled();
  });
});

describe('WorldFlags Certificates', () => {
  it('shows an earned certificate + quiz button when a continent is fully explored', async () => {
    // Mark every African flag explored so Africa's certificate is earned.
    const { COUNTRIES } = await import('../../../../../../../apps/web/src/data/countries');
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa').map((c) => c.code);
    installFetch({ explored: africa });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-certificates'));
    });
    await waitFor(() => expect(screen.getByTestId('wfcert-card-africa')).toBeInTheDocument());
    expect(screen.getByTestId('wfcert-quiz-africa')).toBeInTheDocument();
  });
});

// ─── Kid-mode tests (FHS-373) ─────────────────────────────────────────────────

describe('WorldFlags kid mode — Explore', () => {
  it('GETs /api/kid/world-flags with only the kid Bearer token (no memberId, no x-tenant-slug)', async () => {
    // Kid mode does NOT need a Supabase session — set to null to prove it.
    authState.session = null;
    installFetch();
    renderWorldFlagsKid();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());

    const exploreCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/world-flags') && (init?.method ?? 'GET') === 'GET',
    );
    expect(exploreCalls.length).toBeGreaterThan(0);
    const [url, init] = exploreCalls[0]!;
    expect(url).not.toContain('memberId');
    expect((init?.headers as Record<string, string>)?.Authorization).toBe(`Bearer ${KID_TOKEN}`);
    expect((init?.headers as Record<string, string>)?.['x-tenant-slug']).toBeUndefined();
  });

  it('POSTs /api/kid/world-flags/explore with countryCode only (no memberId)', async () => {
    authState.session = null;
    installFetch();
    renderWorldFlagsKid();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());

    // Tapping the card (flag → name state) triggers markExplored.
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });

    await waitFor(() => {
      const postCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
        ([url, init]) =>
          (url as string).includes('/api/kid/world-flags/explore') && init?.method === 'POST',
      );
      expect(postCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(postCalls[0]![1]!.body as string) as Record<string, unknown>;
      expect(body.countryCode).toBeTruthy();
      expect(body.memberId).toBeUndefined();
    });
  });
});

describe('WorldFlags kid mode — Learn path', () => {
  it('GETs /api/kid/world-flags/learn with no memberId in the URL', async () => {
    authState.session = null;
    installFetch();
    renderWorldFlagsKid();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-learn'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());

    const learnCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/world-flags/learn') && (init?.method ?? 'GET') === 'GET',
    );
    expect(learnCalls.length).toBeGreaterThan(0);
    expect(String(learnCalls[0]![0])).not.toContain('memberId');
  });

  it('POSTs /api/kid/world-flags/learn-complete without memberId', async () => {
    authState.session = null;
    installFetch({ progress: {} });
    renderWorldFlagsKid();
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-learn'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-set-0'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-study')).toBeInTheDocument());
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.click(screen.getByTestId('wfpath-study-next'));
      });
    }
    await waitFor(() => expect(screen.getByTestId('wfpath-quiz')).toBeInTheDocument());
    for (let q = 0; q < 5; q++) {
      const img = screen.getByTestId('world-flag-image') as HTMLImageElement;
      const name = img.alt.replace(/^Flag of /, '');
      const choices = screen.getAllByTestId(/^wfpath-quiz-choice-/);
      const target = choices.find((b) => b.textContent === name);
      expect(target).toBeTruthy();
      await act(async () => {
        fireEvent.click(target!);
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
    }
    await waitFor(() => expect(screen.getByTestId('wfpath-results')).toBeInTheDocument());

    const completeCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/world-flags/learn-complete') && init?.method === 'POST',
    );
    expect(completeCalls).toHaveLength(1);
    const body = JSON.parse(completeCalls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body.memberId).toBeUndefined();
    expect(body.continent).toBe('Africa');
  }, 15000);
});
