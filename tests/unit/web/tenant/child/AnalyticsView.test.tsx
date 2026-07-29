// FHS-481 — Unit test for AnalyticsView's summary tile label.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { AnalyticsView } from '../../../../../apps/web/src/pages/tenant/child/AnalyticsView';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function mockAnalytics(body: unknown) {
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok: true, status: 200, json: async () => body }),
  );
}

describe('<AnalyticsView />', () => {
  it('labels the sticker summary tile "Current Value", not "Potential Value" (FHS-481)', async () => {
    mockAnalytics({
      stickersPerWeek: [
        {
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          totalStickers: 12,
          completionRate: 60,
        },
      ],
      habitStats: [],
    });
    render(<AnalyticsView analyticsUrl="/api/mw/analytics" headers={{}} />);

    await waitFor(() => expect(screen.getByTestId('analytics-view')).toBeInTheDocument());
    expect(screen.getByTestId('analytics-summary-total-stickers')).toHaveTextContent(
      'Current Value',
    );
    expect(screen.queryByText('Potential Value')).not.toBeInTheDocument();
  });
});
