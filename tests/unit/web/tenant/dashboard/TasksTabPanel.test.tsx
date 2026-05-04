import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-233 — TasksTabPanel.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { TasksTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/TasksTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <TasksTabPanel />
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

describe('<TasksTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('tasks-loading')).toBeInTheDocument();
  });

  it('renders inline error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-error')).toBeInTheDocument());
  });

  it('renders the empty state when no tasks exist', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    expect(screen.getByTestId('tasks-open-empty')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-done-empty')).toBeInTheDocument();
  });

  it('splits tasks by done flag', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tasks: [
          { id: 't1', title: 'Buy milk', dueDate: '2026-05-05', done: false, doneAt: null },
          {
            id: 't2',
            title: 'Email school',
            dueDate: null,
            done: true,
            doneAt: '2026-05-03T10:00:00.000Z',
          },
        ],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    expect(screen.getByTestId('tasks-open-list')).toContainElement(
      screen.getByTestId('task-row-t1'),
    );
    expect(screen.getByTestId('tasks-done-list')).toContainElement(
      screen.getByTestId('task-row-t2'),
    );
  });

  it('+ Add posts and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 't1',
          title: 'Call doctor',
          dueDate: null,
          done: false,
          doneAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 't1', title: 'Call doctor', dueDate: null, done: false, doneAt: null }],
        }),
      });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('tasks-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('tasks-add-title'), {
        target: { value: 'Call doctor' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tasks-add-submit'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('task-title-t1').textContent).toBe('Call doctor'),
    );

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({ title: 'Call doctor', dueDate: null });
  });

  it('toggle PATCHes /api/tasks/:id and moves the row to done section', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 't1', title: 'Buy milk', dueDate: null, done: false, doneAt: null }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 't1',
          title: 'Buy milk',
          dueDate: null,
          done: true,
          doneAt: '2026-05-03T10:00:00.000Z',
        }),
      });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-toggle-t1'));
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe('/api/tasks/t1');

    await waitFor(() =>
      expect(screen.getByTestId('tasks-done-list')).toContainElement(
        screen.getByTestId('task-row-t1'),
      ),
    );
  });

  it('Delete fires DELETE /api/tasks/:id and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 't1', title: 'Buy milk', dueDate: null, done: false, doneAt: null }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-delete-t1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-delete-t1'));
    });

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('/api/tasks/t1');
    await waitFor(() => expect(screen.queryByTestId('task-row-t1')).toBeNull());
  });

  it('passes bearer token + tenant slug', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/tasks');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
