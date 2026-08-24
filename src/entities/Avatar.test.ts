/**
 * @file Avatar.test.ts
 * @description Tests unitaires de l'entité Avatar (F7).
 *              Unit tests for the Avatar entity (F7).
 *
 * @module entities/Avatar.test
 */

// [ADDED] F7 — Tests unitaires entité Avatar
import {
  AVATARS,
  AvatarIdSchema,
  AvatarSchema,
  getAvatarById,
  type AvatarId,
} from '@entities/Avatar';

describe('Avatar entity', () => {
  // ─── getAvatarById ─────────────────────────────────────────
  describe('getAvatarById', () => {
    it('returns the avatar for a known id', () => {
      const avatar = getAvatarById('fox');

      expect(avatar).toBeDefined();
      expect(avatar?.id).toBe('fox');
      expect(avatar?.emoji).toBe('🦊');
    });

    it('returns the matching avatar for every known id', () => {
      for (const expected of AVATARS) {
        expect(getAvatarById(expected.id)).toEqual(expected);
      }
    });

    it('returns undefined for an unknown id', () => {
      expect(getAvatarById('dinosaur')).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(getAvatarById(null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(getAvatarById(undefined)).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getAvatarById('')).toBeUndefined();
    });
  });

  // ─── Intégrité de la liste AVATARS ────────────────────────
  describe('AVATARS list integrity', () => {
    it('contains exactly 20 entries', () => {
      expect(AVATARS).toHaveLength(20);
    });

    it('has ids strictly matching the AvatarIdSchema enum', () => {
      const enumIds = [...AvatarIdSchema.options].sort();
      const listIds = AVATARS.map((a) => a.id).sort();

      expect(listIds).toEqual(enumIds);
    });

    it('has unique ids', () => {
      const ids = AVATARS.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has every entry valid against AvatarSchema', () => {
      for (const avatar of AVATARS) {
        expect(() => AvatarSchema.parse(avatar)).not.toThrow();
      }
    });

    it('has #RRGGBB background colors for every entry', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      for (const avatar of AVATARS) {
        expect(avatar.backgroundColor).toMatch(hexRegex);
      }
    });

    it('has a non-empty emoji for every entry', () => {
      for (const avatar of AVATARS) {
        expect(avatar.emoji.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── AvatarIdSchema ────────────────────────────────────────
  describe('AvatarIdSchema', () => {
    it('parses a valid id', () => {
      const parsed: AvatarId = AvatarIdSchema.parse('robot');
      expect(parsed).toBe('robot');
    });

    it('rejects an unknown id', () => {
      expect(AvatarIdSchema.safeParse('not-real').success).toBe(false);
    });
  });
});
