/**
 * @file useDebounce.test.ts
 * @description Tests unitaires du hook useDebounce.
 *              Unit tests for the useDebounce hook.
 *
 * @module __tests__/unit/presentation/hooks/useDebounce
 */

// [ADDED] Tests unitaires useDebounce
import { renderHook, act } from '@testing-library/react-native';
import { useDebounce } from '@presentation/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 400));

    expect(result.current).toBe('hello');
  });

  it('does not update the value before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 400 } },
    );

    rerender({ value: 'world', delay: 400 });

    // Advance only 200ms — not enough
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toBe('hello');
  });

  it('updates the value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 400 } },
    );

    rerender({ value: 'world', delay: 400 });

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current).toBe('world');
  });

  it('resets the timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 400 } },
    );

    // Rapid changes
    rerender({ value: 'ab', delay: 400 });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender({ value: 'abc', delay: 400 });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // 200ms after last change — not enough
    expect(result.current).toBe('a');

    // Complete the delay
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Should have the last value
    expect(result.current).toBe('abc');
  });

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: number; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 42, delay: 300 } },
    );

    rerender({ value: 100, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe(100);
  });
});
