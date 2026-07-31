export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  testId?: string;
}

/**
 * A simple on/off switch — used by the "Pocket money" settings screen's
 * "Different amount for {name}" per-child toggle (FHS-512), and reusable
 * anywhere else a binary on/off control is needed.
 */
export function Toggle({ checked, onChange, label, disabled = false, testId }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-black transition-colors',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        checked ? 'bg-lime-400' : 'bg-gray-200',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-6 w-6 rounded-full border-2 border-black bg-white shadow-neo-xs transition-transform motion-safe:duration-150',
          checked ? 'translate-x-6' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}
