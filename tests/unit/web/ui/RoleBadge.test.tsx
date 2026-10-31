import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleBadge, AvatarDisc, roleStyle } from '@familyhub/ui';

// FHS-513: RoleBadge / AvatarDisc / roleStyle, extracted out of
// MembersPage + TodayTabPanel's duplicate literal ROLE_STYLE maps.

describe('roleStyle', () => {
  it('returns the matching style for a known role', () => {
    expect(roleStyle('admin')).toEqual({
      disc: 'bg-pink-300',
      badge: 'bg-pink-200',
      label: 'Admin',
    });
  });

  it('falls back to the guest style for an unknown role', () => {
    expect(roleStyle('bogus').label).toBe('Guest');
  });
});

describe('<RoleBadge />', () => {
  it('renders the role label', () => {
    render(<RoleBadge role="adult" testId="badge" />);
    expect(screen.getByTestId('badge').textContent).toBe('Adult');
  });

  it('appends the age for a child/teen row that has one', () => {
    render(<RoleBadge role="child" age={6} testId="badge" />);
    expect(screen.getByTestId('badge').textContent).toBe('Child (6)');
  });

  it('does not append an age for a grown-up role even when age is set', () => {
    render(<RoleBadge role="adult" age={40} testId="badge" />);
    expect(screen.getByTestId('badge').textContent).toBe('Adult');
  });

  it('omits the age suffix when age is null', () => {
    render(<RoleBadge role="teen" age={null} testId="badge" />);
    expect(screen.getByTestId('badge').textContent).toBe('Teen');
  });
});

describe('<AvatarDisc />', () => {
  it('shows the emoji when provided', () => {
    render(<AvatarDisc role="admin" name="Sarah Khan" emoji="👩" testId="disc" />);
    expect(screen.getByTestId('disc').textContent).toBe('👩');
  });

  it('falls back to the first letter of the name when no emoji is set', () => {
    render(<AvatarDisc role="admin" name="Sarah Khan" testId="disc" />);
    expect(screen.getByTestId('disc').textContent).toBe('S');
  });
});
