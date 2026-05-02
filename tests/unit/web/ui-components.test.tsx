import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Card, Input, TopNav, AvatarGrid } from '../../../packages/ui/src';

// Sanity tests for the FHS-242 design-system extensions:
//   - Button.fullWidth → adds `w-full`
//   - Card.radius → defaults to `rounded-xl`; opts into `rounded-md` /
//     `rounded-2xl` via prop
//   - Input.variant='dark' → applies `border-black` + purple focus ring
// Each test asserts a single class so a future Tailwind rename is loud.

describe('Button.fullWidth', () => {
  it('does NOT include w-full by default', () => {
    render(<Button testId="btn">click</Button>);
    expect(screen.getByTestId('btn').className).not.toContain('w-full');
  });

  it('includes w-full when fullWidth is true', () => {
    render(
      <Button testId="btn" fullWidth>
        click
      </Button>,
    );
    expect(screen.getByTestId('btn').className).toContain('w-full');
  });
});

describe('Card.radius', () => {
  it('defaults to rounded-xl (matches MP design)', () => {
    render(<Card testId="card">x</Card>);
    expect(screen.getByTestId('card').className).toContain('rounded-xl');
    expect(screen.getByTestId('card').className).not.toContain('rounded-2xl');
  });

  it('honours radius="md"', () => {
    render(
      <Card testId="card" radius="md">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('rounded-md');
  });

  it('honours radius="2xl" (legacy soft-corner opt-in)', () => {
    render(
      <Card testId="card" radius="2xl">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('rounded-2xl');
    expect(screen.getByTestId('card').className).not.toContain('rounded-xl ');
  });
});

describe('Input.variant', () => {
  it('default variant uses gray-50 background + pink focus ring', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('bg-gray-50');
    expect(input.className).toContain('focus-visible:ring-pink-400');
  });

  it('dark variant uses white background + black border + purple focus ring', () => {
    render(<Input data-testid="input" variant="dark" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('bg-white');
    expect(input.className).toContain('border-black');
    expect(input.className).toContain('focus-visible:ring-purple-500');
  });
});

describe('TopNav', () => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'meals', label: 'Meals' },
    { id: 'calendar', label: 'Calendar' },
  ];

  it('renders every tab and marks the active one with aria-selected', () => {
    render(<TopNav tabs={tabs} activeTab="meals" onTabChange={() => {}} brand="FamilyHub" />);
    expect(screen.getByRole('tab', { name: /dashboard/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: /meals/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onTabChange with the clicked tab id', () => {
    const onTabChange = vi.fn();
    render(<TopNav tabs={tabs} activeTab="dashboard" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /calendar/i }));
    expect(onTabChange).toHaveBeenCalledWith('calendar');
  });

  it('renders the brand and rightSlot when provided', () => {
    render(
      <TopNav
        tabs={tabs}
        activeTab="dashboard"
        onTabChange={() => {}}
        brand="FamilyHub"
        rightSlot={<button>Profile</button>}
      />,
    );
    expect(screen.getByText('FamilyHub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  });
});

describe('AvatarGrid', () => {
  const avatars = [
    { id: 'sarah', name: 'Sarah', role: 'Mum', color: 'bg-pink-200' },
    { id: 'amina', name: 'Amina', role: 'Teen (14)', color: 'bg-yellow-200', avatar: '👧' },
  ];

  it('renders one button per avatar with accessible name', () => {
    render(<AvatarGrid avatars={avatars} />);
    expect(screen.getByRole('button', { name: 'Sarah, Mum' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amina, Teen (14)' })).toBeInTheDocument();
  });

  it('falls back to first letter when no avatar prop given', () => {
    render(<AvatarGrid avatars={[avatars[0]!]} />);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('renders the provided avatar node when given', () => {
    render(<AvatarGrid avatars={[avatars[1]!]} />);
    expect(screen.getByText('👧')).toBeInTheDocument();
  });

  it('marks the selected tile with aria-pressed=true', () => {
    render(<AvatarGrid avatars={avatars} selectedId="amina" />);
    expect(screen.getByRole('button', { name: 'Sarah, Mum' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Amina, Teen (14)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onSelect with the clicked avatar id', () => {
    const onSelect = vi.fn();
    render(<AvatarGrid avatars={avatars} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sarah, Mum' }));
    expect(onSelect).toHaveBeenCalledWith('sarah');
  });
});
