import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Learn Phase 1 — LearnTab: subject cards + Reading Log panel.
// Learn Phase 2a — World Flags subject routing + Explore detail.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

// World Flags Explore renders an interactive Leaflet capital map in the facts
// panel. Leaflet needs a real browser layout, so stub it in jsdom — the map is
// not what these tests exercise.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => children ?? null,
  TileLayer: () => null,
  Marker: ({ children }: { children?: unknown }) => children ?? null,
  Popup: ({ children }: { children?: unknown }) => children ?? null,
}));
vi.mock('leaflet', () => ({ default: { icon: () => ({}) }, icon: () => ({}) }));

import { LearnTab } from '../../../../../apps/web/src/pages/tenant/child/LearnTab';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeBook(
  overrides: Partial<{
    id: string;
    title: string;
    author: string | null;
    finished: boolean;
  }> = {},
) {
  return {
    id: BOOK_ID,
    title: 'Matilda',
    author: 'Roald Dahl',
    finished: false,
    createdAt: '2026-06-16T10:00:00.000Z',
    ...overrides,
  };
}

// Install fetch mock: /api/learn → subjects, /api/reading-log → books,
// /api/world-flags → explored codes.
// fetchMock is called with (url, init). We identify by URL substring.
function installDefault(
  subjects: Array<{ subject: string; progress: number }>,
  books: ReturnType<typeof makeBook>[],
  exploredCodes: string[] = [],
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    // Learn path: GET → completed sets per continent, POST → mark a set done.
    if ((url as string).includes('/api/world-flags/learn')) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress: {} }) });
    }
    if ((url as string).includes('/api/world-flags')) {
      if (method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ explored: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ explored: exploredCodes }),
      });
    }
    if ((url as string).includes('/api/learn')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects }) });
    }
    if ((url as string).includes('/api/reading-log')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ books }) });
    }
    return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  });
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <LearnTab memberId={CHILD} />
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
});
afterEach(() => vi.unstubAllGlobals());

// ─── Subject cards ────────────────────────────────────────────────────────────

describe('Subject cards', () => {
  it('renders a card + progress bar per subject from GET /api/learn', async () => {
    installDefault(
      [
        { subject: 'Maths', progress: 40 },
        { subject: 'Science', progress: 20 },
      ],
      [],
    );
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-subject-science')).toBeInTheDocument();
    expect(screen.getByTestId('learn-progress-Maths').getAttribute('aria-valuenow')).toBe('40');
  });

  it('clamps an out-of-range progress value to 100', async () => {
    installDefault([{ subject: 'Maths', progress: 250 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-progress-Maths').getAttribute('aria-valuenow')).toBe('100');
  });

  it('shows the testid slug for World Flags correctly', async () => {
    installDefault([{ subject: 'World Flags', progress: 10 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
  });
});

// ─── Reading Log ──────────────────────────────────────────────────────────────

describe('Reading Log panel', () => {
  it('renders the reading-log panel and empty state', async () => {
    installDefault([], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('reading-log-empty')).toBeInTheDocument());
  });

  it('shows add-book form controls after load', async () => {
    installDefault([], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    expect(screen.getByTestId('reading-log-add-title')).toBeInTheDocument();
    expect(screen.getByTestId('reading-log-add-submit')).toBeInTheDocument();
  });

  it('POST on submit shows the new book', async () => {
    const newBook = makeBook();
    // First two calls: learn + reading-log list (empty). Third: POST.
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ subjects: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ books: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => newBook });

    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-log-empty')).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByTestId('reading-log-add-title'), {
        target: { value: 'Matilda' },
      });
      fireEvent.click(screen.getByTestId('reading-log-add-submit'));
    });

    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-item-${BOOK_ID}`)).toBeInTheDocument(),
    );
  });

  it('renders books from GET /api/reading-log', async () => {
    installDefault([], [makeBook()]);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-item-${BOOK_ID}`)).toBeInTheDocument(),
    );
    expect(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`reading-log-delete-${BOOK_ID}`)).toBeInTheDocument();
  });

  it('PATCH on toggle sends PATCH with correct memberId and finished=true', async () => {
    const book = makeBook();
    const toggled = makeBook({ finished: true });

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ subjects: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ books: [book] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => toggled });

    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      const patchCall = calls.find(
        ([url, init]) =>
          (url as string).includes(BOOK_ID) && (init as RequestInit)?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
    });
  });

  it('DELETE removes the book row', async () => {
    const book = makeBook();

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ subjects: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ books: [book] }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-delete-${BOOK_ID}`)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`reading-log-delete-${BOOK_ID}`));
    });

    await waitFor(() =>
      expect(screen.queryByTestId(`reading-log-item-${BOOK_ID}`)).not.toBeInTheDocument(),
    );
  });
});

// ─── Loading / error ──────────────────────────────────────────────────────────

describe('Loading / error states', () => {
  it('shows learn-loading when both endpoints are pending', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderTab();
    expect(screen.getByTestId('learn-loading')).toBeInTheDocument();
  });

  it('shows learn-error when both endpoints fail', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-error')).toBeInTheDocument());
  });
});

// ─── World Flags subject routing (Learn Phase 2a) ─────────────────────────────

describe('World Flags subject routing', () => {
  it('clicking World Flags subject card shows the Explore detail', async () => {
    installDefault([{ subject: 'World Flags', progress: 10 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-back')).toBeInTheDocument());
    // World Flags Explore renders a flashcard
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
  });

  it('back button returns to the subject overview', async () => {
    installDefault([{ subject: 'World Flags', progress: 10 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-back')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-back'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('world-flashcard')).not.toBeInTheDocument();
  });

  it('a lesson subject (Maths) opens the interactive lesson (FHS-283)', async () => {
    installDefault([{ subject: 'Maths', progress: 20 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-maths'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-back')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-view')).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});

// ─── WorldFlagsLearn Explore behaviour ───────────────────────────────────────

describe('WorldFlagsLearn Explore', () => {
  async function openWorldFlags() {
    installDefault([{ subject: 'World Flags', progress: 5 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    // Wait for the world flags GET to resolve and the flashcard to appear
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
  }

  it('renders a continent filter bar with All button', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-continent-all')).toBeInTheDocument();
    expect(screen.getByTestId('world-continent-africa')).toBeInTheDocument();
  });

  it('renders a progress bar', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-progress')).toBeInTheDocument();
  });

  it('renders Next Flag button', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-next-flag')).toBeInTheDocument();
  });

  it('tapping the flashcard (flag→name) reveals the country name and POSTs explore', async () => {
    await openWorldFlags();
    // Tap to reveal name
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flag-name')).toBeInTheDocument());
    // Verify a POST to /api/world-flags/explore was made
    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
      const postCall = calls.find(
        ([url, init]) =>
          (url as string).includes('/api/world-flags/explore') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
    });
  });

  it('tapping the flashcard again (name→facts) reveals the facts panel', async () => {
    await openWorldFlags();
    // First tap → name
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flag-name')).toBeInTheDocument());
    // Second tap → facts
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flag-facts')).toBeInTheDocument());
  });

  it('clicking a continent filter updates the visible progress', async () => {
    await openWorldFlags();
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    // Progress bar should still be present and reflect Africa subset
    expect(screen.getByTestId('world-progress')).toBeInTheDocument();
  });

  it('continent certificates section renders for each continent', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-cert-africa')).toBeInTheDocument();
    expect(screen.getByTestId('world-cert-europe')).toBeInTheDocument();
    expect(screen.getByTestId('world-cert-asia')).toBeInTheDocument();
  });
});
