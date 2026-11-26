/**
 * @file useJoinStartPoint.ts
 * @description Start point selection hook for the join screen (F5).
 *
 *              A guest who opens an invitation link must say where they start from before
 *              joining: the shared midpoint is recomputed with that point. Two paths:
 *              - `locateByGps()`: current GPS position through `GetCurrentLocationUseCase`
 *                (same use case as `useCreateSessionFlow.addByGps`), with a typed GPS failure
 *                reason (`toGpsFailureCode`, shared with the creation flow);
 *              - `selectAddress(result)`: a geocode result picked in an address search.
 *
 *              The hook owns the DI access so that the screen never imports the container (layer
 *              rule `screens-no-adapter`). It never throws: a GPS failure is exposed through
 *              `gpsErrorCode`.
 *
 * @module features/Session/hooks/useJoinStartPoint
 */

// [ADDED] Join start point selection (GPS or address)
import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { GeocodeResult } from '@entities/GeocodeResult';
import type { Location } from '@entities/Location';
import { type GpsFailureCode, toGpsFailureCode } from '@services/domain/geolocation/gpsFailureCode';
import { GeolocationError } from '@services/domain/geolocation/IGeolocationService';
import { getContainer } from '@services/serviceContainer';

/**
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Maps any GPS failure to the reason shown to the user.
 *
 * @param error - Error thrown by the use case
 * @returns GPS failure reason (`gps_unknown` for anything that is not a GeolocationError)
 */
const toFailureCode = (error: unknown): GpsFailureCode =>
  error instanceof GeolocationError ? toGpsFailureCode(error.code) : 'gps_unknown';

/**
 * Converts a geocode result into a start location.
 *
 * @param result - Geocode result picked by the user
 * @returns Start location with a fresh id
 */
const toStartLocation = (result: GeocodeResult): Location => ({
  id: uuidv4(),
  coordinates: result.coordinates,
  formattedAddress: result.displayName,
});

/**
 * useJoinStartPoint hook result.
 */
export interface UseJoinStartPointResult {
  /** Start point chosen so far, or null while none is chosen */
  startLocation: Location | null;
  /** true while the GPS position is being fetched */
  isLocating: boolean;
  /** Reason of the last GPS failure, or null */
  gpsErrorCode: GpsFailureCode | null;
  /**
   * [ADDED] true when the start point comes from the GPS but its address could not be resolved
   * (offline reverse geocoding): `startLocation.formattedAddress` then holds raw coordinates.
   * Reset to false by `selectAddress`, `clearStartLocation` and every new `locateByGps`.
   */
  addressUnresolved: boolean;
  /**
   * Fetches the current GPS position and uses it as the start point. Never rejects: a failure
   * sets `gpsErrorCode`.
   */
  locateByGps: () => Promise<void>;
  /**
   * Uses a geocode result as the start point.
   *
   * @param result - Geocode result picked in the address search
   */
  selectAddress: (result: GeocodeResult) => void;
  /** Forgets the chosen start point (the "Change" action), and the last GPS failure */
  clearStartLocation: () => void;
}

/**
 * Start point selection for the join screen.
 *
 * @returns Chosen start point, GPS state and actions
 */
export const useJoinStartPoint = (): UseJoinStartPointResult => {
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsErrorCode, setGpsErrorCode] = useState<GpsFailureCode | null>(null);
  const [addressUnresolved, setAddressUnresolved] = useState(false); // [ADDED]

  // Id of the latest GPS request: a position that arrives after another choice (an address
  // picked, or "Change" pressed) must not overwrite it.
  const requestRef = useRef(0);

  const locateByGps = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    setIsLocating(true);
    setGpsErrorCode(null);
    setAddressUnresolved(false);

    try {
      const { getCurrentLocationUseCase } = getContainer();
      const { location, addressResolved } = await getCurrentLocationUseCase.execute({
        language: 'fr', // TODO V1: use the current i18n language (same as useCreateSessionFlow.addByGps)
      });
      if (requestId !== requestRef.current) return;
      setStartLocation(location);
      // [ADDED] Offline: the address is raw coordinates — let the screen explain it.
      setAddressUnresolved(!addressResolved);
      console.log(
        `[INFO][useJoinStartPoint][locateByGps][?][${timestamp()}] Start point from GPS | ` +
          `addressResolved: ${String(addressResolved)}`,
      );
    } catch (error: unknown) {
      if (requestId !== requestRef.current) return;
      const code = toFailureCode(error);
      setGpsErrorCode(code);
      console.error(
        `[ERROR][useJoinStartPoint][locateByGps][?][${timestamp()}] GPS failed | code: ${code}`,
      );
    } finally {
      if (requestId === requestRef.current) {
        setIsLocating(false);
      }
    }
  }, []);

  const selectAddress = useCallback((result: GeocodeResult): void => {
    requestRef.current += 1;
    setIsLocating(false);
    setGpsErrorCode(null);
    setAddressUnresolved(false);
    setStartLocation(toStartLocation(result));
    console.log(
      `[INFO][useJoinStartPoint][selectAddress][?][${timestamp()}] Start point from address`,
    );
  }, []);

  const clearStartLocation = useCallback((): void => {
    requestRef.current += 1;
    setIsLocating(false);
    setGpsErrorCode(null);
    setAddressUnresolved(false);
    setStartLocation(null);
  }, []);

  return {
    startLocation,
    isLocating,
    gpsErrorCode,
    addressUnresolved,
    locateByGps,
    selectAddress,
    clearStartLocation,
  };
};
