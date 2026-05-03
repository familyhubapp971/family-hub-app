import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OnboardingPage } from '../../../../apps/web/src/pages/tenant/OnboardingPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// FHS-36 — OnboardingWizard tests. Cover the four AC dimensions:
// - gate (skip wizard if onboarding_completed=true on mount)
// - back/forward without losing state
// - final submit POSTs everything in one request → /dashboard
// - progress bar reflects the current step

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
          path="/t/:slug/onboarding"
          element={
            <TenantProvider>
              <OnboardingPage />
            </TenantProvider>
          }
        />
        <Route
          path="/t/:slug/dashboard"
          element={<div data-testid="route-marker">tenant-dashboard</div>}
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

describe('<OnboardingPage />', () => {
  it('redirects to /dashboard on mount when onboarding is already completed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tenants: [{ slug: 'khans', onboardingCompleted: true }],
      }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-dashboard'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt' }),
      }),
    );
  });

  it('renders the wizard when the tenant has not been onboarded', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tenants: [{ slug: 'khans', onboardingCompleted: false }],
      }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() => expect(screen.getByTestId('onboarding-step-welcome')).toBeInTheDocument());
    // Stepper shows step 1.
    expect(screen.getByTestId('onboarding-stepper').getAttribute('aria-label')).toMatch(
      /step 1 of 5/i,
    );
  });

  it('walks forward and back without losing member-step state', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'khans', onboardingCompleted: false }] }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    // Step 1 → 2.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-members')).toBeInTheDocument();

    // Type a name into the first member row.
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), {
      target: { value: 'Iman' },
    });

    // Step 2 → 3 (timezone).
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-timezone')).toBeInTheDocument();

    // Back to step 2 — name should still be there.
    fireEvent.click(screen.getByTestId('onboarding-back'));
    expect((screen.getByTestId('onboarding-member-name-0') as HTMLInputElement).value).toBe('Iman');
  });

  it('disables Next on the members step until at least one name is filled', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'khans', onboardingCompleted: false }] }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    const next = screen.getByTestId('onboarding-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), {
      target: { value: 'Iman' },
    });
    expect(next.disabled).toBe(false);
  });

  it('final submit POSTs all wizard state to /api/onboarding/complete and redirects', async () => {
    // First call: /api/me (gate check).
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'khans', onboardingCompleted: false }] }),
    });
    // Second call: POST /api/onboarding/complete.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenant: { onboardingCompleted: true }, membersAdded: 1 }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    // Welcome → Members → fill → Timezone → Currency → Done → Finish.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), {
      target: { value: 'Iman' },
    });
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.click(screen.getByTestId('onboarding-next')); // timezone defaults to browser
    fireEvent.click(screen.getByTestId('onboarding-next')); // currency defaults USD
    fireEvent.click(screen.getByTestId('onboarding-finish'));

    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-dashboard'),
    );
    // Inspect the POST payload shape.
    const submitCall = fetchMock.mock.calls.find(([url]) => url === '/api/onboarding/complete');
    expect(submitCall).toBeDefined();
    const init = submitCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      currency: 'USD',
      members: [{ displayName: 'Iman', role: 'adult' }],
    });
  });
});
