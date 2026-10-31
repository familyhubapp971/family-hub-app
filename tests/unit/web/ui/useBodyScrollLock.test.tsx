import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBodyScrollLock } from '@familyhub/ui';

// FHS-412: body scroll-lock hook.
// Tests:
//   1. Sets overflow hidden when active.
//   2. Restores the original overflow on unmount.
//   3. Ref-counting: two active locks; releasing one keeps it locked until both
//      are released.

describe('useBodyScrollLock', () => {
  beforeEach(() => {
    // Reset to a known state before each test.
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  it('sets body AND html overflow to hidden when active=true', () => {
    renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    // FHS-412 follow-up: <html> is the real scroll container; lock it too.
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('locks and restores <html> (the real scroll container) too', () => {
    document.documentElement.style.overflow = 'auto';
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('is a no-op when active=false', () => {
    document.body.style.overflow = 'auto';
    renderHook(() => useBodyScrollLock(false));
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores the original overflow value on unmount', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('restores overflow to empty string when no original value was set', () => {
    // body.style.overflow starts as '' (set in beforeEach)
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores overflow when active transitions false while mounted', () => {
    let active = true;
    const { rerender, unmount } = renderHook(() => useBodyScrollLock(active));
    expect(document.body.style.overflow).toBe('hidden');
    active = false;
    rerender();
    expect(document.body.style.overflow).toBe('');
    unmount();
  });

  it('ref-counting: two locks keep scroll locked until both are released', () => {
    // Lock 1
    const hook1 = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    // Lock 2
    const hook2 = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    // Release lock 1: still locked because lock 2 is active
    act(() => {
      hook1.unmount();
    });
    expect(document.body.style.overflow).toBe('hidden');

    // Release lock 2: now unlocked
    act(() => {
      hook2.unmount();
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('ref-counting: three locks; unlocking in sequence', () => {
    const h1 = renderHook(() => useBodyScrollLock(true));
    const h2 = renderHook(() => useBodyScrollLock(true));
    const h3 = renderHook(() => useBodyScrollLock(true));

    act(() => {
      h1.unmount();
    });
    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      h2.unmount();
    });
    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      h3.unmount();
    });
    expect(document.body.style.overflow).toBe('');
  });
});
