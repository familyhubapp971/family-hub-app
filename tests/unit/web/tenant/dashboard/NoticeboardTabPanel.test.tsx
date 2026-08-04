import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-232 / FHS-266: NoticeboardTabPanel (Magic Patterns post-it grid).
// Each note is a coloured card with an emoji icon, optional pin, body, and
// a "From <author>" footer. Posting opens an inline form with an emoji
// picker; the POST body carries body + pinned + icon.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { NoticeboardTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/NoticeboardTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

interface N {
  id: string;
  body: string;
  pinned: boolean;
  authorMemberId: string | null;
  authorName: string | null;
  icon: string | null;
  createdAt: string;
}

function notice(over: Partial<N>): N {
  return {
    id: 'n1',
    body: 'Hello',
    pinned: false,
    authorMemberId: null,
    authorName: null,
    icon: '📌',
    createdAt: '2026-05-03T10:00:00.000Z',
    ...over,
  };
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <NoticeboardTabPanel />
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<NoticeboardTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('notices-loading')).toBeInTheDocument();
  });

  it('renders inline error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-error')).toBeInTheDocument());
  });

  it('renders the empty hint when no notices exist', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.getByTestId('notices-empty')).toBeInTheDocument();
  });

  it('renders each notice as a card with its icon + author', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        notices: [
          notice({ id: 'n1', body: 'Pizza Friday', pinned: true, icon: '🍕', authorName: 'Sarah' }),
          notice({ id: 'n2', body: 'PE kit', pinned: false, icon: '📅', authorName: null }),
        ],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    const grid = screen.getByTestId('notices-grid');
    expect(grid).toContainElement(screen.getByTestId('notice-row-n1'));
    expect(grid).toContainElement(screen.getByTestId('notice-row-n2'));
    expect(screen.getByTestId('notice-icon-n1').textContent).toBe('🍕');
    expect(screen.getByTestId('notice-author-n1').textContent).toBe('From Sarah');
    expect(screen.getByTestId('notice-author-n2').textContent).toBe('From Family');
  });

  it('+ Add opens form; submitting POSTs body + pinned + icon and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => notice({ id: 'n1', body: 'Trip on Sat', pinned: true, icon: '🎉' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notices: [notice({ id: 'n1', body: 'Trip on Sat', pinned: true, icon: '🎉' })],
        }),
      });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('notices-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('notices-add-body'), {
        target: { value: 'Trip on Sat' },
      });
      fireEvent.click(screen.getByTestId('notices-add-pinned'));
      fireEvent.click(screen.getByLabelText('Use icon 🎉'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('notices-add-submit'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('notice-body-n1').textContent).toBe('Trip on Sat'),
    );

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toEqual({ body: 'Trip on Sat', pinned: true, icon: '🎉' });
  });

  it('blocks a whitespace-only note without firing a POST', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('notices-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('notices-add-body'), { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('notices-add-form'));
    });
    expect(screen.getByTestId('notices-add-error')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('Delete fires DELETE /api/notices/:id and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notices: [notice({ id: 'n1', body: 'Pizza Friday', pinned: true })] }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notice-delete-n1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('notice-delete-n1'));
    });

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('http://localhost:3001/api/notices/n1');
    await waitFor(() => expect(screen.queryByTestId('notice-row-n1')).toBeNull());
  });

  it('passes bearer token + tenant slug', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/notices');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('edit button pre-fills the form and save issues a PUT', async () => {
    const existing = notice({ id: 'n-edit', body: 'Old body', pinned: false, icon: '📌' });
    const state = { notices: [existing] };

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'PUT') {
        const idMatch = u.match(/\/api\/notices\/([^?]+)/);
        const id = idMatch?.[1];
        const patch = JSON.parse(init.body as string) as Partial<N>;
        const idx = state.notices.findIndex((n) => n.id === id);
        if (idx >= 0) state.notices[idx] = { ...state.notices[idx]!, ...patch };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => state.notices[idx],
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ notices: state.notices }),
      });
    });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('notice-edit-n-edit'));
    });
    // Form opens pre-filled with existing body
    expect(screen.getByTestId('notices-add-form')).toBeInTheDocument();
    expect((screen.getByTestId('notices-add-body') as HTMLTextAreaElement).value).toBe('Old body');

    act(() => {
      fireEvent.change(screen.getByTestId('notices-add-body'), {
        target: { value: 'New body' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('notices-add-submit'));
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/notices/n-edit') && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse((putCall![1] as RequestInit).body as string).body).toBe('New body');
  });
});
