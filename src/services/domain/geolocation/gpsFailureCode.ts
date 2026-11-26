/**
 * @file gpsFailureCode.ts
 * @description Shared mapping from a one-shot GPS failure (`GeolocationErrorCode`) to the reason
 *              shown to the user when they ask for "my position" as a start point.
 *
 *              Used by the session creation flow (`useCreateSessionFlow.addByGps`) and by the
 *              join flow (`useJoinStartPoint.locateByGps`), which both display one message per
 *              reason. A refused and a blocked permission share the same reason: both send the
 *              user to the location settings (JOURNAL J-068).
 *
 *              The real-time tracking hook (`useRealtimeTracking.toErrorCode`) keeps its own
 *              mapping on purpose: it maps into the `realtime.errors.*` key space, where
 *              `permission_denied` already means a refusal of the real-time service, not of the
 *              location permission.
 *
 * @module services/domain/geolocation/gpsFailureCode
 */

// [ADDED] Shared GPS failure mapping (join start point + session creation)
import type { GeolocationErrorCode } from '@services/domain/geolocation/IGeolocationService';

/**
 * Reason of a failed "my position" request, as shown to the user.
 *
 * - gps_permission_denied: permission refused or blocked, the user must open the settings
 * - gps_unavailable: location service off or unavailable
 * - gps_timeout: no fix within the timeout
 * - gps_inaccurate: a fix was found but it is not precise enough
 * - gps_unknown: unexpected failure
 */
export type GpsFailureCode =
  | 'gps_permission_denied'
  | 'gps_unavailable'
  | 'gps_timeout'
  | 'gps_inaccurate'
  | 'gps_unknown';

/**
 * Maps a geolocation error code to the reason shown to the user.
 *
 * @param code - Typed geolocation error code
 * @returns The matching GPS failure reason
 */
export const toGpsFailureCode = (code: GeolocationErrorCode): GpsFailureCode => {
  switch (code) {
    case 'permission_denied':
    case 'permission_blocked':
      return 'gps_permission_denied';
    case 'unavailable':
      return 'gps_unavailable';
    case 'timeout':
      return 'gps_timeout';
    case 'inaccurate':
      return 'gps_inaccurate';
    case 'unknown':
      return 'gps_unknown';
  }
};
