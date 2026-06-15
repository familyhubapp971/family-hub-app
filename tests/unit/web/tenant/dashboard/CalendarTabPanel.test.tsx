import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-265 — CalendarTabPanel (MP layout). School/Home sub-tabs, legend +
// per-child filter pills, day cards with when/where/wear rows, and the
// per-day Add Activity form. An in-memory fake backs /api/events +
// /api/members so add + refetch behave like the real API.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { CalendarTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/CalendarTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

interface Ev {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  notes: string | null;
  memberId: string | null;
  type: 'school' | 'home';
  location: string | null;
  wear: string | null;
}
interface Member {
  id: string;
  displayName: string;
  role: string;
}

const AMINA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IBRAHIM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS: Member[] = [
  { id: 'p1', displayName: 'Sarah', role: 'admin' },
  { id: AMINA, displayName: 'Amina', role: 'teen' },
  { id: IBRAHIM, displayName: 'Ibrahim', role: 'child' },
];

// This week's Monday in local time — events seeded on it always render
// in the default-loaded week.
function mondayIso(): string {
  const now = new Date();
  const copy = new Date(now);
  copy.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, '0');
  const d = String(copy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ev(over: Partial<Ev>): Ev {
  return {
    id: 'e1',
    date: mondayIso(),
    startTime: null,
    endTime: null,
    title: 'Event',
    notes: null,
    memberId: null,
    type: 'school',
    location: null,
    wear: null,
    ...over,
  };
}

function installApi(opts: { events?: Ev[]; members?: Member[]; eventsOk?: boolean }) {
  const state = { events: [...(opts.events ?? [])], members: [...(opts.members ?? MEMBERS)] };
  let gen = 0;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as Omit<Ev, 'id' | 'endTime' | 'notes'>;
      const row: Ev = {
        id: `gen-${++gen}`,
        endTime: null,
        notes: null,
        ...body,
      } as Ev;
      state.events.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'PUT') {
      const idMatch = u.match(/\/api\/events\/([^?]+)/);
      const id = idMatch?.[1];
      const body = JSON.parse(init.body as string) as Partial<Ev>;
      const idx = state.events.findIndex((e) => e.id === id);
      if (idx >= 0) state.events[idx] = { ...state.events[idx]!, ...body };
      return Promise.resolve({ ok: true, status: 200, json: async () => state.events[idx] });
    }
    if (init?.method === 'DELETE') {
      const idMatch = u.match(/\/api\/events\/([^?]+)/);
      const id = idMatch?.[1];
      state.events = state.events.filter((e) => e.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: state.members, callerRole: 'admin' }),
      });
    }
    return Promise.resolve({
      ok: opts.eventsOk ?? true,
      status: opts.eventsOk === false ? 500 : 200,
      json: async () => ({ weekStart: mondayIso(), events: state.events }),
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
              <CalendarTabPanel />
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

describe('<CalendarTabPanel />', () => {
  it('renders a loading hint while requests are in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument();
  });

  it('renders the inline error when the events API fails', async () => {
    installApi({ eventsOk: false });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-error')).toBeInTheDocument());
  });

  it('renders 7 day cards, the sub-tabs, legend, filter pills and the Today pill', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId('calendar-subtab-school')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-subtab-home')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-legend')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-filter-family')).toBeInTheDocument();
    expect(screen.getByTestId(`calendar-filter-${AMINA}`)).toBeInTheDocument();
    // Only kids get filter pills — the admin doesn't.
    expect(screen.queryByTestId('calendar-filter-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-today-pill')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-week-label')).toBeInTheDocument();
  });

  it('shows an event row with title, when, where, and wear', async () => {
    installApi({
      events: [
        ev({
          id: 'e1',
          title: 'Swimming Lesson',
          startTime: '15:00',
          memberId: AMINA,
          location: 'Leisure Centre',
          wear: 'Swimsuit and towel',
        }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId('calendar-event-e1-title').textContent).toBe('Swimming Lesson');
    expect(screen.getByTestId('calendar-event-e1-location').textContent).toBe('Leisure Centre');
    expect(screen.getByTestId('calendar-event-e1-wear').textContent).toBe('Swimsuit and towel');
    expect(screen.getByLabelText('Amina')).toBeInTheDocument();
  });

  it('School/Home sub-tabs split events by type', async () => {
    installApi({
      events: [
        ev({ id: 'sch', title: 'PE Day', type: 'school' }),
        ev({ id: 'hom', title: 'Park visit', type: 'home' }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    // Default = School (founder's call; matches the mockup).
    expect(screen.getByTestId('calendar-event-sch')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-event-hom')).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-subtab-home'));
    });
    expect(screen.queryByTestId('calendar-event-sch')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-event-hom')).toBeInTheDocument();
  });

  it('member filter pill narrows to only that member — excludes family events', async () => {
    installApi({
      events: [
        ev({ id: 'am', title: 'Amina swim', memberId: AMINA }),
        ev({ id: 'ib', title: 'Ibrahim football', memberId: IBRAHIM }),
        ev({ id: 'fam', title: 'Family picnic', memberId: null }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-filter-${AMINA}`));
    });
    expect(screen.getByTestId('calendar-event-am')).toBeInTheDocument();
    // family event must NOT show under a member-specific filter
    expect(screen.queryByTestId('calendar-event-fam')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-event-ib')).not.toBeInTheDocument();
  });

  it('Family filter pill shows only family-wide events', async () => {
    installApi({
      events: [
        ev({ id: 'am', title: 'Amina swim', memberId: AMINA }),
        ev({ id: 'fam', title: 'Family picnic', memberId: null }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-filter-family'));
    });
    expect(screen.getByTestId('calendar-event-fam')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-event-am')).not.toBeInTheDocument();
  });

  it('adding an activity POSTs date/title/time/member/type/location/wear and shows it', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    const monday = mondayIso();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-add-${monday}`));
    });
    expect(screen.getByTestId('calendar-add-form')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-form-child-${AMINA}`));
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'Swimming Lesson' },
      });
      fireEvent.change(screen.getByTestId('calendar-form-when'), { target: { value: '15:00' } });
      fireEvent.change(screen.getByTestId('calendar-form-where'), {
        target: { value: 'Leisure Centre' },
      });
      fireEvent.change(screen.getByTestId('calendar-form-wear'), {
        target: { value: 'Swimsuit' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });

    await waitFor(() => expect(screen.getByText('Swimming Lesson')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      date: monday,
      title: 'Swimming Lesson',
      startTime: '15:00',
      endTime: null,
      memberId: AMINA,
      type: 'school',
      location: 'Leisure Centre',
      wear: 'Swimsuit',
      notes: null,
    });
  });

  it('checking two children saves a whole-family event (memberId null)', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    const monday = mondayIso();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-add-${monday}`));
    });
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-form-child-${AMINA}`));
      fireEvent.click(screen.getByTestId(`calendar-form-child-${IBRAHIM}`));
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'Dentist' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string).memberId).toBeNull();
  });

  it('edit button pre-fills the form and save issues a PUT', async () => {
    const existingEv = ev({
      id: 'e-edit',
      title: 'Old Title',
      memberId: AMINA,
      startTime: '10:00',
      location: 'School',
      wear: 'Uniform',
    });
    installApi({ events: [existingEv] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-edit-e-edit'));
    });
    // Form should be open with pre-filled title
    expect(screen.getByTestId('calendar-add-form')).toBeInTheDocument();
    expect((screen.getByTestId('calendar-form-title') as HTMLInputElement).value).toBe('Old Title');

    act(() => {
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'New Title' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/events/e-edit') && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse((putCall![1] as RequestInit).body as string).title).toBe('New Title');
  });

  it('delete button calls DELETE /api/events/:id and reloads', async () => {
    const existingEv = ev({ id: 'e-del', title: 'To Delete', memberId: AMINA });
    installApi({ events: [existingEv] });
    vi.stubGlobal('confirm', () => true);
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    fetchMock.mockImplementationOnce((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/events/e-del') && init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ events: [] }) });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-delete-e-del'));
    });

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/events/e-del') && init?.method === 'DELETE',
    );
    expect(deleteCall).toBeTruthy();
  });

  it('the saved event type follows the active sub-tab', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-subtab-home'));
    });
    const monday = mondayIso();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-add-${monday}`));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'Park visit' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string).type).toBe('home');
  });

  it('shows the friendly empty state on a day with no activities', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`calendar-day-${mondayIso()}-empty`)).toBeInTheDocument();
    expect(screen.getAllByText('No activities scheduled').length).toBeGreaterThan(0);
  });

  it('passes the bearer token + tenant slug and a weekStart query', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/events?weekStart=');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
