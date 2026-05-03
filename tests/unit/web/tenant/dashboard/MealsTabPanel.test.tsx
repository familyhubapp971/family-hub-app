import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-229 — MealsTabPanel. Loading / error / grid / cell-edit /
// save / delete-on-clear paths.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { MealsTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/MealsTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <MealsTabPanel />
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

describe('<MealsTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('meals-loading')).toBeInTheDocument();
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-error')).toBeInTheDocument());
  });

  it('renders an empty grid with + Add buttons when no meals are stored', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ meals: [] }) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    // Spot-check a couple of cells render the empty-state button.
    expect(screen.getByTestId('meals-cell-button-mon-breakfast')).toBeInTheDocument();
    expect(screen.getByTestId('meals-cell-button-sun-snack')).toBeInTheDocument();
  });

  it('places stored meal names in their day/slot cells', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meals: [
          { id: 'm1', dayOfWeek: 'mon', slot: 'breakfast', name: 'Porridge' },
          { id: 'm2', dayOfWeek: 'wed', slot: 'dinner', name: 'Pasta' },
        ],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    expect(screen.getByTestId('meals-cell-name-mon-breakfast').textContent).toBe('Porridge');
    expect(screen.getByTestId('meals-cell-name-wed-dinner').textContent).toBe('Pasta');
  });

  it('clicking a cell opens the inline editor with the current value', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meals: [{ id: 'm1', dayOfWeek: 'mon', slot: 'breakfast', name: 'Porridge' }],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-cell-button-mon-breakfast'));
    });
    const input = screen.getByTestId('meals-input-mon-breakfast') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Porridge');
  });

  it('saving fires POST /api/meals with day/slot/name + refetches', async () => {
    fetchMock
      // initial GET — empty
      .mockResolvedValueOnce({ ok: true, json: async () => ({ meals: [] }) })
      // POST upsert
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'm1', dayOfWeek: 'tue', slot: 'lunch', name: 'Soup' }),
      })
      // refetch GET
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meals: [{ id: 'm1', dayOfWeek: 'tue', slot: 'lunch', name: 'Soup' }],
        }),
      });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-cell-button-tue-lunch'));
    });
    const input = screen.getByTestId('meals-input-tue-lunch');
    act(() => {
      fireEvent.change(input, { target: { value: 'Soup' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-save-tue-lunch'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('meals-cell-name-tue-lunch').textContent).toBe('Soup'),
    );

    // Find the POST call.
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const [, init] = postCall!;
    expect(JSON.parse(init.body as string)).toEqual({
      dayOfWeek: 'tue',
      slot: 'lunch',
      name: 'Soup',
    });
  });

  it('clearing a cell sends an empty name (delete path)', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meals: [{ id: 'm1', dayOfWeek: 'mon', slot: 'breakfast', name: 'Porridge' }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ meals: [] }) });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-cell-button-mon-breakfast'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('meals-input-mon-breakfast'), {
        target: { value: '' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-save-mon-breakfast'));
    });

    await waitFor(() => expect(screen.queryByTestId('meals-cell-name-mon-breakfast')).toBeNull());

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.name).toBe('');
  });

  it('Escape cancels the edit', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meals: [{ id: 'm1', dayOfWeek: 'mon', slot: 'breakfast', name: 'Porridge' }],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-cell-button-mon-breakfast'));
    });
    const input = screen.getByTestId('meals-input-mon-breakfast');
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(screen.queryByTestId('meals-input-mon-breakfast')).toBeNull();
    expect(screen.getByTestId('meals-cell-name-mon-breakfast').textContent).toBe('Porridge');
  });

  it('passes the bearer token + tenant slug on every request', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ meals: [] }) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/meals');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
