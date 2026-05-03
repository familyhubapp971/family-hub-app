import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-230 — CalendarTabPanel.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { CalendarTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/CalendarTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

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
  // Pin the clock so mondayOf(today) is deterministic. 2026-05-06 is a
  // Wednesday → Monday is 2026-05-04. Fake ONLY Date so waitFor()'s
  // setInterval polling still runs — full fake timers freeze the loop
  // and every async assertion times out.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<CalendarTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument();
  });

  it('fires GET /api/events with the current Monday on first render', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ weekStart: '2026-05-04', events: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/events?weekStart=2026-05-04');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-error')).toBeInTheDocument());
  });

  it('places events under the correct day-column', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        weekStart: '2026-05-04',
        events: [
          {
            id: 'e1',
            date: '2026-05-04', // Mon (day-0)
            startTime: '09:00',
            endTime: null,
            title: 'Swim',
            notes: null,
            memberId: null,
          },
          {
            id: 'e2',
            date: '2026-05-08', // Fri (day-4)
            startTime: null,
            endTime: null,
            title: 'School trip',
            notes: null,
            memberId: null,
          },
        ],
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId('calendar-event-e1').textContent).toContain('Swim');
    // Event e1 sits in day-0 (Mon); event e2 in day-4 (Fri).
    const monday = screen.getByTestId('calendar-day-0');
    const friday = screen.getByTestId('calendar-day-4');
    expect(monday).toContainElement(screen.getByTestId('calendar-event-e1'));
    expect(friday).toContainElement(screen.getByTestId('calendar-event-e2'));
  });

  it('Prev / Next / Today change the week and refire the fetch', async () => {
    fetchMock
      // Initial week (2026-05-04)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ weekStart: '2026-05-04', events: [] }),
      })
      // Prev week (2026-04-27)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ weekStart: '2026-04-27', events: [] }),
      })
      // Next week — back to 2026-05-04 after Today click
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ weekStart: '2026-05-04', events: [] }),
      });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-prev'));
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/events?weekStart=2026-04-27');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-today'));
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/events?weekStart=2026-05-04');
    });
  });

  it('+ Add opens the inline form; submitting POSTs and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ weekStart: '2026-05-04', events: [] }),
      })
      // POST
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'e1',
          date: '2026-05-05',
          startTime: '09:00',
          endTime: null,
          title: 'Dentist',
          notes: null,
          memberId: null,
        }),
      })
      // Refetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          weekStart: '2026-05-04',
          events: [
            {
              id: 'e1',
              date: '2026-05-05',
              startTime: '09:00',
              endTime: null,
              title: 'Dentist',
              notes: null,
              memberId: null,
            },
          ],
        }),
      });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-add'));
    });
    expect(screen.getByTestId('calendar-add-form')).toBeInTheDocument();

    act(() => {
      fireEvent.change(screen.getByTestId('calendar-add-date'), {
        target: { value: '2026-05-05' },
      });
      fireEvent.change(screen.getByTestId('calendar-add-title'), {
        target: { value: 'Dentist' },
      });
      fireEvent.change(screen.getByTestId('calendar-add-start'), {
        target: { value: '09:00' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-add-submit'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('calendar-event-e1').textContent).toContain('Dentist'),
    );

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      date: '2026-05-05',
      title: 'Dentist',
      startTime: '09:00',
    });
  });

  it("highlights today's day-column with aria-current=date", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ weekStart: '2026-05-04', events: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    // Pinned clock = 2026-05-06 (Wednesday) → day-2 in a Mon-start week.
    const today = screen.getByTestId('calendar-day-2');
    expect(today.getAttribute('aria-current')).toBe('date');
    const otherDay = screen.getByTestId('calendar-day-0');
    expect(otherDay.getAttribute('aria-current')).toBeNull();
  });

  it('returns focus to the + Add button after Cancel', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ weekStart: '2026-05-04', events: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    const addBtn = screen.getByTestId('calendar-add');
    act(() => {
      fireEvent.click(addBtn);
    });
    act(() => {
      fireEvent.click(screen.getByTestId('calendar-add-cancel'));
    });
    // requestAnimationFrame fires inside act when timers are real; flush.
    await waitFor(() => expect(addBtn).toHaveFocus());
  });

  it('shows an inline error if the title is blank when submitting', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ weekStart: '2026-05-04', events: [] }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-add'));
    });
    // Submit the form via the form element to bypass the native
    // `required` HTML5 check (jsdom otherwise blocks the submit).
    const form = screen.getByTestId('calendar-add-form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByTestId('calendar-add-error').textContent).toContain('Title');
  });
});
