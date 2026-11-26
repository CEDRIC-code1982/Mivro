/**
 * @file gpsFailureCode.test.ts
 * @description Unit tests for the shared GPS failure mapping (`toGpsFailureCode`).
 *
 *              Covers every `GeolocationErrorCode`, including `permission_blocked`, which shares
 *              the `gps_permission_denied` reason with a plain refusal (JOURNAL J-068).
 *
 * @module services/domain/geolocation/gpsFailureCode.test
 */

// [ADDED] Shared GPS failure mapping tests (join start point + session creation)
import { type GpsFailureCode, toGpsFailureCode } from '@services/domain/geolocation/gpsFailureCode';
import type { GeolocationErrorCode } from '@services/domain/geolocation/IGeolocationService';

describe('toGpsFailureCode', () => {
  const cases: ReadonlyArray<[GeolocationErrorCode, GpsFailureCode]> = [
    ['permission_denied', 'gps_permission_denied'],
    ['permission_blocked', 'gps_permission_denied'],
    ['unavailable', 'gps_unavailable'],
    ['timeout', 'gps_timeout'],
    ['inaccurate', 'gps_inaccurate'],
    ['unknown', 'gps_unknown'],
  ];

  it.each(cases)('maps %s to %s', (code, expected) => {
    expect(toGpsFailureCode(code)).toBe(expected);
  });

  it('sends a blocked permission to the same reason as a refused one', () => {
    expect(toGpsFailureCode('permission_blocked')).toBe(toGpsFailureCode('permission_denied'));
  });
});
