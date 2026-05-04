import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-232 — NoticeboardTabPanel.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { NoticeboardTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/NoticeboardTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

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

  it('renders the empty-feed hint when no notices exist', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notices: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.getByTestId('notices-feed-empty')).toBeInTheDocument();
  });

  it('renders pinned notices in the pinned section + others in the feed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        notices: [
          {
            id: 'n1',
            body: 'Pizza Friday',
            pinned: true,
            authorMemberId: null,
            createdAt: '2026-05-03T10:00:00.000Z',
          },
          {
            id: 'n2',
            body: 'Reminder: PE kit',
            pinned: false,
            authorMemberId: null,
            createdAt: '2026-05-02T10:00:00.000Z',
          },
        ],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    const pinned = screen.getByTestId('notices-pinned-list');
    const feed = screen.getByTestId('notices-feed-list');
    expect(pinned).toContainElement(screen.getByTestId('notice-row-n1'));
    expect(feed).toContainElement(screen.getByTestId('notice-row-n2'));
  });

  it('+ Add opens form; submitting POSTs body+pinned and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'n1',
          body: 'Trip on Sat',
          pinned: true,
          authorMemberId: null,
          createdAt: '2026-05-03T10:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notices: [
            {
              id: 'n1',
              body: 'Trip on Sat',
              pinned: true,
              authorMemberId: null,
              createdAt: '2026-05-03T10:00:00.000Z',
            },
          ],
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
    expect(body).toEqual({ body: 'Trip on Sat', pinned: true });
  });

  it('Delete fires DELETE /api/notices/:id and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notices: [
            {
              id: 'n1',
              body: 'Pizza Friday',
              pinned: true,
              authorMemberId: null,
              createdAt: '2026-05-03T10:00:00.000Z',
            },
          ],
        }),
      })
      // DELETE — 204 no body
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notices: [] }) });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notice-delete-n1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('notice-delete-n1'));
    });

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('/api/notices/n1');

    await waitFor(() => expect(screen.queryByTestId('notice-row-n1')).toBeNull());
  });

  it('passes bearer token + tenant slug', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notices: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/notices');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
