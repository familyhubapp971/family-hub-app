import React, { useCallback, useEffect, useRef, useState } from 'react';

interface PinInputProps {
  /** Number of cells. Defaults to 4 (kid PIN length per FHS-235 spec). */
  length?: number;
  /** Fires on every keystroke with the current concatenated PIN. */
  onChange?: (pin: string) => void;
  /** Fires once the PIN is fully filled. */
  onComplete?: (pin: string) => void;
  /** Whether to autofocus the first cell on mount. Default true. */
  autoFocus?: boolean;
  /** Use type="password" so digits render as dots (kid privacy). Default true. */
  mask?: boolean;
  /** Disabled state — locks all cells and dims the styling. */
  disabled?: boolean;
  /** Error state — red border + ring. Used after a failed PIN attempt. */
  error?: boolean;
  /** Accessible label for the whole group. */
  label?: string;
  testId?: string;
}

/**
 * Multi-cell PIN entry. Used by the kid login flow (FHS-237 / FHS-238)
 * where children tap their avatar then type their 4-digit PIN.
 *
 * Behaviour:
 *   - Each cell accepts exactly one digit; non-digit input is dropped.
 *   - Typing in a cell auto-advances focus to the next cell.
 *   - Backspace on an empty cell retreats focus to the previous cell.
 *   - Arrow Left/Right move focus without changing values.
 *   - Pasting a digit string fills cells left-to-right from the active
 *     cell.
 *   - When the last cell receives a digit, onComplete fires with the
 *     full PIN string.
 *
 * Keyboard a11y: each cell is a real <input>; the group has an
 * aria-label so screen readers announce intent.
 */
export function PinInput({
  length = 4,
  onChange,
  onComplete,
  autoFocus = true,
  mask = true,
  disabled = false,
  error = false,
  label = 'Enter PIN',
  testId,
}: PinInputProps) {
  const [values, setValues] = useState<string[]>(() => Array(length).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = useCallback(
    (idx: number, val: string) => {
      setValues((prev) => {
        const next = [...prev];
        next[idx] = val;
        const joined = next.join('');
        onChange?.(joined);
        if (joined.length === length && !next.includes('')) onComplete?.(joined);
        return next;
      });
    },
    [length, onChange, onComplete],
  );

  const focusCell = (idx: number) => {
    if (idx >= 0 && idx < length) refs.current[idx]?.focus();
  };

  const handleChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Pasting multiple digits at once — distribute left-to-right from idx.
    if (raw.length > 1) {
      const digits = raw.replace(/\D/g, '').slice(0, length - idx);
      if (!digits) return;
      setValues((prev) => {
        const next = [...prev];
        for (let i = 0; i < digits.length; i++) next[idx + i] = digits[i]!;
        const joined = next.join('');
        onChange?.(joined);
        if (joined.length === length && !next.includes('')) onComplete?.(joined);
        return next;
      });
      focusCell(Math.min(idx + digits.length, length - 1));
      return;
    }
    const digit = raw.replace(/\D/g, '');
    setAt(idx, digit);
    if (digit) focusCell(idx + 1);
  };

  const handleKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[idx] && idx > 0) {
      e.preventDefault();
      focusCell(idx - 1);
      setAt(idx - 1, '');
      return;
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      focusCell(idx - 1);
    }
    if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      focusCell(idx + 1);
    }
  };

  return (
    <div
      data-testid={testId}
      role="group"
      aria-label={label}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {values.map((val, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          type={mask ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          value={val}
          disabled={disabled}
          aria-label={`${label} digit ${idx + 1} of ${length}`}
          onChange={handleChange(idx)}
          onKeyDown={handleKeyDown(idx)}
          onFocus={(e) => e.target.select()}
          className={[
            'h-14 w-12 sm:h-16 sm:w-14 rounded-xl border-2 bg-white text-center font-heading text-2xl text-black shadow-neo',
            'transition-all duration-150 outline-none',
            'focus-visible:ring-4 focus-visible:ring-offset-2',
            error
              ? 'border-red-500 focus-visible:ring-red-400'
              : 'border-black focus-visible:ring-purple-500',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
}
