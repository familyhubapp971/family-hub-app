import React, { useEffect } from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  testId?: string;
  /** Accessible label or labelled-by id — required by WCAG 2.4.6. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

// Minimum-viable accessible dialog. Full focus-trap + scroll-lock land
// in a follow-up (TODO a11y) — this version covers role/aria-modal and
// Escape-to-close so spec authors can ship features behind it today
// without committing the WCAG sin of a non-modal modal.

export function Dialog({
  isOpen,
  onClose,
  children,
  closeOnBackdrop = true,
  testId,
  ariaLabel,
  ariaLabelledBy,
}: DialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // Use Tailwind utilities for backdrop so a strict CSP without
      // 'unsafe-inline' style-src still works (FHS-170 will add CSP).
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={closeOnBackdrop ? onClose : undefined}
      data-testid={testId}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid={testId ? `${testId}-content` : undefined}
      >
        {children}
      </div>
    </div>
  );
}
