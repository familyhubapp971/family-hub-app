import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-512 — CloseWeekDialog money-critical regression coverage. Prior to
// this ticket every sub-dialog hardcoded the sticker→cash rate at 0.5; these
// tests use a NON-default rate (0.75) so a regression back to 0.5 fails
// loudly instead of coincidentally matching.

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { CloseWeekDialog } from '../../../../../apps/web/src/pages/tenant/child/CloseWeekDialog';

const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WEEK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const HEADERS = { Authorization: 'Bearer tok' };
const RATE = 0.75;

function installFetch(
  opts: {
    savedStickers?: number;
    savedCash?: number;
    habits?: Array<{ id: string; name: string; icon?: string | null; boost?: number }>;
    investments?: unknown[];
  } = {},
) {
  const savedStickers = opts.savedStickers ?? 0;
  const savedCash = opts.savedCash ?? 0;
  const habits = opts.habits ?? [{ id: 'h1', name: 'Read a book' }];
  const investments = opts.investments ?? [];

  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          savedStickers,
          savedCash,
          currency: 'AED',
          stickerRate: RATE,
          stickerRateMinor: Math.round(RATE * 100),
        }),
      });
    }
    if (u.includes('/api/mw/financial/investments')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments }) });
    }
    if (u.includes('/api/habits')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits }) });
    }
    if (u.includes('/api/rewards')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ rewards: [] }) });
    }
    if (u.includes('/api/mw/weeks/') && u.includes('/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ unallocatedStickers: 0 }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

function renderDialog(
  subDialog: 'cashout' | 'save' | 'invest' | 'claim' | 'withdraw',
  props: Partial<React.ComponentProps<typeof CloseWeekDialog>> = {},
) {
  return render(
    <CloseWeekDialog
      isOpen
      onClose={() => {}}
      weekId={WEEK_ID}
      memberId={MEMBER_ID}
      currency="AED"
      headers={HEADERS}
      initialSubDialog={subDialog}
      {...props}
    />,
  );
}

describe('<CloseWeekDialog /> — configurable sticker rate (FHS-512)', () => {
  // CashOutDialog seeds its "amount" field once, from props, at first mount
  // (`useState(totalStickers)`). Open the MAIN dialog first and let the
  // savings fetch resolve — mirrors the real flow (a user always sees the
  // closed-book screen before tapping into Cash Out) — THEN navigate into
  // the sub-dialog so it mounts with the real (non-zero, rate-aware) values.
  async function renderMainThenOpen(action: 'cashout' | 'save' | 'invest') {
    render(
      <CloseWeekDialog
        isOpen
        onClose={() => {}}
        weekId={WEEK_ID}
        memberId={MEMBER_ID}
        currency="AED"
        headers={HEADERS}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('close-week-dialog')).toBeInTheDocument());
    // Let the savings/investments fetches resolve and commit before opening
    // the sub-dialog, so it mounts with fresh (not stale-zero) props.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).includes('/api/mw/financial/savings')),
      ).toBe(true),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByTestId(`close-week-action-${action}`));
  }

  it('CashOutDialog converts saved stickers to cash at the configured rate, not 0.5', async () => {
    installFetch({ savedStickers: 8, savedCash: 0 });
    await renderMainThenOpen('cashout');
    await waitFor(() =>
      expect(screen.getByTestId('close-week-cashout-dialog')).toBeInTheDocument(),
    );
    // 8 stickers pre-filled as the default amount; "You Receive" = 8 * 0.75 = 6.00.
    await waitFor(() => {
      const receiveText = screen.getByText(/You Receive:/i).closest('div')?.textContent ?? '';
      expect(receiveText).toContain('6.00');
      expect(receiveText).not.toContain('4.00'); // what a hardcoded 0.5 would show
    });
  });

  it('CashOutDialog switching to AED mode converts using the configured rate', async () => {
    installFetch({ savedStickers: 8, savedCash: 0 });
    await renderMainThenOpen('cashout');
    await waitFor(() =>
      expect(screen.getByTestId('close-week-cashout-dialog')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-cashout-mode-aed'));
    });
    // Switching modes converts the current sticker amount (8) into cash at
    // the configured rate: 8 * 0.75 = 6.
    await waitFor(() => {
      const input = screen.getByTestId('close-week-cashout-amount-input') as HTMLInputElement;
      expect(Number(input.value)).toBeCloseTo(6);
    });
  });

  it('SaveDialog posts the cash amount converted at the configured rate when saving as cash', async () => {
    installFetch({ savedStickers: 0, savedCash: 0 });
    renderDialog('save');
    await waitFor(() => expect(screen.getByTestId('close-week-save-dialog')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-save-type-cash'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('close-week-save-amount-input'), {
        target: { value: '10' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-save-submit-btn'));
    });
    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/mw/financial/savings') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string) as { amount: number };
      // 10 stickers-worth saved as cash at 0.75/star = 7.50, NOT 5.00 (0.5 rate).
      expect(body.amount).toBeCloseTo(7.5);
    });
  });

  it('InvestDialog shows the invested cash preview at the configured rate', async () => {
    installFetch({ savedStickers: 0, savedCash: 0 });
    renderDialog('invest', { weeklyStickers: 20 });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-dialog')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('close-week-invest-amount-input'), {
        target: { value: '10' },
      });
    });
    // Invest button label reads "Invest AED {cashVal}" — 10 * 0.75 = 7.50.
    await waitFor(() => {
      expect(screen.getByTestId('close-week-invest-submit-btn').textContent).toContain('7.50');
    });
  });
});

describe('<CloseWeekDialog /> — InvestDialog growth-rate coefficient (FHS-534)', () => {
  it('renders the 1x/2x/3x/5x growth-rate picker, defaulting to 5x', async () => {
    installFetch({ savedStickers: 0, savedCash: 0 });
    renderDialog('invest', { weeklyStickers: 20 });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-dialog')).toBeInTheDocument());

    for (const n of [1, 2, 3, 5]) {
      expect(screen.getByTestId(`close-week-invest-coefficient-${n}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('close-week-invest-coefficient-5').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByTestId('close-week-invest-coefficient-3').getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('sends the chosen coefficient in the invest POST body', async () => {
    installFetch({ savedStickers: 0, savedCash: 0, habits: [{ id: 'h1', name: 'Read a book' }] });
    renderDialog('invest', { weeklyStickers: 20 });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-dialog')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('close-week-invest-habit-h1')).toBeInTheDocument(),
    );

    act(() => {
      fireEvent.click(screen.getByTestId('close-week-invest-coefficient-3'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('close-week-invest-amount-input'), {
        target: { value: '10' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-invest-habit-h1'));
    });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-submit-btn')).toBeEnabled());
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-invest-submit-btn'));
    });

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/mw/financial/investments') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string) as {
        coefficient: number;
      };
      expect(body.coefficient).toBe(3);
    });
  });

  // FHS-534 — the growth banner + value projection must track the picked
  // coefficient, not the old hardcoded +5/day (a 1x pick projected 5x too high).
  it('projects growth at the chosen coefficient, not a hardcoded +5/day', async () => {
    installFetch({ savedStickers: 0, savedCash: 0, habits: [{ id: 'h1', name: 'Read a book' }] });
    renderDialog('invest', { weeklyStickers: 20 });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-dialog')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('close-week-invest-coefficient-3'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('close-week-invest-amount-input'), {
        target: { value: '10' },
      });
    });

    // Banner + projection now read "+3/day"; the old "+5/day" is gone.
    await waitFor(() => {
      expect(screen.getAllByText(/\+3\/day/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/\+5\/day/i)).toBeNull();
    });
  });

  it('defaults to coefficient 5 in the POST body when the picker is untouched', async () => {
    installFetch({ savedStickers: 0, savedCash: 0, habits: [{ id: 'h1', name: 'Read a book' }] });
    renderDialog('invest', { weeklyStickers: 20 });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-dialog')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('close-week-invest-habit-h1')).toBeInTheDocument(),
    );

    act(() => {
      fireEvent.change(screen.getByTestId('close-week-invest-amount-input'), {
        target: { value: '10' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-invest-habit-h1'));
    });
    await waitFor(() => expect(screen.getByTestId('close-week-invest-submit-btn')).toBeEnabled());
    act(() => {
      fireEvent.click(screen.getByTestId('close-week-invest-submit-btn'));
    });

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/mw/financial/investments') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string) as {
        coefficient: number;
      };
      expect(body.coefficient).toBe(5);
    });
  });

  it("shows the real coefficient on an already-invested habit's badge, not a hardcoded 5x", async () => {
    installFetch({
      savedStickers: 0,
      savedCash: 0,
      habits: [
        { id: 'h1', name: 'Read a book' },
        { id: 'h2', name: 'Make bed' },
      ],
      investments: [
        {
          id: 'inv1',
          habitId: 'h1',
          habitName: 'Read a book',
          habitIcon: null,
          investedStickers: 10,
          originalInvestedStickers: 10,
          currentValue: 5,
          currentValueStickers: 10,
          daysCompleted: 2,
          daysMissed: 0,
          coefficient: 2,
        },
      ],
    });
    renderDialog('invest', { weeklyStickers: 20 });
    await waitFor(() =>
      expect(screen.getByTestId('close-week-invest-habit-h1-invested-badge')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('close-week-invest-habit-h1-invested-badge').textContent).toContain(
      '2x',
    );
    expect(
      screen.getByTestId('close-week-invest-habit-h1-invested-badge').textContent,
    ).not.toContain('5x');
  });
});
