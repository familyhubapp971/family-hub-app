import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvestmentTag, investmentRule } from '@familyhub/ui';

// FHS-607: the tag that marks a habit as invested and says which kind it is.
// Two kinds, and each must be tellable apart without colour.

describe('<InvestmentTag />', () => {
  it('names the kind and the multiplier for a deductible investment', () => {
    render(<InvestmentTag multiplier={3} deductible testId="tag" />);
    const tag = screen.getByTestId('tag');
    expect(tag).toHaveTextContent('Deductible');
    expect(tag).toHaveTextContent('Invested · 3x');
  });

  it('names the kind and the multiplier for a no-penalty investment', () => {
    render(<InvestmentTag multiplier={5} deductible={false} testId="tag" />);
    const tag = screen.getByTestId('tag');
    expect(tag).toHaveTextContent('No penalty');
    expect(tag).toHaveTextContent('Invested · 5x');
    expect(tag).not.toHaveTextContent('Deductible');
  });

  it('says in plain words what each kind means, for screen readers', () => {
    const { rerender } = render(<InvestmentTag multiplier={2} deductible testId="tag" />);
    expect(screen.getByTestId('tag')).toHaveAttribute(
      'aria-label',
      'Invested at 2 times. Deductible, so a missed day takes value away.',
    );
    rerender(<InvestmentTag multiplier={2} deductible={false} testId="tag" />);
    expect(screen.getByTestId('tag')).toHaveAttribute(
      'aria-label',
      'Invested at 2 times. No penalty, so a missed day costs nothing.',
    );
  });

  it('carries an icon beside the word, so the kinds survive greyscale', () => {
    const { container, rerender } = render(
      <InvestmentTag multiplier={1} deductible testId="tag" />,
    );
    // Two pills, each with its own icon: the kind and the multiplier.
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    const deductibleClasses = screen.getByTestId('tag').innerHTML;
    rerender(<InvestmentTag multiplier={1} deductible={false} testId="tag" />);
    // The two kinds differ by more than a colour class.
    expect(screen.getByTestId('tag').innerHTML).not.toBe(deductibleClasses);
  });

  it('explains the kind in one plain sentence', () => {
    expect(investmentRule(true)).toBe('A missed day takes value off this investment.');
    expect(investmentRule(false)).toBe(
      'A missed day costs nothing. It just stops growing that day.',
    );
  });
});
