import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-231 — AssignmentsTabPanel.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { AssignmentsTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/AssignmentsTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <AssignmentsTabPanel />
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

describe('<AssignmentsTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('assignments-loading')).toBeInTheDocument();
  });

  it('renders inline error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-error')).toBeInTheDocument());
  });

  it('renders empty state when no assignments', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assignments: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignments-open-empty')).toBeInTheDocument();
    expect(screen.getByTestId('assignments-done-empty')).toBeInTheDocument();
  });

  it('splits items into To do vs Done by the done flag', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: [
          {
            id: 'a1',
            title: 'Spelling',
            notes: null,
            dueDate: '2026-05-05',
            memberId: null,
            done: false,
            doneAt: null,
          },
          {
            id: 'a2',
            title: 'Maths',
            notes: null,
            dueDate: null,
            memberId: null,
            done: true,
            doneAt: '2026-05-03T10:00:00.000Z',
          },
        ],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignment-title-a1').textContent).toBe('Spelling');
    expect(screen.getByTestId('assignment-title-a2').textContent).toBe('Maths');
    // a1 is in the open list; a2 is in the done list.
    const openList = screen.getByTestId('assignments-open-list');
    const doneList = screen.getByTestId('assignments-done-list');
    expect(openList).toContainElement(screen.getByTestId('assignment-row-a1'));
    expect(doneList).toContainElement(screen.getByTestId('assignment-row-a2'));
  });

  it('+ Add opens form; submitting POSTs and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ assignments: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: '2026-05-05',
          memberId: null,
          done: false,
          doneAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assignments: [
            {
              id: 'a1',
              title: 'Spelling',
              notes: null,
              dueDate: '2026-05-05',
              memberId: null,
              done: false,
              doneAt: null,
            },
          ],
        }),
      });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), {
        target: { value: 'Spelling' },
      });
      fireEvent.change(screen.getByTestId('assignments-add-due'), {
        target: { value: '2026-05-05' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-submit'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('assignment-title-a1').textContent).toBe('Spelling'),
    );
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({ title: 'Spelling', dueDate: '2026-05-05' });
  });

  it('toggling the checkbox PATCHes /api/assignments/:id', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assignments: [
            {
              id: 'a1',
              title: 'Spelling',
              notes: null,
              dueDate: '2026-05-05',
              memberId: null,
              done: false,
              doneAt: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: '2026-05-05',
          memberId: null,
          done: true,
          doneAt: '2026-05-03T10:00:00.000Z',
        }),
      });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-toggle-a1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('assignment-toggle-a1'));
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe('/api/assignments/a1');
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body).toEqual({ done: true });

    // Optimistic flip — row now in the done section + line-through applied.
    await waitFor(() => {
      const doneList = screen.getByTestId('assignments-done-list');
      expect(doneList).toContainElement(screen.getByTestId('assignment-row-a1'));
    });
  });

  it('passes bearer token + tenant slug on every request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assignments: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/assignments');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
