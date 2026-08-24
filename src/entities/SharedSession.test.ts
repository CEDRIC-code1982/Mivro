/**
 * @file SharedSession.test.ts
 * @description Tests unitaires de l'entité SharedSession (F5).
 *              Unit tests for the SharedSession entity (F5).
 *
 *              Couvre : validation Zod (meta + members), computeExpiresAt
 *              (guest +24h / account +7j), buildShareLink, round-trip meta+members.
 *
 * @module entities/SharedSession.test
 */

// [ADDED] F5 — Tests unitaires entité SharedSession
import {
  SHARE_TTL_ACCOUNT_MS,
  SHARE_TTL_GUEST_MS,
  SharedSessionMemberSchema,
  SharedSessionMetaSchema,
  SharedSessionSchema,
  buildShareLink,
  computeExpiresAt,
  type SharedSession,
} from '@entities/SharedSession';

const NOW = 1_700_000_000_000;

const validMeta = {
  createdAt: NOW,
  expiresAt: NOW + SHARE_TTL_GUEST_MS,
  ownerType: 'guest' as const,
  status: 'open' as const,
};

const validMember = {
  memberId: 'member-001',
  displayName: 'Alice',
  startLocation: {
    latitude: 48.8566,
    longitude: 2.3522,
    formattedAddress: '1 rue de Paris',
  },
};

const validSession: SharedSession = {
  sessionId: 'session-001',
  meta: validMeta,
  members: [validMember],
};

describe('SharedSession entity', () => {
  // ─── SharedSessionMemberSchema ────────────────────────────
  describe('SharedSessionMemberSchema', () => {
    it('accepts a valid member', () => {
      expect(SharedSessionMemberSchema.safeParse(validMember).success).toBe(true);
    });

    it('accepts an optional avatarId from the avatar enum', () => {
      const result = SharedSessionMemberSchema.safeParse({ ...validMember, avatarId: 'fox' });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown avatarId', () => {
      const result = SharedSessionMemberSchema.safeParse({ ...validMember, avatarId: 'nope' });
      expect(result.success).toBe(false);
    });

    it('rejects an empty memberId', () => {
      const result = SharedSessionMemberSchema.safeParse({ ...validMember, memberId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects an empty displayName', () => {
      const result = SharedSessionMemberSchema.safeParse({ ...validMember, displayName: '' });
      expect(result.success).toBe(false);
    });

    it('rejects out-of-range latitude', () => {
      const result = SharedSessionMemberSchema.safeParse({
        ...validMember,
        startLocation: { ...validMember.startLocation, latitude: 91 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects out-of-range longitude', () => {
      const result = SharedSessionMemberSchema.safeParse({
        ...validMember,
        startLocation: { ...validMember.startLocation, longitude: 181 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty formattedAddress', () => {
      const result = SharedSessionMemberSchema.safeParse({
        ...validMember,
        startLocation: { ...validMember.startLocation, formattedAddress: '' },
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── SharedSessionMetaSchema ──────────────────────────────
  describe('SharedSessionMetaSchema', () => {
    it('accepts valid meta without midpoint', () => {
      expect(SharedSessionMetaSchema.safeParse(validMeta).success).toBe(true);
    });

    it('accepts valid meta with midpoint + radius', () => {
      const result = SharedSessionMetaSchema.safeParse({
        ...validMeta,
        midpoint: { latitude: 48.85, longitude: 2.35 },
        midpointRadius: 1500,
      });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown ownerType', () => {
      const result = SharedSessionMetaSchema.safeParse({ ...validMeta, ownerType: 'admin' });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown status', () => {
      const result = SharedSessionMetaSchema.safeParse({ ...validMeta, status: 'paused' });
      expect(result.success).toBe(false);
    });

    it('rejects a negative createdAt', () => {
      const result = SharedSessionMetaSchema.safeParse({ ...validMeta, createdAt: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects a non-integer expiresAt', () => {
      const result = SharedSessionMetaSchema.safeParse({ ...validMeta, expiresAt: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects a non-positive midpointRadius', () => {
      const result = SharedSessionMetaSchema.safeParse({ ...validMeta, midpointRadius: 0 });
      expect(result.success).toBe(false);
    });
  });

  // ─── SharedSessionSchema ──────────────────────────────────
  describe('SharedSessionSchema', () => {
    it('accepts a complete valid session', () => {
      expect(SharedSessionSchema.safeParse(validSession).success).toBe(true);
    });

    it('accepts a session with an empty members array', () => {
      const result = SharedSessionSchema.safeParse({ ...validSession, members: [] });
      expect(result.success).toBe(true);
    });

    it('rejects an empty sessionId', () => {
      const result = SharedSessionSchema.safeParse({ ...validSession, sessionId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects a session without meta', () => {
      const result = SharedSessionSchema.safeParse({
        sessionId: 'session-001',
        members: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a session whose members contain an invalid member', () => {
      const result = SharedSessionSchema.safeParse({
        ...validSession,
        members: [{ ...validMember, displayName: '' }],
      });
      expect(result.success).toBe(false);
    });

    it('round-trips meta + members through parse', () => {
      const parsed = SharedSessionSchema.parse(validSession);
      expect(parsed).toEqual(validSession);
    });
  });

  // ─── computeExpiresAt ─────────────────────────────────────
  describe('computeExpiresAt', () => {
    it('adds 24h for a guest owner', () => {
      expect(computeExpiresAt('guest', NOW)).toBe(NOW + SHARE_TTL_GUEST_MS);
      expect(SHARE_TTL_GUEST_MS).toBe(24 * 60 * 60 * 1000);
    });

    it('adds 7 days for an account owner', () => {
      expect(computeExpiresAt('account', NOW)).toBe(NOW + SHARE_TTL_ACCOUNT_MS);
      expect(SHARE_TTL_ACCOUNT_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('produces a longer TTL for account than for guest', () => {
      expect(computeExpiresAt('account', NOW)).toBeGreaterThan(computeExpiresAt('guest', NOW));
    });
  });

  // ─── buildShareLink ───────────────────────────────────────
  describe('buildShareLink', () => {
    it('builds a mivro:// deep link with the session id', () => {
      expect(buildShareLink('abc-123')).toBe('mivro://session/abc-123');
    });

    it('uses the mivro://session/ prefix', () => {
      expect(buildShareLink('x')).toMatch(/^mivro:\/\/session\//);
    });
  });
});
