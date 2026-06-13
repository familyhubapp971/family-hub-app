import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-270 — ChildWorld Journal tab (write + list, child-private).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { JournalTab } from '../../../../../apps/web/src/pages/tenant/child/JournalTab';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function installApi(entries: Array<{ id: string; body: string; createdAt: string }>) {
  const state = { entries: [...entries] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body as string) as { body: string };
      const entry = {
        id: `gen-${state.entries.length + 1}`,
        body: b.body,
        createdAt: '2026-06-13T10:00:00.000Z',
      };
      state.entries.unshift(entry);
      return Promise.resolve({ ok: true, status: 201, json: async () => entry });
    }
    // Return a copy so the component's state array isn't the same
    // reference the POST handler mutates (that would double-count).
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ entries: [...state.entries] }),
    });
  });
  return state;
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <JournalTab memberId={CHILD} />
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

describe('<JournalTab />', () => {
  it('shows the empty state when there are no entries', async () => {
    installApi([]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-empty')).toBeInTheDocument());
  });

  it('renders existing entries newest-first', async () => {
    installApi([{ id: 'j1', body: 'Today was great', createdAt: '2026-06-12T10:00:00.000Z' }]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-entry-j1')).toBeInTheDocument());
    expect(screen.getByTestId('journal-entry-j1').textContent).toContain('Today was great');
  });

  it('renders an error state on a failed load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-error')).toBeInTheDocument());
  });

  it('adds an entry: POSTs the body and prepends it', async () => {
    installApi([]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('journal-add-body'), {
        target: { value: 'My first entry' },
      });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('journal-add-form'));
    });
    await waitFor(() => expect(screen.getByTestId('journal-entry-gen-1')).toBeInTheDocument());
    expect(screen.getByTestId('journal-entry-gen-1').textContent).toContain('My first entry');
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      memberId: CHILD,
      body: 'My first entry',
    });
  });

  it('blocks a whitespace-only entry without firing a POST', async () => {
    installApi([]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('journal-add-body'), { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('journal-add-form'));
    });
    expect(screen.getByTestId('journal-add-error')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});
