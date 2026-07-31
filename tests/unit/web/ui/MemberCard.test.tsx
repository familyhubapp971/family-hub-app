import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemberCard, RoleBadge } from '@familyhub/ui';

// FHS-513 — the family-member card shell shared by every Manage
// Members group.

describe('<MemberCard />', () => {
  it('renders the name, status line, and badge', () => {
    render(
      <MemberCard
        role="adult"
        name="Sarah Khan"
        statusLine="Signed in"
        badge={<RoleBadge role="adult" testId="mc-badge" />}
        testId="mc"
      />,
    );
    expect(screen.getByTestId('mc-name').textContent).toBe('Sarah Khan');
    expect(screen.getByTestId('mc-status').textContent).toBe('Signed in');
    expect(screen.getByTestId('mc-badge').textContent).toBe('Adult');
  });

  it('renders body children and a footer actions row', () => {
    render(
      <MemberCard
        role="child"
        name="Iman"
        badge={<RoleBadge role="child" age={6} />}
        testId="mc"
        footer={<button type="button">Edit name</button>}
      >
        <p data-testid="mc-body">Info panel</p>
      </MemberCard>,
    );
    expect(screen.getByTestId('mc-body')).toBeInTheDocument();
    expect(screen.getByText('Edit name')).toBeInTheDocument();
  });

  it('omits the status line entirely when none is passed', () => {
    render(<MemberCard role="admin" name="Sarah" badge={<RoleBadge role="admin" />} testId="mc" />);
    expect(screen.queryByTestId('mc-status')).not.toBeInTheDocument();
  });
});
