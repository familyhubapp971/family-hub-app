import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Card, Input } from '../../../packages/ui/src';

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
