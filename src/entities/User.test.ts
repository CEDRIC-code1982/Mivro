/**
 * @file User.test.ts
 * @description Tests unitaires de l'entité User.
 *              Unit tests for the User entity.
 *
 * @module entities/User.test
 */

// [ADDED] Tests unitaires entité User
import {
  GuestUserSchema,
  AuthenticatedUserSchema,
  UserSchema,
  isGuestUser,
  isAuthenticatedUser,
} from '@entities/User';
import type { User } from '@entities/User';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2026-01-15T10:30:00.000Z';

describe('User entity', () => {
  // ─── GuestUser parsing ────────────────────────────────────
  describe('GuestUserSchema', () => {
    it('parses a valid GuestUser', () => {
      const guest = GuestUserSchema.parse({
        type: 'guest',
        id: VALID_UUID,
        displayName: 'Invité-AB12',
        createdAt: VALID_DATETIME,
      });

      expect(guest.type).toBe('guest');
      expect(guest.id).toBe(VALID_UUID);
      expect(guest.displayName).toBe('Invité-AB12');
    });

    it('rejects displayName longer than 50 chars', () => {
      const result = GuestUserSchema.safeParse({
        type: 'guest',
        id: VALID_UUID,
        displayName: 'A'.repeat(51),
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty displayName', () => {
      const result = GuestUserSchema.safeParse({
        type: 'guest',
        id: VALID_UUID,
        displayName: '',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });

    // ─── F7 passe 2 — photoUri ──────────────────────────────
    it('accepts a valid photoUri and round-trips it', () => {
      const guest = GuestUserSchema.parse({
        type: 'guest',
        id: VALID_UUID,
        displayName: 'Léa',
        photoUri: '/mock/Documents/profile-photos/abc.jpg',
        createdAt: VALID_DATETIME,
      });

      expect(guest.photoUri).toBe('/mock/Documents/profile-photos/abc.jpg');
    });

    it('rejects an empty photoUri (min 1)', () => {
      const result = GuestUserSchema.safeParse({
        type: 'guest',
        id: VALID_UUID,
        displayName: 'Léa',
        photoUri: '',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });

    it('parses a guest without photoUri (optional)', () => {
      const guest = GuestUserSchema.parse({
        type: 'guest',
        id: VALID_UUID,
        displayName: 'Léa',
        createdAt: VALID_DATETIME,
      });

      expect(guest.photoUri).toBeUndefined();
    });
  });

  // ─── AuthenticatedUser parsing ────────────────────────────
  describe('AuthenticatedUserSchema', () => {
    it('parses a valid AuthenticatedUser', () => {
      const user = AuthenticatedUserSchema.parse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'test@example.com',
        displayName: 'Jean Dupont',
        provider: 'google',
        createdAt: VALID_DATETIME,
      });

      expect(user.type).toBe('authenticated');
      expect(user.email).toBe('test@example.com');
      expect(user.provider).toBe('google');
    });

    it('accepts optional avatarUrl', () => {
      const user = AuthenticatedUserSchema.parse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'test@example.com',
        displayName: 'Jean Dupont',
        avatarUrl: 'https://example.com/avatar.png',
        provider: 'apple',
        createdAt: VALID_DATETIME,
      });

      expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('rejects invalid email', () => {
      const result = AuthenticatedUserSchema.safeParse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'not-an-email',
        displayName: 'Jean',
        provider: 'google',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid provider', () => {
      const result = AuthenticatedUserSchema.safeParse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'test@example.com',
        displayName: 'Jean',
        provider: 'facebook',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });

    // ─── F7 passe 2 — photoUri (distinct de avatarUrl) ──────
    it('accepts a local photoUri alongside a remote avatarUrl', () => {
      const user = AuthenticatedUserSchema.parse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'test@example.com',
        displayName: 'Jean Dupont',
        avatarUrl: 'https://example.com/avatar.png',
        photoUri: '/mock/Documents/profile-photos/def.jpg',
        provider: 'google',
        createdAt: VALID_DATETIME,
      });

      expect(user.photoUri).toBe('/mock/Documents/profile-photos/def.jpg');
      expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('rejects an empty photoUri for an authenticated user', () => {
      const result = AuthenticatedUserSchema.safeParse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'test@example.com',
        displayName: 'Jean',
        photoUri: '',
        provider: 'google',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── UserSchema discriminated union ───────────────────────
  describe('UserSchema', () => {
    it('parses a GuestUser via union', () => {
      const result = UserSchema.safeParse({
        type: 'guest',
        id: VALID_UUID,
        displayName: 'Invité',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(true);
    });

    it('parses an AuthenticatedUser via union', () => {
      const result = UserSchema.safeParse({
        type: 'authenticated',
        id: VALID_UUID,
        email: 'test@example.com',
        displayName: 'Jean',
        provider: 'apple',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid type discriminator', () => {
      const result = UserSchema.safeParse({
        type: 'admin',
        id: VALID_UUID,
        displayName: 'Admin',
        createdAt: VALID_DATETIME,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── Type guards ──────────────────────────────────────────
  describe('Type guards', () => {
    const guest: User = {
      type: 'guest',
      id: VALID_UUID,
      displayName: 'Invité-AB12',
      createdAt: VALID_DATETIME,
    };

    const authenticated: User = {
      type: 'authenticated',
      id: VALID_UUID,
      email: 'test@example.com',
      displayName: 'Jean Dupont',
      provider: 'google',
      createdAt: VALID_DATETIME,
    };

    it('isGuestUser returns true for guest', () => {
      expect(isGuestUser(guest)).toBe(true);
    });

    it('isGuestUser returns false for authenticated', () => {
      expect(isGuestUser(authenticated)).toBe(false);
    });

    it('isAuthenticatedUser returns true for authenticated', () => {
      expect(isAuthenticatedUser(authenticated)).toBe(true);
    });

    it('isAuthenticatedUser returns false for guest', () => {
      expect(isAuthenticatedUser(guest)).toBe(false);
    });
  });
});
