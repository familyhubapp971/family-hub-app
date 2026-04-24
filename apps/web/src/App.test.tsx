import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

describe('<App />', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the fetched /hello payload', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'hello from @familyhub/api',
          timestamp: '2025-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof global.fetch;

    render(<App />);

    expect(screen.getByRole('heading', { name: /family hub/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('hello-message')).toHaveTextContent('hello from @familyhub/api');
    });
    expect(screen.getByTestId('hello-timestamp')).toHaveTextContent('2025-01-01T00:00:00.000Z');
  });

  it('shows an error card when the response shape is invalid', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: '', timestamp: 'not-a-date' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof global.fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('hello-error')).toHaveTextContent(/invalid/i);
    });
  });

  it('shows an error card on non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    ) as unknown as typeof global.fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('hello-error')).toHaveTextContent(/500/);
    });
  });
});
