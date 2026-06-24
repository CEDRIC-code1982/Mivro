/**
 * @file RealtimeParticipant.test.ts
 * @description Tests unitaires de l'entité RealtimeParticipant (Zod strict).
 *              Unit tests for the RealtimeParticipant entity (strict Zod).
 *
 * @module __tests__/unit/core/entities/RealtimeParticipant
 */

// [ADDED] F4 — Tests unitaires RealtimeParticipant
import {
  RealtimeLocationUpdateSchema,
  RealtimeParticipantSchema,
} from '@core/entities/RealtimeParticipant';
import type {
  RealtimeLocationUpdate,
  RealtimeParticipant,
} from '@core/entities/RealtimeParticipant';

const validParticipant: RealtimeParticipant = {
  participantId: '550e8400-e29b-41d4-a716-446655440000',
  latitude: 48.8566,
  longitude: 2.3522,
  updatedAt: 1_700_000_000_000,
  speed: 12.4,
  heading: 180,
  isOnline: true,
};

describe('RealtimeParticipantSchema', () => {
  // ─── Cas nominal ──────────────────────────────────────────
  describe('valid payloads', () => {
    it('accepts a valid participant', () => {
      const result = RealtimeParticipantSchema.safeParse(validParticipant);

      expect(result.success).toBe(true);
    });

    it('round-trips the parsed data unchanged', () => {
      const result = RealtimeParticipantSchema.safeParse(validParticipant);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParticipant);
      }
    });

    it('accepts isOnline=false', () => {
      const result = RealtimeParticipantSchema.safeParse({
        ...validParticipant,
        isOnline: false,
      });

      expect(result.success).toBe(true);
    });

    it('accepts speed of exactly 0 (stationary)', () => {
      const result = RealtimeParticipantSchema.safeParse({ ...validParticipant, speed: 0 });

      expect(result.success).toBe(true);
    });
  });

  // ─── Bornes latitude / longitude ──────────────────────────
  describe('latitude / longitude bounds', () => {
    it.each([-90, 0, 90])('accepts latitude %p', (latitude) => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, latitude }).success).toBe(
        true,
      );
    });

    it.each([-91, 91, 200])('rejects out-of-range latitude %p', (latitude) => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, latitude }).success).toBe(
        false,
      );
    });

    it.each([-180, 0, 180])('accepts longitude %p', (longitude) => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, longitude }).success).toBe(
        true,
      );
    });

    it.each([-181, 181, 360])('rejects out-of-range longitude %p', (longitude) => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, longitude }).success).toBe(
        false,
      );
    });
  });

  // ─── Heading [0, 360] ─────────────────────────────────────
  describe('heading bounds', () => {
    it.each([0, 90, 359, 360])('accepts heading %p', (heading) => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, heading }).success).toBe(
        true,
      );
    });

    it.each([-1, 361, 500])('rejects out-of-range heading %p', (heading) => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, heading }).success).toBe(
        false,
      );
    });
  });

  // ─── Speed ────────────────────────────────────────────────
  describe('speed bounds', () => {
    it('rejects negative speed', () => {
      expect(RealtimeParticipantSchema.safeParse({ ...validParticipant, speed: -1 }).success).toBe(
        false,
      );
    });
  });

  // ─── updatedAt ────────────────────────────────────────────
  describe('updatedAt', () => {
    it('rejects negative updatedAt', () => {
      expect(
        RealtimeParticipantSchema.safeParse({ ...validParticipant, updatedAt: -1 }).success,
      ).toBe(false);
    });

    it('rejects non-integer updatedAt', () => {
      expect(
        RealtimeParticipantSchema.safeParse({ ...validParticipant, updatedAt: 1.5 }).success,
      ).toBe(false);
    });

    it('accepts updatedAt of 0', () => {
      expect(
        RealtimeParticipantSchema.safeParse({ ...validParticipant, updatedAt: 0 }).success,
      ).toBe(true);
    });
  });

  // ─── Champs manquants / mauvais types ─────────────────────
  describe('missing or wrong-typed fields', () => {
    it('rejects empty participantId', () => {
      expect(
        RealtimeParticipantSchema.safeParse({ ...validParticipant, participantId: '' }).success,
      ).toBe(false);
    });

    it.each([
      'participantId',
      'latitude',
      'longitude',
      'updatedAt',
      'speed',
      'heading',
      'isOnline',
    ])('rejects when %s is missing', (field) => {
      const incomplete: Record<string, unknown> = { ...validParticipant };
      delete incomplete[field];

      expect(RealtimeParticipantSchema.safeParse(incomplete).success).toBe(false);
    });

    it('rejects non-boolean isOnline', () => {
      expect(
        RealtimeParticipantSchema.safeParse({ ...validParticipant, isOnline: 'yes' }).success,
      ).toBe(false);
    });

    it('rejects non-number latitude', () => {
      expect(
        RealtimeParticipantSchema.safeParse({ ...validParticipant, latitude: '48.8' }).success,
      ).toBe(false);
    });

    it('rejects null payload', () => {
      expect(RealtimeParticipantSchema.safeParse(null).success).toBe(false);
    });
  });
});

describe('RealtimeLocationUpdateSchema', () => {
  const validUpdate: RealtimeLocationUpdate = {
    latitude: 48.8566,
    longitude: 2.3522,
    speed: 10,
    heading: 90,
  };

  it('accepts a valid location update', () => {
    expect(RealtimeLocationUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it('does not require participantId / updatedAt / isOnline (server-managed)', () => {
    const result = RealtimeLocationUpdateSchema.safeParse(validUpdate);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validUpdate);
      expect('participantId' in result.data).toBe(false);
      expect('updatedAt' in result.data).toBe(false);
      expect('isOnline' in result.data).toBe(false);
    }
  });

  it('rejects out-of-range latitude', () => {
    expect(RealtimeLocationUpdateSchema.safeParse({ ...validUpdate, latitude: 200 }).success).toBe(
      false,
    );
  });

  it('rejects negative heading', () => {
    expect(RealtimeLocationUpdateSchema.safeParse({ ...validUpdate, heading: -10 }).success).toBe(
      false,
    );
  });

  it('rejects a missing field', () => {
    const withoutSpeed: Record<string, unknown> = { ...validUpdate };
    delete withoutSpeed.speed;
    expect(RealtimeLocationUpdateSchema.safeParse(withoutSpeed).success).toBe(false);
  });
});
