/**
 * @file useGeocodeQuery.test.ts
 * @description Tests unitaires du hook useGeocodeQuery.
 *              Unit tests for the useGeocodeQuery hook.
 *
 * @module __tests__/unit/presentation/hooks/useGeocodeQuery
 */

// [ADDED] Tests unitaires useGeocodeQuery
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createQueryClientWrapper } from '@/__tests__/helpers/queryClientWrapper';
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import { GeocodeError } from '@core/ports/IGeocodeService';
import { useGeocodeQuery } from '@presentation/hooks/useGeocodeQuery';

// ─── Mock getContainer ──────────────────────────────────────

const mockExecute = jest.fn();

jest.mock('@/di/container', () => ({
  getContainer: jest.fn(() => ({
    searchAddressUseCase: { execute: mockExecute },
  })),
}));

// ─── Test data ──────────────────────────────────────────────

const fakeResults: GeocodeResult[] = [
  {
    externalId: '12345',
    coordinates: { latitude: 48.8584, longitude: 2.2945 },
    displayName: 'Tour Eiffel, Paris, France',
    placeType: 'attraction',
    importance: 0.85,
  },
];

// ─── Tests ──────────────────────────────────────────────────

describe('useGeocodeQuery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not call useCase when query is shorter than minLength', () => {
    renderHook(() => useGeocodeQuery({ query: 'ab', debounceMs: 0 }), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('does not call useCase when trimmed query is shorter than minLength', () => {
    renderHook(() => useGeocodeQuery({ query: '  ab  ', debounceMs: 0 }), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('calls useCase with debounced query when length >= 3', async () => {
    mockExecute.mockResolvedValueOnce(fakeResults);

    const { result } = renderHook(() => useGeocodeQuery({ query: 'Tour Eiffel', debounceMs: 0 }), {
      wrapper: createQueryClientWrapper(),
    });

    // Advance timers to trigger debounce
    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(fakeResults);
    });

    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ query: 'Tour Eiffel' }));
  });

  it('does not retry on rate_limited error', async () => {
    const rateLimitError = new GeocodeError('Rate limited', 'rate_limited');
    mockExecute.mockRejectedValue(rateLimitError);

    const { result } = renderHook(() => useGeocodeQuery({ query: 'Paris', debounceMs: 0 }), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should have been called only once (no retry)
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('does not retry on invalid_query error', async () => {
    const invalidError = new GeocodeError('Invalid', 'invalid_query');
    mockExecute.mockRejectedValue(invalidError);

    const { result } = renderHook(() => useGeocodeQuery({ query: 'Paris', debounceMs: 0 }), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('respects custom minLength', () => {
    renderHook(() => useGeocodeQuery({ query: 'abcd', debounceMs: 0, minLength: 5 }), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });
});
