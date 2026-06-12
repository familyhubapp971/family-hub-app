import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MembersPage } from '../../../../apps/web/src/pages/tenant/MembersPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// FHS-108 — Lists tenant members with role + status badges. Tests
// cover loading / error / empty / populated states + the active vs
// unclaimed status derivation.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'fake-jwt' },
};
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/members"
          element={
            <TenantProvider>
              <MembersPage />
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
  authState.session = { access_token: 'fake-jwt' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<MembersPage />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/members');
    expect(screen.getByTestId('members-loading')).toBeInTheDocument();
  });

  it('renders the empty state when the tenant has no members', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [] }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-error')).toBeInTheDocument());
  });

  it('renders one row per member with role + status badges', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        members: [
          {
            id: 'm1',
            displayName: 'Sarah Khan',
            role: 'admin',
            avatarEmoji: '👩',
            status: 'active',
            createdAt: '2026-05-02T00:00:00.000Z',
          },
          {
            id: 'm2',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            status: 'unclaimed',
            createdAt: '2026-05-02T00:00:00.000Z',
          },
        ],
      }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());

    // Row 0 — Sarah / Admin, signed in → no pending box.
    expect(screen.getByTestId('members-row-0-name').textContent).toBe('Sarah Khan');
    expect(screen.getByTestId('members-row-0-role').textContent?.toLowerCase()).toContain('admin');
    expect(screen.queryByTestId('members-row-0-pending')).toBeNull();

    // Row 1 — Iman / Child. Kids are never "pending" (PIN login), so no
    // pending box even though the seat is unclaimed (FHS-276 design).
    expect(screen.getByTestId('members-row-1-name').textContent).toBe('Iman');
    expect(screen.getByTestId('members-row-1-role').textContent?.toLowerCase()).toContain('child');
    expect(screen.queryByTestId('members-row-1-pending')).toBeNull();
  });

  it('shows the pending box + resend on an unclaimed parent seat (FHS-276)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        callerRole: 'admin',
        members: [
          {
            id: 'm1',
            displayName: 'Sarah Khan',
            role: 'admin',
            avatarEmoji: '👩',
            status: 'active',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: false,
            hasPin: false,
            age: null,
            inviteEmail: null,
            inviteId: null,
          },
          {
            id: 'm2',
            displayName: 'Jumi',
            role: 'adult',
            avatarEmoji: null,
            status: 'unclaimed',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: false,
            hasPin: false,
            age: null,
            inviteEmail: 'jumi@example.com',
            inviteId: '44444444-4444-4444-8444-444444444444',
          },
        ],
      }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    const pending = screen.getByTestId('members-row-1-pending');
    expect(pending.textContent).toContain('signed up');
    expect(pending.textContent).toContain('jumi@example.com');
    expect(screen.getByTestId('members-row-1-resend')).toBeInTheDocument();
    // The parent role label reads "Parent", not "adult" (MP design).
    expect(screen.getByTestId('members-row-1-role').textContent).toBe('Parent');
  });

  it('admin toggle is disabled for the last admin and shown only on parent rows (FHS-276)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        callerRole: 'admin',
        members: [
          {
            id: 'm1',
            displayName: 'Sarah Khan',
            role: 'admin',
            avatarEmoji: null,
            status: 'active',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: false,
            hasPin: false,
            age: null,
            inviteEmail: null,
            inviteId: null,
          },
          {
            id: 'm2',
            displayName: 'Yusuf',
            role: 'adult',
            avatarEmoji: null,
            status: 'active',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: false,
            hasPin: false,
            age: null,
            inviteEmail: null,
            inviteId: null,
          },
          {
            id: 'm3',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            status: 'unclaimed',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: true,
            hasPin: false,
            age: 6,
            inviteEmail: null,
            inviteId: null,
          },
        ],
      }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    // Sole admin: toggle disabled. Other parent: "Make admin" enabled.
    expect((screen.getByTestId('members-row-0-admin-toggle') as HTMLButtonElement).disabled).toBe(
      true,
    );
    const make = screen.getByTestId('members-row-1-admin-toggle') as HTMLButtonElement;
    expect(make.disabled).toBe(false);
    expect(make.textContent).toContain('Make admin');
    // Kid row: no admin toggle; age shows in the badge.
    expect(screen.queryByTestId('members-row-2-admin-toggle')).toBeNull();
    expect(screen.getByTestId('members-row-2-role').textContent).toBe('Child (6)');
  });

  it('passes the tenant slug + bearer token on the request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [] }),
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/members');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer fake-jwt',
      'x-tenant-slug': 'khans',
    });
  });

  // FHS-252 — admin/adult-only PIN management on the members page.
  // Without these affordances, no real family can use kid login.

  function listWithKid(opts: { callerRole: string; kidHasPin: boolean }) {
    return {
      ok: true,
      json: async () => ({
        callerRole: opts.callerRole,
        members: [
          {
            id: 'admin-id',
            displayName: 'Sarah Khan',
            role: 'admin',
            avatarEmoji: '👩',
            status: 'active',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: false,
            hasPin: false,
          },
          {
            id: 'kid-id',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            status: 'unclaimed',
            createdAt: '2026-05-02T00:00:00.000Z',
            isChild: opts.kidHasPin,
            hasPin: opts.kidHasPin,
          },
        ],
      }),
    };
  }

  it('admin sees a "Set PIN" toggle on a kid row + can submit a fresh PIN', async () => {
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: false }));
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-row-1-pin-toggle')).toBeInTheDocument());
    expect(screen.getByTestId('members-row-1-pin-toggle').textContent).toBe('Set PIN');
    expect(screen.getByTestId('members-row-1-pin-toggle').textContent).toContain('Set PIN');

    fireEvent.click(screen.getByTestId('members-row-1-pin-toggle'));
    expect(screen.getByTestId('members-row-1-pin-form')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('members-row-1-pin-input'), { target: { value: '1234' } });
    fireEvent.change(screen.getByTestId('members-row-1-pin-confirm'), {
      target: { value: '1234' },
    });

    // PUT call returns success → form re-fetches the list. Mock the
    // PUT + the follow-up GET.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        member: { id: 'kid-id', displayName: 'Iman', isChild: true, hasPin: true },
      }),
    });
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: true }));

    fireEvent.click(screen.getByTestId('members-row-1-pin-save'));
    await waitFor(() =>
      expect(screen.getByTestId('members-row-1-pin-toggle').textContent).toContain('Reset PIN'),
    );

    const putCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].endsWith('/kid-id/pin') && c[1]?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse(putCall![1].body as string)).toEqual({ pin: '1234' });
  });

  it('mismatched PIN + Confirm shows inline error and does NOT call the API', async () => {
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: false }));
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-row-1-pin-toggle')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('members-row-1-pin-toggle'));
    fireEvent.change(screen.getByTestId('members-row-1-pin-input'), { target: { value: '1234' } });
    fireEvent.change(screen.getByTestId('members-row-1-pin-confirm'), {
      target: { value: '5678' },
    });
    fireEvent.click(screen.getByTestId('members-row-1-pin-save'));

    expect(screen.getByTestId('members-row-1-pin-error').textContent).toMatch(/don.t match/i);
    // No PUT was fired (only the initial GET).
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  it('"Remove kid login" DELETEs the PIN and reloads the list', async () => {
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: true }));
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-row-1-pin-toggle')).toBeInTheDocument());
    expect(screen.getByTestId('members-row-1-pin-toggle').textContent).toBe('Reset PIN');

    fireEvent.click(screen.getByTestId('members-row-1-pin-toggle'));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        member: { id: 'kid-id', displayName: 'Iman', isChild: false, hasPin: false },
      }),
    });
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: false }));

    fireEvent.click(screen.getByTestId('members-row-1-pin-remove'));
    await waitFor(() =>
      expect(screen.getByTestId('members-row-1-pin-toggle').textContent).toContain('Set PIN'),
    );

    const deleteCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].endsWith('/kid-id/pin') && c[1]?.method === 'DELETE',
    );
    expect(deleteCall).toBeDefined();
  });

  it('a child role caller does NOT see the PIN toggle (admin/adult only)', async () => {
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'child', kidHasPin: false }));
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    expect(screen.queryByTestId('members-row-1-pin-toggle')).toBeNull();
  });

  // FHS-252 — symmetry: teen role caller also blocked, locked in
  // so a future ADMIN_OR_ADULT loosening can't sneak teens in.
  it('a teen role caller does NOT see the PIN toggle either', async () => {
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'teen', kidHasPin: false }));
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    expect(screen.queryByTestId('members-row-1-pin-toggle')).toBeNull();
  });

  // FHS-252 (qa-expert blocker #3) — server-side `detail` message
  // surfaces to the kid's adult, not the bare `error` keyword.
  it('shows the server detail message (not just "forbidden") when a 403 fires', async () => {
    fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: false }));
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-row-1-pin-toggle')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('members-row-1-pin-toggle'));
    fireEvent.change(screen.getByTestId('members-row-1-pin-input'), { target: { value: '1234' } });
    fireEvent.change(screen.getByTestId('members-row-1-pin-confirm'), {
      target: { value: '1234' },
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'forbidden',
        detail: 'admins and adults can manage kid PINs',
      }),
    });
    fireEvent.click(screen.getByTestId('members-row-1-pin-save'));
    await waitFor(() =>
      expect(screen.getByTestId('members-row-1-pin-error').textContent).toMatch(
        /admins and adults/i,
      ),
    );
  });
});
