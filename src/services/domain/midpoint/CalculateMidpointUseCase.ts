/**
 * @file CalculateMidpointUseCase.ts
 * @description Business orchestrator for session midpoint calculation.
 *
 *              MVP strategy: client-side cartesian centroid.
 *
 *              For V1: geodesic mean for long distances.
 *
 *              The zone radius is floored at `MIN_ZONE_RADIUS_M`: participants at the same address
 *              (or a few metres apart) used to get a 0 m radius, which the map and POI screens read
 *              as "no calculation" (`!midpointRadius`) and the Zod schemas reject (`positive()`).
 *
 * @example
 *   const useCase = new CalculateMidpointUseCase();
 *   const result = useCase.execute({ participants });
 *   // { midpoint: {...}, radius: 5000, participantsCount: 3 }
 *
 * @module services/domain/midpoint/CalculateMidpointUseCase
 */

// [ADDED] CalculateMidpointUseCase use case — pure computation, no I/O
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import { computeCentroid, computeRadius } from '@services/utils/geo';

const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 5;

/**
 * Minimum zone radius, in meters (~6 min walk). Matches the POI search floor
 * (`MIN_POI_SEARCH_RADIUS_M`), so the circle drawn on the map is the area searched for places.
 */
export const MIN_ZONE_RADIUS_M = 500; // [ADDED] "Rayon de zone nul" fix

/**
 * Error codes for midpoint calculation.
 */
export type CalculateMidpointErrorCode = 'too_few_participants' | 'too_many_participants';

/**
 * Business error thrown when participant validation fails.
 *
 * @param message — descriptive message
 * @param code — typed error code
 */
export class CalculateMidpointError extends Error {
  constructor(message: string, public readonly code: CalculateMidpointErrorCode) {
    super(message);
    this.name = 'CalculateMidpointError';
  }
}

/**
 * Use case input: session participant list.
 *
 * @param participants — participant list (2 to 5)
 */
export interface CalculateMidpointInput {
  readonly participants: readonly Participant[];
}

/**
 * Calculation result: midpoint + radius + participant count.
 *
 * @param midpoint — centroid coordinates
 * @param radius — zone radius in meters (max distance to the centroid, at least `MIN_ZONE_RADIUS_M`)
 * @param participantsCount — number of participants used
 */
export interface CalculateMidpointResult {
  readonly midpoint: Coordinates;
  /** Zone radius in meters (max distance from the centroid to the participants, floored at `MIN_ZONE_RADIUS_M`) */
  readonly radius: number;
  /** Number of participants used */
  readonly participantsCount: number;
}

/**
 * Use case: midpoint calculation from start positions.
 *
 * Pure calculation (no I/O, no side-effects, no Date.now()).
 *
 * @example
 *   const useCase = new CalculateMidpointUseCase();
 *   const result = useCase.execute({ participants: [p1, p2] });
 *   console.log(result.midpoint); // { latitude: 47.31, longitude: 3.59 }
 *   console.log(result.radius);   // 196000 (meters)
 */
export class CalculateMidpointUseCase {
  /**
   * Computes the midpoint and zone radius from a list of participants.
   *
   * @param input — session participants
   * @returns midpoint + radius + participantsCount
   * @throws CalculateMidpointError code 'too_few_participants' if < 2
   * @throws CalculateMidpointError code 'too_many_participants' if > 5
   */
  execute(input: CalculateMidpointInput): CalculateMidpointResult {
    const { participants } = input;

    if (participants.length < MIN_PARTICIPANTS) {
      throw new CalculateMidpointError(
        `At least ${MIN_PARTICIPANTS} participants required`,
        'too_few_participants',
      );
    }

    if (participants.length > MAX_PARTICIPANTS) {
      throw new CalculateMidpointError(
        `Max ${MAX_PARTICIPANTS} participants allowed`,
        'too_many_participants',
      );
    }

    const coords = participants.map((p) => p.startLocation.coordinates);

    const midpoint = computeCentroid(coords);
    // [FIXED] "Rayon de zone nul": participants at the same address gave a 0 m radius, read as
    // "no calculation" by MapScreen / POIScreen and rejected by the `positive()` Zod schemas.
    const radius = Math.max(computeRadius(midpoint, coords), MIN_ZONE_RADIUS_M);

    // [ADDED] INFO log without raw coordinates (GDPR — LOG-001)
    console.info(
      `[INFO][CalculateMidpointUseCase][execute][?][${new Date().toISOString().slice(11, 19)}] ` +
        `Midpoint calculated for ${participants.length} participants | radius: ${Math.round(
          radius,
        )}m`,
    );

    return {
      midpoint,
      radius,
      participantsCount: participants.length,
    };
  }
}
