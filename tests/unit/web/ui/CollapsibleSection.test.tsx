import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '@familyhub/ui';

// FHS-513 — the collapsible group card used for Manage Members'
// Grown-ups / Kids groups and the "How your kids sign in" card.

describe('<CollapsibleSection />', () => {
  it('renders open by default, showing its body', () => {
    render(
      <CollapsibleSection emoji="🧑" title="Grown-ups" count={2} testId="section">
        <p data-testid="body-content">Body</p>
      </CollapsibleSection>,
    );
    expect(screen.getByTestId('body-content')).toBeInTheDocument();
    expect(screen.getByTestId('section-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the title, count, and subtitle', () => {
    render(
      <CollapsibleSection emoji="🧒" title="Kids" subtitle="Sign in with a PIN" count={3}>
        <p>Body</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Kids')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getByText('Sign in with a PIN')).toBeInTheDocument();
  });

  it('collapses the body when the header is clicked, and re-expands on a second click', () => {
    render(
      <CollapsibleSection emoji="🧑" title="Grown-ups" testId="section">
        <p data-testid="body-content">Body</p>
      </CollapsibleSection>,
    );
    fireEvent.click(screen.getByTestId('section-toggle'));
    expect(screen.queryByTestId('body-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('section-toggle')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTestId('section-toggle'));
    expect(screen.getByTestId('body-content')).toBeInTheDocument();
  });

  it('honours defaultOpen=false', () => {
    render(
      <CollapsibleSection emoji="🧑" title="Grown-ups" defaultOpen={false} testId="section">
        <p data-testid="body-content">Body</p>
      </CollapsibleSection>,
    );
    expect(screen.queryByTestId('body-content')).not.toBeInTheDocument();
  });
});
