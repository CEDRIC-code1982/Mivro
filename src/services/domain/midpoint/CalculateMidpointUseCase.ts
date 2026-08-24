/**
 * @file CalculateMidpointUseCase.ts
 * @description Orchestrateur métier pour le calcul du midpoint d'une session.
 *              Business orchestrator for session midpoint calculation.
 *
 *              Stratégie MVP : centroïde cartésien client-side.
 *              Strategy MVP: client-side cartesian centroid.
 *
 *              Pour V1 : moyenne géodésique pour grandes distances.
 *              For V1: geodesic mean for long distances.
 *
 * @example
 *   const useCase = new CalculateMidpointUseCase();
 *   const result = useCase.execute({ participants });
 *   // { midpoint: {...}, radius: 5000, participantsCount: 3 }
 *
 * @module services/domain/midpoint/CalculateMidpointUseCase
 */

// [ADDED] UseCase CalculateMidpointUseCase — calcul pur sans I/O
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import { computeCentroid, computeRadius } from '@services/utils/geo';

const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 5;

/**
 * Codes d'erreur pour le calcul du midpoint.
 * Error codes for midpoint calculation.
 */
export type CalculateMidpointErrorCode = 'too_few_participants' | 'too_many_participants';

/**
 * Erreur métier levée quand la validation des participants échoue.
 * Business error thrown when participant validation fails.
 *
 * @param message — message descriptif / descriptive message
 * @param code — code d'erreur typé / typed error code
 */
export class CalculateMidpointError extends Error {
  constructor(message: string, public readonly code: CalculateMidpointErrorCode) {
    super(message);
    this.name = 'CalculateMidpointError';
  }
}

/**
 * Entrée du UseCase : liste des participants de la session.
 * UseCase input: session participant list.
 *
 * @param participants — liste de participants (2 à 5) / participant list (2 to 5)
 */
export interface CalculateMidpointInput {
  readonly participants: readonly Participant[];
}

/**
 * Résultat du calcul : midpoint + rayon + nombre de participants.
 * Calculation result: midpoint + radius + participant count.
 *
 * @param midpoint — coordonnées du centroïde / centroid coordinates
 * @param radius — rayon de zone en mètres (distance max au centroïde) / zone radius in meters
 * @param participantsCount — nombre de participants utilisés / number of participants used
 */
export interface CalculateMidpointResult {
  readonly midpoint: Coordinates;
  /** Rayon de zone en mètres (distance max du centroïde aux participants) */
  readonly radius: number;
  /** Nombre de participants utilisés / Number of participants used */
  readonly participantsCount: number;
}

/**
 * Use case : calcul du midpoint à partir des positions de départ.
 * Use case: midpoint calculation from start positions.
 *
 * Calcul pur (pas d'I/O, pas de side-effects, pas de Date.now()).
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
   * Calcule le midpoint et le rayon de zone d'une liste de participants.
   * Computes the midpoint and zone radius from a list of participants.
   *
   * @param input — participants de la session / session participants
   * @returns midpoint + radius + participantsCount
   * @throws CalculateMidpointError code 'too_few_participants' si < 2
   * @throws CalculateMidpointError code 'too_many_participants' si > 5
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
    const radius = computeRadius(midpoint, coords);

    // [ADDED] Log INFO sans coordonnées brutes (RGPD — LOG-001)
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
