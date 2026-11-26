/**
 * @file useJoinStartPoint.test.tsx
 * @description Unit tests for the join start point hook (`useJoinStartPoint`, F5).
 *
 *              Covers: GPS success (start point set, `isLocating` back to false), GPS failures
 *              (permission refused or blocked, unavailable, timeout, non-typed error), a GPS
 *              result arriving after `selectAddress` or `clearStartLocation` (ignored thanks to
 *              the request counter), `selectAddress` clearing the GPS error, and
 *              `clearStartLocation`, and the `addressUnresolved` flag (set by a GPS position whose
 *              address could not be resolved, reset by every other choice, untouched by a late
 *              GPS result).
 *
 * @module features/Session/hooks/useJoinStartPoint.test
 */

// [ADDED] useJoinStartPoint unit tests
import { act, renderHook } from '@testing-library/react-native';
import type { GeocodeResult } from '@entities/GeocodeResult';
import type { Location } from '@entities/Location';
import { useJoinStartPoint } from '@features/Session/hooks/useJoinStartPoint';
import {
  GeolocationError,
  type GeolocationErrorCode,
} from '@services/domain/geolocation/IGeolocationService';

// ─── Mock uuid ──────────────────────────────────────────────
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-0001',
}));

// ─── Mock DI container ──────────────────────────────────────
const mockGetCurrentLocationExecute = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    getCurrentLocationUseCase: { execute: mockGetCurrentLocationExecute },
  })),
}));

// ─── Test data ──────────────────────────────────────────────
const GPS_LOCATION: Location = {
  id: 'loc-gps',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
  formattedAddress: '1 Rue de Rivoli, Paris, France',
};

const GEOCODE_RESULT: GeocodeResult = {
  externalId: 'osm-12345',
  coordinates: { latitude: 45.764, longitude: 4.8357 },
  displayName: 'Place Bellecour, Lyon, France',
  placeType: 'square',
  importance: 0.8,
};

/** Location expected from GEOCODE_RESULT once picked. */
const ADDRESS_LOCATION: Location = {
  id: 'test-uuid-0001',
  coordinates: GEOCODE_RESULT.coordinates,
  formattedAddress: GEOCODE_RESULT.displayName,
};

/**
 * Creates a promise whose settlement is driven by the test.
 *
 * @returns The promise and its resolve / reject handles
 */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useJoinStartPoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts with no start point, no GPS request and no error', () => {
    const { result } = renderHook(() => useJoinStartPoint());

    expect(result.current.startLocation).toBeNull();
    expect(result.current.isLocating).toBe(false);
    expect(result.current.gpsErrorCode).toBeNull();
    expect(result.current.addressUnresolved).toBe(false);
  });

  // ─── GPS ──────────────────────────────────────────────────
  describe('locateByGps', () => {
    it('sets the GPS position as start point and resets isLocating', async () => {
      mockGetCurrentLocationExecute.mockResolvedValue({
        location: GPS_LOCATION,
        addressResolved: true,
      });
      const { result } = renderHook(() => useJoinStartPoint());

      await act(async () => {
        await result.current.locateByGps();
      });

      expect(mockGetCurrentLocationExecute).toHaveBeenCalledTimes(1);
      expect(result.current.startLocation).toEqual(GPS_LOCATION);
      expect(result.current.isLocating).toBe(false);
      expect(result.current.gpsErrorCode).toBeNull();
    });

    it('exposes isLocating while the GPS request is pending', async () => {
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      expect(result.current.isLocating).toBe(true);

      await act(async () => {
        pending.resolve({ location: GPS_LOCATION, addressResolved: true });
        await request;
      });
      expect(result.current.isLocating).toBe(false);
    });

    it.each<[GeolocationErrorCode, string]>([
      ['permission_denied', 'gps_permission_denied'],
      ['permission_blocked', 'gps_permission_denied'],
      ['unavailable', 'gps_unavailable'],
      ['timeout', 'gps_timeout'],
    ])('maps a %s failure to %s, without a start point', async (code, expected) => {
      mockGetCurrentLocationExecute.mockRejectedValue(new GeolocationError('gps', code));
      const { result } = renderHook(() => useJoinStartPoint());

      await act(async () => {
        await result.current.locateByGps();
      });

      expect(result.current.gpsErrorCode).toBe(expected);
      expect(result.current.startLocation).toBeNull();
      expect(result.current.isLocating).toBe(false);
    });

    it('falls back to gps_unknown for a non-typed error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useJoinStartPoint());

      await act(async () => {
        await result.current.locateByGps();
      });

      expect(result.current.gpsErrorCode).toBe('gps_unknown');
    });

    it('never rejects on a GPS failure', async () => {
      mockGetCurrentLocationExecute.mockRejectedValue(new GeolocationError('gps', 'timeout'));
      const { result } = renderHook(() => useJoinStartPoint());

      await act(async () => {
        await expect(result.current.locateByGps()).resolves.toBeUndefined();
      });
    });

    it('clears the previous GPS error when a new request starts', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(new GeolocationError('gps', 'timeout'));
      const { result } = renderHook(() => useJoinStartPoint());
      await act(async () => {
        await result.current.locateByGps();
      });
      expect(result.current.gpsErrorCode).toBe('gps_timeout');

      mockGetCurrentLocationExecute.mockResolvedValueOnce({
        location: GPS_LOCATION,
        addressResolved: true,
      });
      await act(async () => {
        await result.current.locateByGps();
      });

      expect(result.current.gpsErrorCode).toBeNull();
      expect(result.current.startLocation).toEqual(GPS_LOCATION);
    });
  });

  // ─── Late GPS results (request counter) ───────────────────
  describe('stale GPS results', () => {
    it('ignores a GPS position that arrives after an address was picked', async () => {
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });
      await act(async () => {
        pending.resolve({ location: GPS_LOCATION, addressResolved: true });
        await request;
      });

      expect(result.current.startLocation).toEqual(ADDRESS_LOCATION);
      expect(result.current.isLocating).toBe(false);
    });

    it('ignores a GPS failure that arrives after an address was picked', async () => {
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });
      await act(async () => {
        pending.reject(new GeolocationError('gps', 'timeout'));
        await request;
      });

      expect(result.current.gpsErrorCode).toBeNull();
      expect(result.current.startLocation).toEqual(ADDRESS_LOCATION);
    });

    it('ignores a GPS position that arrives after "Change" was pressed', async () => {
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      act(() => {
        result.current.clearStartLocation();
      });
      expect(result.current.isLocating).toBe(false);

      await act(async () => {
        pending.resolve({ location: GPS_LOCATION, addressResolved: true });
        await request;
      });

      expect(result.current.startLocation).toBeNull();
      expect(result.current.isLocating).toBe(false);
    });

    it('keeps only the latest of two overlapping GPS requests', async () => {
      const first = deferred<{ location: Location; addressResolved: boolean }>();
      const second = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderHook(() => useJoinStartPoint());
      const latest: Location = { ...GPS_LOCATION, id: 'loc-latest' };

      let firstRequest: Promise<void> = Promise.resolve();
      let secondRequest: Promise<void> = Promise.resolve();
      act(() => {
        firstRequest = result.current.locateByGps();
      });
      act(() => {
        secondRequest = result.current.locateByGps();
      });
      await act(async () => {
        first.resolve({ location: GPS_LOCATION, addressResolved: true });
        await firstRequest;
      });
      expect(result.current.isLocating).toBe(true);
      expect(result.current.startLocation).toBeNull();

      await act(async () => {
        second.resolve({ location: latest, addressResolved: true });
        await secondRequest;
      });
      expect(result.current.startLocation).toEqual(latest);
      expect(result.current.isLocating).toBe(false);
    });
  });

  // ─── Address ──────────────────────────────────────────────
  describe('selectAddress', () => {
    it('uses the geocode result as start point, with a fresh id', () => {
      const { result } = renderHook(() => useJoinStartPoint());

      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });

      expect(result.current.startLocation).toEqual(ADDRESS_LOCATION);
    });

    it('clears the GPS error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValue(
        new GeolocationError('gps', 'permission_denied'),
      );
      const { result } = renderHook(() => useJoinStartPoint());
      await act(async () => {
        await result.current.locateByGps();
      });
      expect(result.current.gpsErrorCode).toBe('gps_permission_denied');

      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });

      expect(result.current.gpsErrorCode).toBeNull();
      expect(result.current.startLocation).toEqual(ADDRESS_LOCATION);
    });
  });

  // ─── Change ───────────────────────────────────────────────
  describe('clearStartLocation', () => {
    it('forgets the chosen start point', () => {
      const { result } = renderHook(() => useJoinStartPoint());
      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });

      act(() => {
        result.current.clearStartLocation();
      });

      expect(result.current.startLocation).toBeNull();
      expect(result.current.isLocating).toBe(false);
      expect(result.current.gpsErrorCode).toBeNull();
    });

    it('forgets the last GPS error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValue(new GeolocationError('gps', 'unavailable'));
      const { result } = renderHook(() => useJoinStartPoint());
      await act(async () => {
        await result.current.locateByGps();
      });

      act(() => {
        result.current.clearStartLocation();
      });

      expect(result.current.gpsErrorCode).toBeNull();
    });
  });
  // ─── Unresolved GPS address ───────────────────────────────
  describe('addressUnresolved', () => {
    const UNRESOLVED_LOCATION: Location = {
      ...GPS_LOCATION,
      id: 'loc-gps-raw',
      formattedAddress: '48.8566, 2.3522',
    };

    /**
     * Renders the hook and completes a GPS request whose address could not be resolved.
     *
     * @returns The rendered hook result
     */
    const renderWithUnresolvedGps = async () => {
      mockGetCurrentLocationExecute.mockResolvedValueOnce({
        location: UNRESOLVED_LOCATION,
        addressResolved: false,
      });
      const rendered = renderHook(() => useJoinStartPoint());
      await act(async () => {
        await rendered.result.current.locateByGps();
      });
      return rendered.result;
    };

    it('is true when the GPS position comes without a resolved address', async () => {
      const result = await renderWithUnresolvedGps();

      expect(result.current.addressUnresolved).toBe(true);
      expect(result.current.startLocation).toEqual(UNRESOLVED_LOCATION);
      expect(result.current.gpsErrorCode).toBeNull();
    });

    it('stays false when the GPS address is resolved', async () => {
      mockGetCurrentLocationExecute.mockResolvedValue({
        location: GPS_LOCATION,
        addressResolved: true,
      });
      const { result } = renderHook(() => useJoinStartPoint());

      await act(async () => {
        await result.current.locateByGps();
      });

      expect(result.current.addressUnresolved).toBe(false);
    });

    it('is reset by selectAddress', async () => {
      const result = await renderWithUnresolvedGps();

      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });

      expect(result.current.addressUnresolved).toBe(false);
      expect(result.current.startLocation).toEqual(ADDRESS_LOCATION);
    });

    it('is reset by clearStartLocation', async () => {
      const result = await renderWithUnresolvedGps();

      act(() => {
        result.current.clearStartLocation();
      });

      expect(result.current.addressUnresolved).toBe(false);
      expect(result.current.startLocation).toBeNull();
    });

    it('is reset as soon as a new GPS request starts', async () => {
      const result = await renderWithUnresolvedGps();
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValueOnce(pending.promise);

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      expect(result.current.isLocating).toBe(true);
      expect(result.current.addressUnresolved).toBe(false);

      await act(async () => {
        pending.resolve({ location: GPS_LOCATION, addressResolved: true });
        await request;
      });
      expect(result.current.addressUnresolved).toBe(false);
    });

    it('stays false when the new GPS request fails', async () => {
      const result = await renderWithUnresolvedGps();
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('gps', 'unavailable'),
      );

      await act(async () => {
        await result.current.locateByGps();
      });

      expect(result.current.addressUnresolved).toBe(false);
      expect(result.current.gpsErrorCode).toBe('gps_unavailable');
    });

    it('ignores an unresolved GPS position that arrives after an address was picked', async () => {
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      act(() => {
        result.current.selectAddress(GEOCODE_RESULT);
      });
      await act(async () => {
        pending.resolve({ location: UNRESOLVED_LOCATION, addressResolved: false });
        await request;
      });

      expect(result.current.addressUnresolved).toBe(false);
      expect(result.current.startLocation).toEqual(ADDRESS_LOCATION);
    });

    it('ignores an unresolved GPS position that arrives after "Change" was pressed', async () => {
      const pending = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.locateByGps();
      });
      act(() => {
        result.current.clearStartLocation();
      });
      await act(async () => {
        pending.resolve({ location: UNRESOLVED_LOCATION, addressResolved: false });
        await request;
      });

      expect(result.current.addressUnresolved).toBe(false);
      expect(result.current.startLocation).toBeNull();
    });

    it('takes the flag from the latest of two overlapping GPS requests only', async () => {
      const first = deferred<{ location: Location; addressResolved: boolean }>();
      const second = deferred<{ location: Location; addressResolved: boolean }>();
      mockGetCurrentLocationExecute
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderHook(() => useJoinStartPoint());

      let firstRequest: Promise<void> = Promise.resolve();
      let secondRequest: Promise<void> = Promise.resolve();
      act(() => {
        firstRequest = result.current.locateByGps();
      });
      act(() => {
        secondRequest = result.current.locateByGps();
      });
      await act(async () => {
        second.resolve({ location: GPS_LOCATION, addressResolved: true });
        await secondRequest;
      });
      await act(async () => {
        first.resolve({ location: UNRESOLVED_LOCATION, addressResolved: false });
        await firstRequest;
      });

      expect(result.current.addressUnresolved).toBe(false);
      expect(result.current.startLocation).toEqual(GPS_LOCATION);
    });
  });
});
