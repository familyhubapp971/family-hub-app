import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-264 — MealsTabPanel redesign. Day cards, filter pills, avatar
// dots, repeat icon, and the who-for + recurring editor. A small
// in-memory fake stands in for the API so add / edit / delete + refetch
// behave like the real backend.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { MealsTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/MealsTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

interface Meal {
  id: string;
  dayOfWeek: string;
  slot: string;
  name: string;
  memberId: string | null;
  recurring: boolean;
}
interface Member {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

// Wires fetchMock to a mutable in-memory store. GET /api/meals and
// /api/members read it; POST /api/meals upserts/deletes like the API.
function installApi(opts: {
  meals?: Meal[];
  members?: Member[];
  mealsOk?: boolean;
  mealsStatus?: number;
}) {
  const state = {
    meals: [...(opts.meals ?? [])],
    members: [...(opts.members ?? [])],
  };
  let gen = 0;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as {
        dayOfWeek: string;
        slot: string;
        name: string;
        memberId: string | null;
        recurring: boolean;
      };
      const match = (m: Meal) =>
        m.dayOfWeek === body.dayOfWeek && m.slot === body.slot && m.memberId === body.memberId;
      if (body.name.trim() === '') {
        state.meals = state.meals.filter((m) => !match(m));
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ deleted: true }) });
      }
      const idx = state.meals.findIndex(match);
      const row: Meal = {
        id: idx >= 0 ? state.meals[idx]!.id : `gen-${++gen}`,
        dayOfWeek: body.dayOfWeek,
        slot: body.slot,
        name: body.name.trim(),
        memberId: body.memberId,
        recurring: body.recurring,
      };
      if (idx >= 0) state.meals[idx] = row;
      else state.meals.push(row);
      return Promise.resolve({ ok: true, status: 200, json: async () => row });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: state.members, callerRole: 'admin' }),
      });
    }
    // GET /api/meals
    return Promise.resolve({
      ok: opts.mealsOk ?? true,
      status: opts.mealsStatus ?? 200,
      json: async () => ({ meals: state.meals }),
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
              <MealsTabPanel />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const ALI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SARA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS: Member[] = [
  { id: ALI, displayName: 'Ali', avatarEmoji: '👦' },
  { id: SARA, displayName: 'Sara', avatarEmoji: '👧' },
];

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

  it('renders the inline error when the meals API returns a non-2xx', async () => {
    installApi({ mealsOk: false, mealsStatus: 500 });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-error')).toBeInTheDocument());
  });

  it('fetches both /api/meals and /api/members', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.endsWith('/api/meals'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/api/members'))).toBe(true);
  });

  it('renders 7 day cards, a pill per member, and empty-day states', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      expect(screen.getByTestId(`meals-day-${d}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('meals-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId(`meals-filter-${ALI}`)).toBeInTheDocument();
    expect(screen.getByTestId('meals-day-mon-empty')).toBeInTheDocument();
  });

  it('shows a meal with its name, avatar dot, and a repeat icon when recurring', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'mon',
          slot: 'breakfast',
          name: 'Porridge',
          memberId: null,
          recurring: true,
        },
        {
          id: 'm2',
          dayOfWeek: 'mon',
          slot: 'dinner',
          name: 'Eggs',
          memberId: ALI,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    expect(screen.getByTestId('meals-meal-m1-name').textContent).toBe('Porridge');
    expect(screen.getByTestId('meals-meal-m1-avatar')).toBeInTheDocument();
    // Recurring shows the repeat icon; non-recurring does not.
    expect(screen.getByTestId('meals-meal-m1-recurring')).toBeInTheDocument();
    expect(screen.queryByTestId('meals-meal-m2-recurring')).not.toBeInTheDocument();
  });

  it('filtering to a member shows their meals + whole-family meals, hides others', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'fam',
          dayOfWeek: 'mon',
          slot: 'breakfast',
          name: 'Family toast',
          memberId: null,
          recurring: false,
        },
        {
          id: 'ali',
          dayOfWeek: 'mon',
          slot: 'lunch',
          name: 'Ali sandwich',
          memberId: ALI,
          recurring: false,
        },
        {
          id: 'sara',
          dayOfWeek: 'mon',
          slot: 'lunch',
          name: 'Sara salad',
          memberId: SARA,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`meals-filter-${ALI}`));
    });
    expect(screen.getByTestId('meals-meal-fam-name')).toBeInTheDocument(); // family always shows
    expect(screen.getByTestId('meals-meal-ali-name')).toBeInTheDocument();
    expect(screen.queryByTestId('meals-meal-sara-name')).not.toBeInTheDocument();
  });

  it('adding a meal POSTs day/slot/name/memberId/recurring and shows it after refetch', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-tue'));
    });
    expect(screen.getByTestId('meals-editor')).toBeInTheDocument();
    act(() => {
      fireEvent.change(screen.getByTestId('meals-editor-slot'), { target: { value: 'lunch' } });
      fireEvent.change(screen.getByTestId('meals-editor-member'), { target: { value: ALI } });
      fireEvent.change(screen.getByTestId('meals-editor-name'), { target: { value: 'Soup' } });
      fireEvent.click(screen.getByTestId('meals-editor-recurring'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });

    await waitFor(() => expect(screen.getByText('Soup')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      dayOfWeek: 'tue',
      slot: 'lunch',
      name: 'Soup',
      memberId: ALI,
      recurring: true,
    });
  });

  it('clicking a meal opens the editor pre-filled and saves an edit', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'wed',
          slot: 'dinner',
          name: 'Pasta',
          memberId: null,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-meal-m1'));
    });
    const input = screen.getByTestId('meals-editor-name') as HTMLInputElement;
    expect(input.value).toBe('Pasta');
    act(() => {
      fireEvent.change(input, { target: { value: 'Lasagne' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });
    await waitFor(() => expect(screen.getByText('Lasagne')).toBeInTheDocument());
  });

  it('removing a meal sends an empty name and drops it from the grid', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'thu',
          slot: 'lunch',
          name: 'Wraps',
          memberId: null,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-meal-m1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-delete'));
    });
    await waitFor(() => expect(screen.queryByTestId('meals-meal-m1-name')).not.toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string).name).toBe('');
  });

  it('shows Remove only when editing an existing meal, not when adding', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'fri',
          slot: 'dinner',
          name: 'Fish',
          memberId: null,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    // Adding → no Remove button.
    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-fri'));
    });
    expect(screen.queryByTestId('meals-editor-delete')).not.toBeInTheDocument();

    // Editing an existing meal → Remove present.
    act(() => {
      fireEvent.click(screen.getByTestId('meals-meal-m1'));
    });
    expect(screen.getByTestId('meals-editor-delete')).toBeInTheDocument();
  });

  it('Escape in the name field closes the editor', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(screen.getByTestId('meals-editor')).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(screen.getByTestId('meals-editor-name'), { key: 'Escape' });
    });
    expect(screen.queryByTestId('meals-editor')).not.toBeInTheDocument();
  });

  it('labels a meal whose member did not load as a family member, not "Everyone"', async () => {
    // Members fetch returns empty (degraded), but a meal is assigned to ALI.
    installApi({
      members: [],
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'mon',
          slot: 'lunch',
          name: 'Ali wrap',
          memberId: ALI,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    const dot = screen.getByTestId('meals-meal-m1-avatar');
    expect(dot.getAttribute('aria-label')).toBe('Family member');
  });

  it('passes the bearer token + tenant slug on requests', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
