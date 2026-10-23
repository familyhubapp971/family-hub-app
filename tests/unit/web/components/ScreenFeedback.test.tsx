/**
 * Unit tests for ScreenFeedback (FHS-670): the per-screen feedback button in
 * the top bar of signed-in parent screens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockLocation = { pathname: '/t/test-family/dashboard', search: '?tab=meals' };
let mockSession: { access_token: string } | null = { access_token: 'parent.jwt.tok' };

vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: 'test-family' }),
  useLocation: () => mockLocation,
}));

vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => ({ session: mockSession }),
}));

vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { ScreenFeedback } from '../../../../apps/web/src/components/ScreenFeedback';

const fetchMock = vi.fn();

beforeEach(() => {
  mockSession = { access_token: 'parent.jwt.tok' };
  mockLocation.pathname = '/t/test-family/dashboard';
  mockLocation.search = '?tab=meals';
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open() {
  fireEvent.click(screen.getByTestId('screen-feedback-button'));
}

describe('<ScreenFeedback />', () => {
  it('is hidden without a parent session', () => {
    mockSession = null;
    const { container } = render(<ScreenFeedback role="admin" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks about the screen the parent is on', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    expect(screen.getByText('How easy is Weekly Meals to use?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/shopping list built from/)).toBeInTheDocument();
  });

  it("lists that screen's own features", () => {
    render(<ScreenFeedback role="admin" />);
    open();
    const names = screen.getAllByTestId('screen-feedback-feature').map((b) => b.textContent);
    expect(names).toEqual(['Add meal', 'Add snack', 'Repeats weekly', 'Filter meals']);
  });

  it('uses the tab it is given on Child World', () => {
    render(<ScreenFeedback role="adult" screenKey="child-journal" />);
    open();
    expect(screen.getByText('How easy is the Journal to use?')).toBeInTheDocument();
  });

  it('needs an answer, not just a feature tap, before it can send', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByText('Add meal'));
    expect(screen.getByTestId('screen-feedback-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('screen-feedback-ease-4'));
    expect(screen.getByTestId('screen-feedback-submit')).not.toBeDisabled();
  });

  it('sends the screen, the features tapped and the visit ID', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 201 }));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByText('Add snack'));
    fireEvent.click(screen.getByTestId('screen-feedback-ease-4'));
    fireEvent.change(screen.getByTestId('screen-feedback-wish'), {
      target: { value: 'A shopping list' },
    });
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/feedback$/);
    expect(init.headers['x-tenant-slug']).toBe('test-family');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      screen: 'meals',
      features: ['Add snack'],
      easeOfUse: 4,
      featureRequest: 'A shopping list',
    });
    expect(body.visitId).toBe(sessionStorage.getItem('fh-feedback-visit'));
  });

  it('shows the error and keeps the answers when sending fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid request' }), { status: 400 }),
    );
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByTestId('screen-feedback-solves-3'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent('invalid request'),
    );
    expect(screen.getByTestId('screen-feedback-solves-3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByTestId('screen-feedback-ease-2'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent(
        'Could not reach the server',
      ),
    );
  });

  it('sends once when Send is tapped twice', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByTestId('screen-feedback-ease-5'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    resolve(new Response('{}', { status: 201 }));
    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('Children never see the button', () => {
    it.each([
      ['a child', 'child'],
      ['a teen', 'teen'],
      ['a grown-up whose role is still loading', null],
    ])('is hidden for %s', (_who, role) => {
      const { container } = render(<ScreenFeedback role={role} />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
