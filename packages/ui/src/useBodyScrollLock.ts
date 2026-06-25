import { useEffect } from 'react';

// Module-level ref-count so multiple simultaneous modals don't unlock early.
// The original overflow value is captured once when the count goes 0 → 1 and
// restored only when the count returns to 0.
let lockCount = 0;
let originalOverflow = '';

function lock(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlock(): void {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
  }
}

/**
 * Prevents the page from scrolling behind a modal or lightbox.
 *
 * Usage:
 *   useBodyScrollLock(isOpen);
 *
 * - When `active` is true, `document.body.style.overflow` is set to 'hidden'.
 * - The previous value is restored when `active` becomes false or the component unmounts.
 * - A module-level ref-count ensures multiple simultaneous locks don't release
 *   each other early: the overflow is only restored once every active lock is gone.
 * - SSR-safe: guards `typeof document !== 'undefined'`.
 * - The hook is always called unconditionally (hooks rules); `active` is the gate.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => {
      unlock();
    };
  }, [active]);
}
