/**
 * @file MidpointSession.test.ts
 * @description Tests unitaires de l'entité MidpointSession.
 *              Unit tests for the MidpointSession entity.
 *
 * @module entities/MidpointSession.test
 */

// [ADDED] Tests unitaires entité MidpointSession
import {
  ParticipantSchema,
  SessionStatusSchema,
  MidpointSessionSchema,
} from '@entities/MidpointSession';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '770e8400-e29b-41d4-a716-446655440002';
const VALID_DATETIME = '2026-01-15T10:30:00.000Z';

const makeParticipant = (id: string, name: string) => ({
  id,
  displayName: name,
  startLocation: {
    id: VALID_UUID,
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
    formattedAddress: 'Paris',
  },
});

describe('MidpointSession entity', () => {
  // ─── ParticipantSchema ────────────────────────────────────
  describe('ParticipantSchema', () => {
    it('parses a valid Participant', () => {
      const participant = ParticipantSchema.parse(makeParticipant(VALID_UUID, 'Alice'));

      expect(participant.displayName).toBe('Alice');
      expect(participant.startLocation.coordinates.latitude).toBe(48.8566);
    });

    it('rejects empty displayName', () => {
      const result = ParticipantSchema.safeParse(makeParticipant(VALID_UUID, ''));

      expect(result.success).toBe(false);
    });
  });

  // ─── SessionStatusSchema ──────────────────────────────────
  describe('SessionStatusSchema', () => {
    it.each(['draft', 'computed', 'active', 'completed'] as const)(
      'accepts status "%s"',
      (status) => {
        expect(SessionStatusSchema.parse(status)).toBe(status);
      },
    );

    it('rejects invalid status', () => {
      const result = SessionStatusSchema.safeParse('cancelled');

      expect(result.success).toBe(false);
    });
  });

  // ─── MidpointSessionSchema ────────────────────────────────
  describe('MidpointSessionSchema', () => {
    const validSession = {
      id: VALID_UUID,
      status: 'draft',
      participants: [makeParticipant(VALID_UUID, 'Alice'), makeParticipant(VALID_UUID_2, 'Bob')],
      createdAt: VALID_DATETIME,
      updatedAt: VALID_DATETIME,
    };

    it('parses a valid session with 2 participants', () => {
      const session = MidpointSessionSchema.parse(validSession);

      expect(session.status).toBe('draft');
      expect(session.participants).toHaveLength(2);
    });

    it('accepts optional midpoint and midpointRadius', () => {
      const session = MidpointSessionSchema.parse({
        ...validSession,
        status: 'computed',
        midpoint: { latitude: 48.85, longitude: 2.35 },
        midpointRadius: 500,
      });

      expect(session.midpoint?.latitude).toBe(48.85);
      expect(session.midpointRadius).toBe(500);
    });

    it('rejects session with less than 2 participants', () => {
      const result = MidpointSessionSchema.safeParse({
        ...validSession,
        participants: [makeParticipant(VALID_UUID, 'Alice')],
      });

      expect(result.success).toBe(false);
    });

    it('rejects session with more than 5 participants', () => {
      const sixParticipants = Array.from({ length: 6 }, (_, i) =>
        makeParticipant(`550e8400-e29b-41d4-a716-44665544000${i}`, `P${String(i)}`),
      );

      const result = MidpointSessionSchema.safeParse({
        ...validSession,
        participants: sixParticipants,
      });

      expect(result.success).toBe(false);
    });

    it('accepts session with exactly 5 participants', () => {
      const fiveParticipants = [
        makeParticipant(VALID_UUID, 'Alice'),
        makeParticipant(VALID_UUID_2, 'Bob'),
        makeParticipant(VALID_UUID_3, 'Charlie'),
        makeParticipant('880e8400-e29b-41d4-a716-446655440003', 'Diana'),
        makeParticipant('990e8400-e29b-41d4-a716-446655440004', 'Eve'),
      ];

      const result = MidpointSessionSchema.safeParse({
        ...validSession,
        participants: fiveParticipants,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative midpointRadius', () => {
      const result = MidpointSessionSchema.safeParse({
        ...validSession,
        midpointRadius: -100,
      });

      expect(result.success).toBe(false);
    });
  });
});
