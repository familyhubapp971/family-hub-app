import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-367 — kid Learn reuses LearnTab in kid mode: lesson subjects + reading
// log via the token-scoped /api/kid/learn + /api/kid/reading-log (no memberId).
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => ({ session: null }),
}));
vi.mock('../../../../../apps/web/src/lib/tenant-context', () => ({
  useTenantSlug: () => 'khan',
}));

import { KidLearnPanel } from '../../../../../apps/web/src/pages/tenant/kid/KidLearnPanel';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/kid/learn')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          subjects: [
            { subject: 'Maths', progress: 20 },
            { subject: 'Science', progress: 0 },
            { subject: 'Logic', progress: 0 },
          ],
        }),
      });
    }
    if (u.includes('/api/kid/reading-log')) {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'b1',
            title: 'Matilda',
            author: null,
            finished: false,
            createdAt: '2026-06-22T00:00:00.000Z',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidLearnPanel />', () => {
  it('renders the kid lesson subjects from the kid endpoint (no memberId)', async () => {
    render(<KidLearnPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('learn-tab')).toBeInTheDocument());
    expect(screen.getByText('Maths')).toBeInTheDocument();
    const learnCall = fetchMock.mock.calls.find(([u]) => /\/api\/kid\/learn(\?|$)/.test(String(u)));
    expect(learnCall).toBeTruthy();
    expect(String(learnCall![0])).not.toContain('memberId');
  });

  it('adds a book via POST /api/kid/reading-log with no memberId', async () => {
    render(<KidLearnPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('reading-log-add-title'), { target: { value: 'Matilda' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reading-log-add-submit'));
    });
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, o]) =>
          String(u).includes('/api/kid/reading-log') && (o as RequestInit)?.method === 'POST',
      );
      expect(post).toBeTruthy();
      const body = JSON.parse((post![1] as RequestInit).body as string);
      expect(body.title).toBe('Matilda');
      expect(body.memberId).toBeUndefined();
    });
  });
});
