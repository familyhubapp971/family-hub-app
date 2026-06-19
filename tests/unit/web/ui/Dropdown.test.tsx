import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Dropdown } from '@familyhub/ui';

// FHS-359 — the in-app dropdown (no native OS <select> menu). Tested via the
// web suite where @familyhub/ui + jsdom + jest-dom are already configured.

const OPTIONS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
];

describe('<Dropdown />', () => {
  it('shows the selected label and is NOT a native <select>', () => {
    const { container } = render(
      <Dropdown options={OPTIONS} value="a" onChange={() => {}} ariaLabel="Fruit" testId="dd" />,
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(container.querySelector('select')).toBeNull();
  });

  it('opens on click; selecting an option calls onChange + closes', () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="a" onChange={onChange} testId="dd" />);
    fireEvent.click(within(screen.getByTestId('dd')).getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Banana'));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape without selecting', () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="a" onChange={onChange} testId="dd" />);
    const trigger = within(screen.getByTestId('dd')).getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
