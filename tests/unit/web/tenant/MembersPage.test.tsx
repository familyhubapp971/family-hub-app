import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MembersPage } from '../../../../apps/web/src/pages/tenant/MembersPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// FHS-513 — Manage Family rebuild to the finalised Magic Patterns design:
// header CTAs ("Invite an adult" / "Add a child"), members split into
// collapsible "Grown-ups" (email login) / "Kids" (PIN login) groups, a
// "How your kids sign in" helper card, and a separate "Waiting to join"
// section for unclaimed grown-up seats. Everything under here that was
// covered before FHS-513 (FHS-108 / FHS-252 / FHS-276 / FHS-471/472/473 /
// FHS-486) is re-covered against the new structure — no behaviour dropped,
// only the "Add a plain adult with no login" path (removed from the UI;
// see the ticket's decision notes).
//
// FHS-322 — AppHeader added to MembersPage. Fetch mock is now URL-aware
// so AppHeader's + MembersPage's own self-fetches (/api/me,
// /api/dashboard/today) don't consume or pollute the /api/members call
// ordering.

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
// routes /api/members GET to it. Mutation calls (PUT/DELETE/POST/PATCH)
// are handled via extra mockResolvedValueOnce calls appended by the test.

let membersResponse: { ok: boolean; status?: number; json: () => Promise<unknown> } | null = null;

function installApi() {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    // AppHeader + MembersPage self-fetches. Exact-path match on /api/me
    // to avoid catching /api/members.
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
    // (POST/PATCH/DELETE, GET reload after mutation, etc.). The mock
    // queue drains before this default fires.
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

// ── Shared fixtures ─────────────────────────────────────────────────────────

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

function fullFamilyList() {
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
        {
          id: 'adult-1',
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
          id: 'kid-1',
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
        {
          id: 'pending-1',
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
}

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
          age: null,
          inviteEmail: null,
          inviteId: null,
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
          age: null,
          inviteEmail: null,
          inviteId: null,
        },
      ],
    }),
  };
}

describe('<MembersPage />', () => {
  it('renders a loading hint while the request is in flight', () => {
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

  it('renders the "Nobody here yet" empty state when the tenant has no members', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
    expect(screen.getByTestId('members-empty').textContent).toBe('Nobody here yet');
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    membersResponse = { ok: false, status: 500, json: async () => ({}) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-error')).toBeInTheDocument());
  });

  it('shows the global app header (brand home button) on the members page', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
    expect(screen.getByTestId('dashboard-brand-home')).toBeInTheDocument();
  });

  it('shows the family name + "N members · M waiting to join" summary', async () => {
    membersResponse = fullFamilyList();
    renderAt('/t/khans/members');
    // 3 members (admin + adult + kid) count as "members"; the unclaimed
    // adult ("Jumi") counts as "waiting to join", not as a member. Wait for
    // the loaded text — the summary renders "0 members · 0 waiting to join"
    // before the fetch resolves, so asserting on presence alone races.
    await waitFor(() =>
      expect(screen.getByTestId('members-summary').textContent).toBe(
        '3 members · 1 waiting to join',
      ),
    );
  });

  describe('Grown-ups / Kids groups', () => {
    it('splits members into the Grown-ups and Kids collapsible groups', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());

      expect(screen.getByTestId('members-grownup-0-name').textContent).toBe('Sarah Khan');
      expect(screen.getByTestId('members-grownup-1-name').textContent).toBe('Yusuf');
      expect(screen.getByTestId('members-kid-0-name').textContent).toBe('Iman');
      // The unclaimed adult does NOT show up in the Grown-ups grid.
      expect(screen.queryByText('Jumi')).toBeInTheDocument(); // still shown, but in Waiting to join
      expect(screen.getByTestId('members-waiting-0-name').textContent).toBe('Jumi');
    });

    it('shows "Sign in with email" / "Sign in with a PIN" subtitles on each group', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.getByText('Sign in with email')).toBeInTheDocument();
      expect(screen.getByText('Sign in with a PIN')).toBeInTheDocument();
    });

    it('collapses and re-expands a group when its header is clicked', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-group-grownups-toggle'));
      expect(screen.queryByTestId('members-grownup-0-name')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('members-group-grownups-toggle'));
      expect(screen.getByTestId('members-grownup-0-name')).toBeInTheDocument();
    });

    it('shows the child/teen "signs in with a PIN, cannot be given admin" panel on a kid card', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-kid-0-name')).toBeInTheDocument());
      expect(screen.getByTestId('members-kid-0-account-note').textContent).toContain(
        'Signs in with a PIN, cannot be given admin',
      );
    });

    it('shows role badges with the design colours (admin/adult/teen/child/guest)', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-grownup-0-role')).toBeInTheDocument());
      expect(screen.getByTestId('members-grownup-0-role').textContent).toBe('Admin');
      expect(screen.getByTestId('members-grownup-1-role').textContent).toBe('Adult');
      expect(screen.getByTestId('members-kid-0-role').textContent).toBe('Child (6)');
    });

    it('does not show an admin toggle on a grown-up when the caller is not admin', async () => {
      membersResponse = fullFamilyList();
      // Force a non-admin caller so the header CTAs + admin toggles hide.
      membersResponse.json = async () => ({
        callerRole: 'adult',
        members: (await fullFamilyList().json()).members,
      });
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-grownup-0-admin-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-invite-adult')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-add-child')).not.toBeInTheDocument();
    });
  });

  describe('Waiting to join', () => {
    it('renders a "Waiting to join" section with the pending email + a Resend button', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-waiting-section')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('members-waiting-0-status').textContent).toBe('jumi@example.com');
      expect(screen.getByTestId('members-waiting-0-pending').textContent).toContain('signed up');
      expect(screen.getByTestId('members-waiting-0-resend')).toBeInTheDocument();
      // FHS-278 lock — an unclaimed seat never exposes an admin toggle (you
      // can't promote someone who hasn't signed up yet).
      expect(screen.queryByTestId('members-waiting-0-admin-toggle')).not.toBeInTheDocument();

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ resent: true }) });
      fireEvent.click(screen.getByTestId('members-waiting-0-resend'));
      await waitFor(() => {
        const resendCall = fetchMock.mock.calls.find(
          (c) =>
            typeof c[0] === 'string' &&
            c[0].includes('/api/invitations/44444444-4444-4444-8444-444444444444/resend'),
        );
        expect(resendCall).toBeDefined();
      });
    });

    it('does not render the "Waiting to join" section when nobody is pending', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-waiting-section')).not.toBeInTheDocument();
    });
  });

  describe('How your kids sign in', () => {
    it('shows the kid-login card with the family code + a working copy button', async () => {
      membersResponse = adminOnlyList();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-login-share')).toBeInTheDocument(),
      );

      expect(screen.getByText('How your kids sign in')).toBeInTheDocument();
      expect(screen.getByTestId('members-kid-login-code').textContent).toBe('khans');
      expect(screen.getByTestId('members-kid-login-url').textContent).toContain(
        '/t/khans/kid-login',
      );

      fireEvent.click(screen.getByTestId('members-kid-login-copy'));
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/t/khans/kid-login')),
      );
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-login-copy').textContent).toContain('Copied'),
      );
    });

    it('is collapsible', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-login-share')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('members-kid-login-share-toggle'));
      expect(screen.queryByTestId('members-kid-login-url')).not.toBeInTheDocument();
    });
  });

  describe('Header CTAs', () => {
    it('renders "Invite an adult" and "Add a child" (not the old "Invite member" / "Add member")', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      expect(screen.getByTestId('members-invite-adult').textContent).toContain('Invite an adult');
      expect(screen.getByTestId('members-add-child').textContent).toContain('Add a child');
      expect(screen.queryByText('Invite member')).toBeNull();
      expect(screen.queryByText('Add member')).toBeNull();
    });

    it('the dashboard\'s "+" deep link (?add=member) still opens the Add-a-child form', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members?add=member');
      await waitFor(() => expect(screen.getByTestId('members-add-child-form')).toBeInTheDocument());
    });
  });

  describe('Invite an adult (FHS-486 role picker, no Teen)', () => {
    it('opens a role picker defaulting to Adult, with no Teen option', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));
      expect(screen.getByTestId('members-invite-form')).toBeInTheDocument();
      expect((screen.getByTestId('members-invite-role') as HTMLSelectElement).value).toBe('adult');
      const options = screen.getByTestId('members-invite-role').querySelectorAll('option');
      const labels = Array.from(options).map((o) => o.textContent);
      expect(labels).toEqual(['Parent / partner', 'Adult', 'Guest']);
    });

    it('hides the admin-only "Parent / partner" option for a non-admin caller', async () => {
      membersResponse = {
        ok: true,
        json: async () => ({
          callerRole: 'adult',
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
            {
              id: 'adult-1',
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
          ],
        }),
      };
      renderAt('/t/khans/members');
      // Non-admin caller: no header CTAs at all (mutations are admin-only).
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-invite-adult')).not.toBeInTheDocument();
    });

    it('sends the chosen role (admin) on submit — not hardcoded "adult"', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));

      fireEvent.change(screen.getByTestId('members-invite-role'), { target: { value: 'admin' } });
      fireEvent.change(screen.getByTestId('members-invite-email'), {
        target: { value: 'partner@example.com' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invitation: { id: 'inv-1', role: 'admin', status: 'pending' } }),
      });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-invite-send'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-invite-form')).not.toBeInTheDocument(),
      );
      const postCall = fetchMock.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' && c[0].endsWith('/api/invitations') && c[1]?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall![1].body as string)).toEqual({
        email: 'partner@example.com',
        role: 'admin',
      });
    });

    it("surfaces the server's 403 detail on submit", async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));

      fireEvent.change(screen.getByTestId('members-invite-email'), {
        target: { value: 'partner@example.com' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'forbidden',
          detail: 'only an admin can invite someone as admin',
        }),
      });
      fireEvent.click(screen.getByTestId('members-invite-send'));
      await waitFor(() =>
        expect(screen.getByTestId('members-invite-error').textContent).toMatch(/only an admin/i),
      );
    });

    it('the submit button reads "Send sign-in link"', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));
      expect(screen.getByTestId('members-invite-send').textContent?.trim()).toBe(
        'Send sign-in link',
      );
    });
  });

  describe('Add a child (FHS-472/473, child/teen only)', () => {
    it('opens a Child/Teen picker defaulting to Child with Name, Age + emoji picker', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));
      expect(screen.getByTestId('members-add-child-form')).toBeInTheDocument();
      expect((screen.getByTestId('members-add-child-role') as HTMLSelectElement).value).toBe(
        'child',
      );
      expect(screen.getByTestId('members-add-child-name')).toBeInTheDocument();
      expect(screen.getByTestId('members-add-child-age')).toBeInTheDocument();
      expect(screen.getByTestId('members-add-child-emoji')).toBeInTheDocument();
      // No "Adult" option any more — the plain no-login adult path moved
      // to Invite.
      const options = Array.from(
        screen.getByTestId('members-add-child-role').querySelectorAll('option'),
      ).map((o) => o.textContent);
      expect(options).toEqual(['Child', 'Teen']);
    });

    it('picking Teen creates a teen member (name + age, no login)', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));

      fireEvent.change(screen.getByTestId('members-add-child-role'), {
        target: { value: 'teen' },
      });
      fireEvent.change(screen.getByTestId('members-add-child-name'), {
        target: { value: 'Zayd' },
      });
      fireEvent.change(screen.getByTestId('members-add-child-age'), {
        target: { value: '15' },
      });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-add-child-save'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-add-child-form')).not.toBeInTheDocument(),
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

    it('picking an avatar emoji includes it in the create request', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));

      fireEvent.change(screen.getByTestId('members-add-child-name'), {
        target: { value: 'Amina' },
      });
      fireEvent.click(screen.getByTestId('members-add-child-emoji-emoji-0'));

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-add-child-save'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-add-child-form')).not.toBeInTheDocument(),
      );
      const postCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/api/members') && c[1]?.method === 'POST',
      );
      const body = JSON.parse(postCall![1].body as string);
      expect(body.displayName).toBe('Amina');
      expect(body.avatarEmoji).toBeTruthy();
    });

    it('the submit button reads "Add to the family"', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));
      expect(screen.getByTestId('members-add-child-save').textContent?.trim()).toBe(
        'Add to the family',
      );
    });
  });

  // FHS-252 — admin/adult-only PIN management, kept covered on the new
  // per-card testId scheme.
  describe('Kid PIN management (FHS-252)', () => {
    it('admin sees a "Set PIN" toggle on a kid card + can submit a fresh PIN', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Set PIN');

      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      expect(screen.getByTestId('members-kid-0-pin-form')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('members-kid-0-pin-input'), {
        target: { value: '1234' },
      });
      fireEvent.change(screen.getByTestId('members-kid-0-pin-confirm'), {
        target: { value: '1234' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { id: 'kid-id', displayName: 'Iman', isChild: true, hasPin: true },
        }),
      });
      fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: true }));

      fireEvent.click(screen.getByTestId('members-kid-0-pin-save'));
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Reset PIN'),
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
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      fireEvent.change(screen.getByTestId('members-kid-0-pin-input'), {
        target: { value: '1234' },
      });
      fireEvent.change(screen.getByTestId('members-kid-0-pin-confirm'), {
        target: { value: '5678' },
      });
      fireEvent.click(screen.getByTestId('members-kid-0-pin-save'));

      expect(screen.getByTestId('members-kid-0-pin-error').textContent).toMatch(/don.t match/i);
      const putCalls = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === 'PUT' || c[1]?.method === 'DELETE',
      );
      expect(putCalls).toHaveLength(0);
    });

    it('"Remove kid login" DELETEs the PIN and reloads the list', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: true });
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Reset PIN');

      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { id: 'kid-id', displayName: 'Iman', isChild: false, hasPin: false },
        }),
      });
      fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: false }));

      fireEvent.click(screen.getByTestId('members-kid-0-pin-remove'));
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Set PIN'),
      );

      const deleteCall = fetchMock.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' && c[0].endsWith('/kid-id/pin') && c[1]?.method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
    });

    it('a child role caller does NOT see the PIN toggle (admin/adult only)', async () => {
      membersResponse = listWithKid({ callerRole: 'child', kidHasPin: false });
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-kid-0-name')).toBeInTheDocument());
      expect(screen.queryByTestId('members-kid-0-pin-toggle')).not.toBeInTheDocument();
    });

    it('a teen role caller does NOT see the PIN toggle either', async () => {
      membersResponse = listWithKid({ callerRole: 'teen', kidHasPin: false });
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-kid-0-name')).toBeInTheDocument());
      expect(screen.queryByTestId('members-kid-0-pin-toggle')).not.toBeInTheDocument();
    });

    it('shows the server detail message (not just "forbidden") when a 403 fires', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      fireEvent.change(screen.getByTestId('members-kid-0-pin-input'), {
        target: { value: '1234' },
      });
      fireEvent.change(screen.getByTestId('members-kid-0-pin-confirm'), {
        target: { value: '1234' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'forbidden', detail: 'admins and adults can manage kid PINs' }),
      });
      fireEvent.click(screen.getByTestId('members-kid-0-pin-save'));
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-error').textContent).toMatch(
          /admins and adults/i,
        ),
      );
    });
  });

  describe('Edit name, admin toggle, Admin Panel, Remove — grown-up card actions', () => {
    it('edits a grown-up name via the inline edit form', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-1-edit-name')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('members-grownup-1-edit-name'));
      fireEvent.change(screen.getByTestId('members-grownup-1-edit-input'), {
        target: { value: 'Yusuf Khan' },
      });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(fullFamilyList());
      fireEvent.click(screen.getByTestId('members-grownup-1-edit-save'));
      await waitFor(() =>
        expect(screen.queryByTestId('members-grownup-1-edit-form')).not.toBeInTheDocument(),
      );
      const patchCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/adult-1') && c[1]?.method === 'PATCH',
      );
      expect(JSON.parse(patchCall![1].body as string)).toEqual({ displayName: 'Yusuf Khan' });
    });

    it('the "Change email" button is disabled with a coming-soon note (FHS-510 not built yet)', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-0-change-email')).toBeInTheDocument(),
      );
      const btn = screen.getByTestId('members-grownup-0-change-email') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.title).toMatch(/coming soon/i);
    });

    it('admin toggle is disabled for the last admin and enabled ("Make admin") on another parent', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-0-admin-toggle')).toBeInTheDocument(),
      );
      expect(
        (screen.getByTestId('members-grownup-0-admin-toggle') as HTMLButtonElement).disabled,
      ).toBe(true);
      const make = screen.getByTestId('members-grownup-1-admin-toggle') as HTMLButtonElement;
      expect(make.disabled).toBe(false);
      expect(make.textContent).toContain('Make admin');
      // Kid cards never show an admin toggle.
      expect(screen.queryByTestId('members-kid-0-admin-toggle')).not.toBeInTheDocument();
    });

    it('renders the Admin Panel button on the admin card and navigates on click', async () => {
      membersResponse = adminOnlyList();
      render(
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
      await waitFor(() =>
        expect(screen.getByTestId('members-admin-panel-btn')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('members-admin-panel-btn'));
      await waitFor(() => expect(screen.getByTestId('admin-panel-page')).toBeInTheDocument());
    });

    it('remove is last-admin-protected on the sole admin, and works on a second grown-up', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-0-remove')).toBeInTheDocument(),
      );
      expect((screen.getByTestId('members-grownup-0-remove') as HTMLButtonElement).disabled).toBe(
        true,
      );

      const removeBtn = screen.getByTestId('members-grownup-1-remove') as HTMLButtonElement;
      expect(removeBtn.disabled).toBe(false);
      fireEvent.click(removeBtn);
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-grownup-1-remove-confirm'));
      await waitFor(() => {
        const deleteCall = fetchMock.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].endsWith('/adult-1') && c[1]?.method === 'DELETE',
        );
        expect(deleteCall).toBeDefined();
      });
    });
  });

  it('passes the tenant slug + bearer token on the /api/members request', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const membersCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/members'));
    expect(membersCall).toBeDefined();
    const [url, init] = membersCall!;
    expect(url).toBe('http://localhost:3001/api/members');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer fake-jwt',
      'x-tenant-slug': 'khans',
    });
  });
});
