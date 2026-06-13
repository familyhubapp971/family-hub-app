import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-231 / FHS-266 — AssignmentsTabPanel (Magic Patterns layout).
// Member filter pills, avatar dot + name badge per row, a single list
// with done rows dimmed, and an inline add form with a member <select>.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { AssignmentsTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/AssignmentsTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

interface A {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  memberId: string | null;
  done: boolean;
  doneAt: string | null;
}
const ALI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SARA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS = [
  { id: ALI, displayName: 'Ali', avatarEmoji: '👦' },
  { id: SARA, displayName: 'Sara', avatarEmoji: '👧' },
];

// URL-routing fetch mock: assignments + members are fetched together via
// Promise.all, so a sequence of mockResolvedValueOnce can't model it.
function installApi(opts: { assignments?: A[]; aOk?: boolean; aStatus?: number }) {
  const state = { assignments: [...(opts.assignments ?? [])] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
      });
    }
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body as string) as Partial<A>;
      const row: A = {
        id: `gen-${state.assignments.length + 1}`,
        title: b.title ?? '',
        notes: null,
        dueDate: b.dueDate ?? null,
        memberId: b.memberId ?? null,
        done: false,
        doneAt: null,
      };
      state.assignments.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'PATCH') {
      const id = u.split('/api/assignments/')[1]!;
      const next = JSON.parse(init.body as string) as { done: boolean };
      state.assignments = state.assignments.map((a) =>
        a.id === id ? { ...a, done: next.done } : a,
      );
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    return Promise.resolve({
      ok: opts.aOk ?? true,
      status: opts.aStatus ?? 200,
      json: async () => ({ assignments: state.assignments }),
    });
  });
  return state;
}

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

  it('renders inline error when the assignments request fails', async () => {
    installApi({ aOk: false, aStatus: 500 });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-error')).toBeInTheDocument());
  });

  it('renders the empty state + a filter pill per member', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignments-empty')).toBeInTheDocument();
    expect(screen.getByTestId('assignments-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId(`assignments-filter-${ALI}`)).toBeInTheDocument();
    expect(screen.getByTestId(`assignments-filter-${SARA}`)).toBeInTheDocument();
  });

  it('renders rows with an avatar dot + member badge; whole-family rows read "Family"', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: '2026-06-20',
          memberId: ALI,
          done: false,
          doneAt: null,
        },
        {
          id: 'a2',
          title: 'Tidy up',
          notes: null,
          dueDate: null,
          memberId: null,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignment-title-a1').textContent).toContain('Maths');
    expect(screen.getByTestId('assignment-avatar-a1')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-member-a1').textContent).toBe('Ali');
    expect(screen.getByTestId('assignment-member-a2').textContent).toBe('Family');
  });

  it('keeps done rows in the same list (dimmed), not a separate section', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
        {
          id: 'a2',
          title: 'Reading',
          notes: null,
          dueDate: null,
          memberId: SARA,
          done: true,
          doneAt: '2026-06-10T00:00:00Z',
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    const list = screen.getByTestId('assignments-list');
    expect(list).toContainElement(screen.getByTestId('assignment-row-a1'));
    expect(list).toContainElement(screen.getByTestId('assignment-row-a2'));
    expect(screen.getByTestId('assignment-title-a2').className).toContain('line-through');
  });

  it('filters the list down to one member', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
        {
          id: 'a2',
          title: 'Piano',
          notes: null,
          dueDate: null,
          memberId: SARA,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId(`assignments-filter-${ALI}`));
    });
    expect(screen.getByTestId('assignment-row-a1')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-row-a2')).not.toBeInTheDocument();
  });

  it('falls back to "Family" when the assigned member was deleted', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Old task',
          notes: null,
          dueDate: null,
          memberId: 'deleted-uuid',
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignment-member-a1').textContent).toBe('Family');
    expect(screen.getByTestId('assignment-avatar-a1').textContent).toBe('👪');
  });

  it('shows a filtered empty state while keeping the member pill selected', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Piano',
          notes: null,
          dueDate: null,
          memberId: SARA,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId(`assignments-filter-${ALI}`));
    });
    expect(screen.getByTestId('assignments-empty')).toBeInTheDocument();
    expect(screen.getByTestId(`assignments-filter-${ALI}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByTestId('assignments-empty').textContent).toContain(
      'No assignments for this person',
    );
  });

  it('blocks a whitespace-only title without firing a POST', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('assignments-add-form'));
    });
    expect(screen.getByTestId('assignments-add-error')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('+ Add opens form; submitting POSTs title + member and refetches', async () => {
    installApi({ assignments: [] });
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
      fireEvent.change(screen.getByTestId('assignments-add-member'), { target: { value: ALI } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-submit'));
    });
    await waitFor(() => expect(screen.getByText('Spelling')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({ title: 'Spelling', dueDate: '2026-05-05', memberId: ALI });
  });

  it('returns focus to the Add button after cancelling the form', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-cancel'));
    });
    await waitFor(() => expect(screen.getByTestId('assignments-add')).toHaveFocus());
  });

  it('reverts + announces an error when the toggle PATCH fails', async () => {
    const state = installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
    });
    // Make PATCH fail.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ assignments: state.assignments }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-toggle-a1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignment-toggle-a1'));
    });
    // Row reverts to not-done (no line-through) + an error is announced.
    await waitFor(() =>
      expect(screen.getByTestId('assignment-title-a1').className).not.toContain('line-through'),
    );
    expect(screen.getByTestId('assignments-error-announcement').textContent).not.toBe('');
  });

  it('toggling the circle PATCHes /api/assignments/:id', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-toggle-a1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('assignment-toggle-a1'));
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe('http://localhost:3001/api/assignments/a1');
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ done: true });
    await waitFor(() =>
      expect(screen.getByTestId('assignment-title-a1').className).toContain('line-through'),
    );
  });

  it('passes bearer token + tenant slug on every request', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/assignments');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
