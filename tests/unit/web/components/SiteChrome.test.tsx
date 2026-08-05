// FHS-555: the public header used to hide Features + About below md and
// squeeze the rest into one row, so a phone visitor could not reach those
// pages at all. Everything except the logo and Start free now sits behind a
// burger button. These tests lock the behaviour that fix depends on.
import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  SiteHeader,
  SiteFooter,
  MAIN_CONTENT_ID,
} from '../../../../apps/web/src/components/SiteChrome';

function renderHeader(props: Parameters<typeof SiteHeader>[0] = {}) {
  return render(
    <MemoryRouter>
      <SiteHeader {...props} />
    </MemoryRouter>,
  );
}

const burger = () => screen.getByTestId('site-nav-burger');
const panel = () => screen.queryByTestId('site-nav-panel');
const openMenu = () => fireEvent.click(burger());

describe('SiteHeader burger menu', () => {
  it('renders the burger button closed by default', () => {
    renderHeader();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeInTheDocument();
  });

  it('labels the burger for screen readers and flips the label when open', () => {
    renderHeader();
    expect(burger()).toHaveAccessibleName('Open menu');

    openMenu();
    expect(burger()).toHaveAccessibleName('Close menu');
    expect(burger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('points aria-controls at the panel it opens', () => {
    renderHeader();
    const controls = burger().getAttribute('aria-controls');

    openMenu();
    expect(panel()).toHaveAttribute('id', controls);
  });

  it('opens a panel holding every nav link plus Log in', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(open.getByRole('link', { name: label })).toBeInTheDocument();
    }
    // FHS-568: Log in carries a button's weight, not a link's.
    expect(open.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('marks the current section inside the panel', () => {
    renderHeader({ current: 'pricing' });
    openMenu();

    expect(within(panel()!).getByRole('link', { name: 'Pricing' }).className).toContain(
      'text-yellow-300',
    );
  });

  it('closes when the burger is tapped again', () => {
    renderHeader();

    openMenu();
    expect(panel()).toBeInTheDocument();

    fireEvent.click(burger());
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes when a link inside the panel is tapped', () => {
    renderHeader();
    openMenu();

    fireEvent.click(within(panel()!).getByRole('link', { name: 'Legal' }));
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes when the scrim behind the panel is tapped', () => {
    renderHeader();
    openMenu();

    fireEvent.click(screen.getByTestId('site-nav-scrim'));
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the burger', () => {
    renderHeader();
    openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(panel()).not.toBeInTheDocument();
    expect(burger()).toHaveFocus();
  });

  it('moves focus into the panel when it opens', () => {
    renderHeader();
    openMenu();

    expect(within(panel()!).getByRole('link', { name: 'Features' })).toHaveFocus();
  });

  it('does not steal focus on first render', () => {
    renderHeader();
    expect(burger()).not.toHaveFocus();
  });

  it('traps Tab inside the panel: Tab off the last item wraps to the first', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    const login = open.getByRole('button', { name: 'Log in' });
    login.focus();
    fireEvent.keyDown(panel()!, { key: 'Tab' });

    expect(open.getByRole('link', { name: 'Features' })).toHaveFocus();
  });

  it('traps Shift+Tab off the first item back to the last', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    open.getByRole('link', { name: 'Features' }).focus();
    fireEvent.keyDown(panel()!, { key: 'Tab', shiftKey: true });

    expect(open.getByRole('button', { name: 'Log in' })).toHaveFocus();
  });

  it('locks page scroll while the panel is open and restores it after', () => {
    renderHeader();

    openMenu();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('keeps Start free in the bar rather than inside the menu', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Start free' })).toBeInTheDocument();

    openMenu();
    expect(within(panel()!).queryByRole('button', { name: 'Start free' })).not.toBeInTheDocument();
  });

  // FHS-561: header said "Legal", footer said "All legal", same destination.
  it('names every link to the legal index the same thing', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
        <SiteFooter />
      </MemoryRouter>,
    );

    const names = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/legal')
      .map((a) => a.textContent?.trim());

    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names).size).toBe(1);
  });

  // FHS-568: it used to render as a fifth plain link under the divider.
  it('presents Log in as a button in the panel, not a plain link', () => {
    renderHeader();
    openMenu();

    const open = within(panel()!);
    const login = open.getByTestId('site-nav-login');
    expect(login.tagName).toBe('BUTTON');
    expect(open.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    // Button styling from the design system, sized for a thumb.
    expect(login.className).toContain('border-2');
    expect(login.className).toContain('min-h-[52px]');
  });

  it('closes the menu when Log in is tapped', () => {
    renderHeader();
    openMenu();

    fireEvent.click(within(panel()!).getByTestId('site-nav-login'));
    expect(panel()).not.toBeInTheDocument();
  });

  it('gives the burger a 44px minimum tap target', () => {
    renderHeader();
    // h-11 w-11 is Tailwind's 44px square: the repo's tap-target floor.
    expect(burger().className).toContain('h-11');
    expect(burger().className).toContain('w-11');
  });

  it('gives every panel row a 56px minimum height', () => {
    renderHeader();
    openMenu();

    for (const link of within(panel()!).getAllByRole('link')) {
      expect(link.className).toContain('min-h-[56px]');
    }
  });

  it('swaps Log in and Start free for caller-supplied actions', () => {
    renderHeader({ actions: <button type="button">Log out</button> });

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start free' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('leaves Log in out of the panel when actions are supplied', () => {
    renderHeader({ actions: <button type="button">Log out</button> });
    openMenu();

    const open = within(panel()!);
    expect(open.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(open.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  // FHS-559: keyboard users had to tab the whole nav on every page.
  it('puts a skip-to-content link before everything else in the header', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    const skip = screen.getByTestId('skip-to-content');

    expect(skip).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(skip).toHaveAccessibleName('Skip to content');
    // First element in the header means first in the tab order.
    expect(header.firstElementChild).toBe(skip);
  });

  it('keeps the skip link invisible until it is focused', () => {
    renderHeader();
    const skip = screen.getByTestId('skip-to-content');

    expect(skip.className).toContain('sr-only');
    expect(skip.className).toContain('focus:not-sr-only');
  });

  it('hides the burger and shows the inline row from lg up', () => {
    renderHeader();
    // Both navs live in the DOM; CSS decides which one a viewport shows.
    expect(burger().className).toContain('lg:hidden');

    const desktopNav = screen.getByRole('navigation', { name: 'Main' });
    expect(desktopNav.className).toContain('lg:flex');
    for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
      expect(within(desktopNav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

// FHS-567: at 375px the five legal links wrapped 4-then-1 and the floating
// feedback button sat on top of the copyright line.
describe('SiteFooter layout on phones', () => {
  function renderFooter() {
    return render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
  }

  it('lays the legal links out as an even grid on phones and a row from md up', () => {
    renderFooter();
    const nav = screen.getByRole('navigation', { name: 'Legal' });
    expect(nav.className).toContain('grid-cols-2');
    expect(nav.className).toContain('md:flex');
  });

  it('keeps every legal link at the 44px tap floor', () => {
    renderFooter();
    const links = within(screen.getByRole('navigation', { name: 'Legal' })).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toContain('min-h-[44px]');
    }
  });

  it('reserves room under the small print so the floating button cannot cover it', () => {
    renderFooter();
    const copyright = screen.getByText(/virtual rewards are play money/i);
    expect(copyright.className).toContain('pb-28');
    expect(copyright.className).toContain('md:pb-8');
  });
});
