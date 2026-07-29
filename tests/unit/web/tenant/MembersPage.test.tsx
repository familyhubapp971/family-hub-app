import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MembersPage } from '../../../../apps/web/src/pages/tenant/MembersPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// FHS-108 — Lists tenant members with role + status badges. Tests
// cover loading / error / empty / populated states + the active vs
// unclaimed status derivation.
//
// FHS-322 — AppHeader added to MembersPage. Fetch mock is now URL-aware
// so AppHeader's self-fetches (/api/me, /api/dashboard/today) don't
// consume or pollute the /api/members call ordering.

const fetchMock = vi.fn();
const authState: {
  session: { access_token?: string } | null;
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
} = {
  session: { access_token: 'fake-jwt' },
  user: { email: 'sarah@example.com', id: 'u-1', user_metadata: {} },
};

vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn().mockResolvedValue({ error: null }),
  getKidToken: vi.fn(() => null),
  clearKidToken: vi.fn(),
}));

// ── Per-test response slot ────────────────────────────────────────────────────
// Each test sets membersResponse before rendering; the URL-aware mock
// routes /api/members GET to it. Mutation calls (PUT/DELETE) are handled
// via extra mockResolvedValueOnce calls appended by the test.

let membersResponse: { ok: boolean; status?: number; json: () => Promise<unknown> } | null = null;

function installApi() {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    // AppHeader self-fetches these two on mount.
    // Use exact-path match (/api/me) to avoid catching /api/members.
    if (/\/api\/me(\?|$)/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tenants: [] }),
      });
    }
    if (u.includes('/api/dashboard/today')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: [], callerMemberId: null, counts: {} }),
      });
    }

    // /api/members GET — return whatever the test has set.
    if (u.includes('/api/members') && (!init?.method || init.method === 'GET')) {
      return Promise.resolve(
        membersResponse ?? { ok: true, status: 200, json: async () => ({ members: [] }) },
      );
    }

    // Pass-through for any test-appended mockResolvedValueOnce calls
    // (PUT /pin, DELETE /pin, GET reload after mutation, etc.).
    // The mock queue drains before this default fires.
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

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
  membersResponse = null;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'fake-jwt' };
  authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
  installApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<MembersPage />', () => {
  it('renders a loading hint while the request is in flight', () => {
    // Override just the /api/members call to hang forever.
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/members')) return new Promise(() => {});
      if (/\/api\/me(\?|$)/.test(String(url)))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ tenants: [] }) });
      if (String(url).includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [], callerMemberId: null, counts: {} }),
        });
      return new Promise(() => {});
    });
    renderAt('/t/khans/members');
    expect(screen.getByTestId('members-loading')).toBeInTheDocument();
  });

  it('renders the empty state when the tenant has no members', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    membersResponse = { ok: false, status: 500, json: async () => ({}) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-error')).toBeInTheDocument());
  });

  it('renders one row per member with role + status badges', async () => {
    membersResponse = {
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
    };
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
    membersResponse = {
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
    };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    const pending = screen.getByTestId('members-row-1-pending');
    expect(pending.textContent).toContain('signed up');
    expect(pending.textContent).toContain('jumi@example.com');
    expect(screen.getByTestId('members-row-1-resend')).toBeInTheDocument();
    // The parent role label reads "Parent", not "adult" (MP design).
    expect(screen.getByTestId('members-row-1-role').textContent).toBe('Parent');
    // FHS-278 — admin toggle visible but DISABLED until they sign up.
    const toggle = screen.getByTestId('members-row-1-admin-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.title).toContain('finish signing up');
  });

  it('admin toggle is disabled for the last admin and shown only on parent rows (FHS-276)', async () => {
    membersResponse = {
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
    };
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
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Find the /api/members call — AppHeader's /api/me and /api/dashboard/today fire first.
    const membersCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/members'));
    expect(membersCall).toBeDefined();
    const [url, init] = membersCall!;
    expect(url).toBe('http://localhost:3001/api/members');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer fake-jwt',
      'x-tenant-slug': 'khans',
    });
  });

  it('shows the global app header (brand home button) on the members page', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
    expect(screen.getByTestId('dashboard-brand-home')).toBeInTheDocument();
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
    membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
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
    // PUT + the follow-up GET via mockResolvedValueOnce (drains before
    // the URL-aware default fires).
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
    membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-row-1-pin-toggle')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('members-row-1-pin-toggle'));
    fireEvent.change(screen.getByTestId('members-row-1-pin-input'), { target: { value: '1234' } });
    fireEvent.change(screen.getByTestId('members-row-1-pin-confirm'), {
      target: { value: '5678' },
    });
    fireEvent.click(screen.getByTestId('members-row-1-pin-save'));

    expect(screen.getByTestId('members-row-1-pin-error').textContent).toMatch(/don.t match/i);
    // No PUT was fired — only the initial /api/me + /api/dashboard/today + /api/members GETs.
    const putCalls = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === 'PUT' || c[1]?.method === 'DELETE',
    );
    expect(putCalls).toHaveLength(0);
  });

  it('"Remove kid login" DELETEs the PIN and reloads the list', async () => {
    membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: true });
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
    membersResponse = listWithKid({ callerRole: 'child', kidHasPin: false });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    expect(screen.queryByTestId('members-row-1-pin-toggle')).toBeNull();
  });

  // FHS-252 — symmetry: teen role caller also blocked, locked in
  // so a future ADMIN_OR_ADULT loosening can't sneak teens in.
  it('a teen role caller does NOT see the PIN toggle either', async () => {
    membersResponse = listWithKid({ callerRole: 'teen', kidHasPin: false });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    expect(screen.queryByTestId('members-row-1-pin-toggle')).toBeNull();
  });

  // FHS-252 (qa-expert blocker #3) — server-side `detail` message
  // surfaces to the kid's adult, not the bare `error` keyword.
  // FHS-308 — Admin Panel button appears on the admin's own card.
  it('renders the Admin Panel button on the admin card and navigates on click', async () => {
    membersResponse = {
      ok: true,
      json: async () => ({
        callerRole: 'admin',
        members: [
          {
            id: 'admin-1',
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
        ],
      }),
    };
    const { container } = render(
      <MemoryRouter initialEntries={['/t/khans/members']}>
        <Routes>
          <Route
            path="/t/:slug/members"
            element={
              <TenantProvider>
                <MembersPage />
              </TenantProvider>
            }
          />
          <Route path="/t/:slug/admin" element={<div data-testid="admin-panel-page" />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('members-admin-panel-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('members-admin-panel-btn'));
    await waitFor(() => expect(screen.getByTestId('admin-panel-page')).toBeInTheDocument());
    // Suppress unused-var warning for container
    expect(container).toBeTruthy();
  });

  // FHS-437 — without this card a parent had no way to find or share the
  // kid-login link/code, so a brand-new family's kid had no working path
  // in at all.
  it('shows the kid-login share card with the family code + a working copy button', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-kid-login-share')).toBeInTheDocument());

    expect(screen.getByTestId('members-kid-login-code').textContent).toBe('khans');
    expect(screen.getByTestId('members-kid-login-url').textContent).toContain('/t/khans/kid-login');

    fireEvent.click(screen.getByTestId('members-kid-login-copy'));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/t/khans/kid-login')),
    );
    await waitFor(() =>
      expect(screen.getByTestId('members-kid-login-copy').textContent).toContain('Copied'),
    );
  });

  // FHS-471/472/473 — the generic "Add member" flow: a single control
  // opens a form that starts with a type picker (child / teen / adult)
  // instead of a child-only "Add Child" button. All three types are
  // created via the same POST /api/members no-login roster insert.
  describe('Add a family member (FHS-472/473)', () => {
    function adminOnlyList() {
      return {
        ok: true,
        json: async () => ({
          callerRole: 'admin',
          members: [
            {
              id: 'admin-1',
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
          ],
        }),
      };
    }

    it('renders an "Add member" control (not "Add Child") on the family view', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-member')).toBeInTheDocument());
      expect(screen.getByTestId('members-add-member').textContent).toContain('Add member');
      expect(screen.queryByText('Add Child')).toBeNull();
    });

    it('opens a type picker defaulting to Child with Name + Age fields', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-member')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-member'));
      expect(screen.getByTestId('members-add-member-form')).toBeInTheDocument();
      expect((screen.getByTestId('members-add-member-role') as HTMLSelectElement).value).toBe(
        'child',
      );
      expect(screen.getByTestId('members-add-member-name')).toBeInTheDocument();
      expect(screen.getByTestId('members-add-member-age')).toBeInTheDocument();
    });

    it('picking Adult hides the Age field and skips age in the create request', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-member')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-member'));

      fireEvent.change(screen.getByTestId('members-add-member-role'), {
        target: { value: 'adult' },
      });
      expect(screen.queryByTestId('members-add-member-age')).toBeNull();

      fireEvent.change(screen.getByTestId('members-add-member-name'), {
        target: { value: 'Yusuf' },
      });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-add-member-save'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-add-member-form')).not.toBeInTheDocument(),
      );
      const postCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/api/members') && c[1]?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall![1].body as string)).toEqual({
        displayName: 'Yusuf',
        role: 'adult',
      });
    });

    it('picking Teen creates a teen member (name + optional age, no login)', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-member')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-member'));

      fireEvent.change(screen.getByTestId('members-add-member-role'), {
        target: { value: 'teen' },
      });
      fireEvent.change(screen.getByTestId('members-add-member-name'), {
        target: { value: 'Zayd' },
      });
      fireEvent.change(screen.getByTestId('members-add-member-age'), {
        target: { value: '15' },
      });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-add-member-save'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-add-member-form')).not.toBeInTheDocument(),
      );
      const postCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/api/members') && c[1]?.method === 'POST',
      );
      expect(JSON.parse(postCall![1].body as string)).toEqual({
        displayName: 'Zayd',
        role: 'teen',
        age: 15,
      });
    });

    it('the dashboard\'s "+" deep link (?add=member) opens the type picker automatically', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members?add=member');
      await waitFor(() =>
        expect(screen.getByTestId('members-add-member-form')).toBeInTheDocument(),
      );
    });
  });

  it('shows the server detail message (not just "forbidden") when a 403 fires', async () => {
    membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
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
