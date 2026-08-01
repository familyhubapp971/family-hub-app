import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CurrencyPicker,
  SearchableSelect,
  TimezonePicker,
  detectBrowserCurrency,
  detectBrowserTimezone,
  currencyDecimals,
} from '@familyhub/ui';

// FHS-38 / FHS-39 — searchable picker primitive + the two domain-
// specific wrappers used by the OnboardingWizard. The wrappers are
// thin so most coverage lives on SearchableSelect; the wrapper specs
// exercise the wiring (default-from-browser hook, option shape).

describe('<SearchableSelect />', () => {
  const OPTIONS = [
    { value: 'one', label: 'One' },
    { value: 'two', label: 'Two' },
    { value: 'three', label: 'Three', secondary: 'tertiary' },
  ];

  it('renders the placeholder when no value is selected', () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        options={OPTIONS}
        value=""
        onChange={onChange}
        placeholder="Pick one"
        testId="ss"
      />,
    );
    expect(screen.getByTestId('ss-trigger').textContent).toContain('Pick one');
  });

  it('opens on click, filters by query, and commits on row click', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} testId="ss" />);
    fireEvent.click(screen.getByTestId('ss-trigger'));
    fireEvent.change(screen.getByTestId('ss-search'), { target: { value: 'tw' } });
    // Only "Two" remains.
    expect(screen.getByTestId('ss-option-two')).toBeInTheDocument();
    expect(screen.queryByTestId('ss-option-one')).toBeNull();
    fireEvent.click(screen.getByTestId('ss-option-two'));
    expect(onChange).toHaveBeenCalledWith('two');
    // Popover closes after select.
    expect(screen.queryByTestId('ss-popover')).toBeNull();
  });

  it('matches against the optional secondary line too', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} testId="ss" />);
    fireEvent.click(screen.getByTestId('ss-trigger'));
    fireEvent.change(screen.getByTestId('ss-search'), { target: { value: 'tert' } });
    expect(screen.getByTestId('ss-option-three')).toBeInTheDocument();
  });

  it('arrow keys move highlight; Enter commits', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} testId="ss" />);
    fireEvent.click(screen.getByTestId('ss-trigger'));
    const search = screen.getByTestId('ss-search');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('three');
  });

  it('Escape closes the popover without selecting', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} testId="ss" />);
    fireEvent.click(screen.getByTestId('ss-trigger'));
    fireEvent.keyDown(screen.getByTestId('ss-search'), { key: 'Escape' });
    expect(screen.queryByTestId('ss-popover')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a "no matches" hint when the filter excludes everything', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} testId="ss" />);
    fireEvent.click(screen.getByTestId('ss-trigger'));
    fireEvent.change(screen.getByTestId('ss-search'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });
});

describe('<TimezonePicker />', () => {
  it('renders zones from the supplied list and commits on selection', () => {
    const onChange = vi.fn();
    render(
      <TimezonePicker
        value="UTC"
        onChange={onChange}
        zones={['UTC', 'Asia/Dubai', 'Europe/London']}
        testId="tz"
      />,
    );
    // Trigger shows the current value.
    expect(screen.getByTestId('tz-trigger').textContent).toContain('UTC');
    fireEvent.click(screen.getByTestId('tz-trigger'));
    fireEvent.change(screen.getByTestId('tz-search'), { target: { value: 'dubai' } });
    fireEvent.click(screen.getByTestId('tz-option-Asia/Dubai'));
    expect(onChange).toHaveBeenCalledWith('Asia/Dubai');
  });
});

describe('detectBrowserTimezone()', () => {
  it('returns a non-empty IANA-shaped string', () => {
    const tz = detectBrowserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
    // jsdom defaults to UTC; some envs return Region/City. Either is fine.
    expect(tz).toMatch(/^[A-Za-z][A-Za-z0-9_+\-/]*$/);
  });
});

describe('<CurrencyPicker />', () => {
  it('renders the curated currencies and commits on selection', () => {
    const onChange = vi.fn();
    render(<CurrencyPicker value="USD" onChange={onChange} testId="cur" />);
    expect(screen.getByTestId('cur-trigger').textContent).toContain('USD');
    fireEvent.click(screen.getByTestId('cur-trigger'));
    fireEvent.change(screen.getByTestId('cur-search'), { target: { value: 'naira' } });
    fireEvent.click(screen.getByTestId('cur-option-NGN'));
    expect(onChange).toHaveBeenCalledWith('NGN');
  });

  it('search matches by code, symbol, or name', () => {
    const onChange = vi.fn();
    render(<CurrencyPicker value="USD" onChange={onChange} testId="cur" />);
    fireEvent.click(screen.getByTestId('cur-trigger'));
    // By code:
    fireEvent.change(screen.getByTestId('cur-search'), { target: { value: 'GBP' } });
    expect(screen.getByTestId('cur-option-GBP')).toBeInTheDocument();
    // By name:
    fireEvent.change(screen.getByTestId('cur-search'), { target: { value: 'dirham' } });
    expect(screen.getByTestId('cur-option-AED')).toBeInTheDocument();
  });

  // FHS-515 — the money math assumes 2 decimals, so non-2-decimal currencies
  // (JPY, KRW = 0 decimals) must NOT be offered.
  it('does not offer 0-decimal currencies (JPY, KRW)', () => {
    render(<CurrencyPicker value="USD" onChange={vi.fn()} testId="cur" />);
    fireEvent.click(screen.getByTestId('cur-trigger'));
    fireEvent.change(screen.getByTestId('cur-search'), { target: { value: 'yen' } });
    expect(screen.queryByTestId('cur-option-JPY')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('cur-search'), { target: { value: 'won' } });
    expect(screen.queryByTestId('cur-option-KRW')).not.toBeInTheDocument();
  });
});

describe('currencyDecimals() (FHS-515)', () => {
  it('reports the ISO-4217 decimal places', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KRW')).toBe(0);
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('GBP')).toBe(2);
    expect(currencyDecimals('AED')).toBe(2);
    expect(currencyDecimals('KWD')).toBe(3);
  });
  it('falls back to 2 on a bad code', () => {
    expect(currencyDecimals('ZZZ')).toBe(2);
  });
});

describe('detectBrowserCurrency()', () => {
  it('returns a 3-letter currency code from the curated set', () => {
    const c = detectBrowserCurrency();
    expect(c).toMatch(/^[A-Z]{3}$/);
  });
  // FHS-515 — detection must never resolve to a currency the money math can't
  // render (only 2-decimal currencies are in the offered set).
  it('only ever returns a 2-decimal currency', () => {
    expect(currencyDecimals(detectBrowserCurrency())).toBe(2);
  });
});
