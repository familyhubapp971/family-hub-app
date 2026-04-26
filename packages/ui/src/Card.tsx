import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  variant?: 'default' | 'yellow' | 'pink' | 'cyan' | 'lime';
  testId?: string;
}

export function Card({
  children,
  className = '',
  onClick,
  hover = false,
  variant = 'default',
  testId,
}: CardProps) {
  const variants = {
    default: 'bg-white',
    yellow: 'bg-yellow-100',
    pink: 'bg-pink-100',
    cyan: 'bg-cyan-100',
    lime: 'bg-lime-100',
  };

  // Keyboard a11y: when onClick is set, the card becomes interactive —
  // add role="button", make it focusable, and handle Enter/Space.
  const interactive = Boolean(onClick);
  const onKeyDown = interactive
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }
    : undefined;

  return (
    <div
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-testid={testId}
      className={[
        variants[variant],
        'border-2 border-black rounded-2xl shadow-neo-md p-3 sm:p-4 md:p-5',
        hover
          ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-neo-lg cursor-pointer'
          : '',
        interactive
          ? 'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
