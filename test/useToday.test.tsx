// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToday } from '../src/lib/useToday';

afterEach(() => { vi.useRealTimers(); });
describe('useToday (F05)', () => {
  it('rolls over at local midnight without any other re-render', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, 23, 59, 0));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-10-10');
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
    expect(result.current).toBe('2026-10-11');
  });
  it('catches up when she comes back to the tab after the phone slept through midnight', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 9, 12, 8, 0, 0)); // clock jumped; timers did not fire (asleep)
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current).toBe('2026-10-12');
  });
});
