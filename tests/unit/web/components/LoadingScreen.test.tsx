import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoadingScreen } from '../../../../apps/web/src/components/LoadingScreen';

// FHS-419 — branded loading screen.

function renderScreen(props: Parameters<typeof LoadingScreen>[0] = {}) {
  return render(
    <MemoryRouter>
      <LoadingScreen {...props} />
    </MemoryRouter>,
  );
}

describe('LoadingScreen', () => {
  it('shows the brand loader with the primary line and a status message', () => {
    renderScreen({ context: 'callback' });
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.getByText('Signing you in…')).toBeInTheDocument();
    // The rotating message lives in an aria-live status region.
    expect(screen.getByRole('status').textContent).toMatch(/family|hub|moment|world/i);
  });

  it('shows an error message + a Back to login button when error is passed', () => {
    renderScreen({ context: 'callback', error: { message: 'That link has expired.' } });
    expect(screen.getByRole('alert').textContent).toMatch(/expired/i);
    expect(screen.getByTestId('loading-back-to-login')).toBeInTheDocument();
    // The loading status/message is replaced by the error.
    expect(screen.queryByText('Signing you in…')).not.toBeInTheDocument();
  });

  it('calls onRetry from the Try again button when onRetry is provided', () => {
    const onRetry = vi.fn();
    renderScreen({ context: 'protected', error: { message: 'Something went wrong.' }, onRetry });
    const btn = screen.getByTestId('loading-retry');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
