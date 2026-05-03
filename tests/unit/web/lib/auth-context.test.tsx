import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';

// vi.mock factories are hoisted above import statements; vi.hoisted()
// is the only safe way to share mutable refs (the captured
// onAuthStateChange callback, the getSession mock) between the factory
// and the test bodies.
const mocks = vi.hoisted(() => {
  return {
    authCallback: null as ((event: string, session: Session | null) => void) | null,
    getSessionMock: vi.fn(),
    unsubscribeMock: vi.fn(),
  };
});

vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      onAuthStateChange: (cb: (event: string, session: Session | null) => void) => {
        mocks.authCallback = cb;
        return { data: { subscription: { unsubscribe: mocks.unsubscribeMock } } };
      },
    },
  },
}));

// Imported AFTER vi.mock so the provider sees the mocked module.
import { AuthProvider, useAuth } from '../../../../apps/web/src/lib/auth-context';

function Probe() {
  const { session, user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-email">{user?.email ?? 'none'}</span>
      <span data-testid="session-id">{session?.access_token ?? 'none'}</span>
    </div>
  );
}

const fakeSession = (email: string): Session =>
  ({
    access_token: `token-${email}`,
    refresh_token: 'rt',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 0,
    user: {
      id: 'user-id',
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    },
  }) as unknown as Session;

describe('AuthProvider + useAuth', () => {
  beforeEach(() => {
    mocks.authCallback = null;
    mocks.getSessionMock.mockReset();
    mocks.unsubscribeMock.mockReset();
  });

  it('starts in loading state and clears once getSession resolves with no session', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // Initial paint: loading=true.
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('none');
  });

  it('exposes the session when SIGNED_IN fires', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      mocks.authCallback?.('SIGNED_IN', fakeSession('user@example.com'));
    });

    expect(screen.getByTestId('user-email').textContent).toBe('user@example.com');
    expect(screen.getByTestId('session-id').textContent).toBe('token-user@example.com');
  });

  it('clears the session when SIGNED_OUT fires', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: fakeSession('user@example.com') } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email').textContent).toBe('user@example.com');
    });

    await act(async () => {
      mocks.authCallback?.('SIGNED_OUT', null);
    });

    expect(screen.getByTestId('user-email').textContent).toBe('none');
    expect(screen.getByTestId('session-id').textContent).toBe('none');
  });

  it('unsubscribes on unmount to avoid setState on an unmounted component', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    unmount();

    expect(mocks.unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
