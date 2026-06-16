import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// World Flags container — Explore / Learn path / Certificates sub-tabs.

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

function installFetch(opts: { explored?: string[]; progress?: Record<string, number[]> } = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    if ((url as string).includes('/api/world-flags/learn')) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ progress: opts.progress ?? {} }),
      });
    }
    if ((url as string).includes('/api/world-flags')) {
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
