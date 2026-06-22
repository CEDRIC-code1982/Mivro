/**
 * @file UpdateProfileUseCase.test.ts
 * @description Tests unitaires du use case UpdateProfileUseCase (F7).
 *              Unit tests for the UpdateProfileUseCase (F7).
 *
 * @module __tests__/unit/core/usecases/UpdateProfileUseCase
 */

// [ADDED] F7 — Tests unitaires UpdateProfileUseCase
import { ZodError } from 'zod';
import type { AuthenticatedUser, GuestUser } from '@core/entities/User';
import { UpdateProfileUseCase } from '@core/usecases/UpdateProfileUseCase';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2026-01-15T10:30:00.000Z';

const makeGuest = (overrides?: Partial<GuestUser>): GuestUser => ({
  type: 'guest',
  id: VALID_UUID,
  displayName: 'Léa',
  createdAt: VALID_DATETIME,
  ...overrides,
});

const makeAuthenticated = (overrides?: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  type: 'authenticated',
  id: VALID_UUID,
  email: 'lea@example.com',
  displayName: 'Léa',
  provider: 'google',
  createdAt: VALID_DATETIME,
  ...overrides,
});

describe('UpdateProfileUseCase', () => {
  let useCase: UpdateProfileUseCase;

  beforeEach(() => {
    useCase = new UpdateProfileUseCase();
  });

  // ─── Nominal — mise à jour des champs ─────────────────────
  describe('field updates', () => {
    it('updates displayName only (avatar untouched)', () => {
      const current = makeGuest({ avatarId: 'fox' });

      const updated = useCase.execute(current, { displayName: 'Nouveau' });

      expect(updated.displayName).toBe('Nouveau');
      expect(updated.avatarId).toBe('fox');
    });

    it('updates avatarId only (name untouched)', () => {
      const current = makeGuest({ displayName: 'Léa', avatarId: 'fox' });

      const updated = useCase.execute(current, { avatarId: 'panda' });

      expect(updated.avatarId).toBe('panda');
      expect(updated.displayName).toBe('Léa');
    });

    it('updates both displayName and avatarId', () => {
      const current = makeGuest();

      const updated = useCase.execute(current, { displayName: 'Max', avatarId: 'dragon' });

      expect(updated.displayName).toBe('Max');
      expect(updated.avatarId).toBe('dragon');
    });

    it('returns an equivalent user when patch is empty', () => {
      const current = makeGuest({ displayName: 'Léa', avatarId: 'cat' });

      const updated = useCase.execute(current, {});

      expect(updated.displayName).toBe('Léa');
      expect(updated.avatarId).toBe('cat');
    });
  });

  // ─── Trim ──────────────────────────────────────────────────
  describe('trimming', () => {
    it('trims surrounding whitespace from displayName', () => {
      const current = makeGuest();

      const updated = useCase.execute(current, { displayName: '  Sophie  ' });

      expect(updated.displayName).toBe('Sophie');
    });

    it('rejects a name that is only whitespace (trims to empty)', () => {
      const current = makeGuest();

      expect(() => useCase.execute(current, { displayName: '   ' })).toThrow(ZodError);
    });
  });

  // ─── Limites / rejets ──────────────────────────────────────
  describe('validation errors', () => {
    it('rejects an empty displayName with ZodError', () => {
      const current = makeGuest();

      expect(() => useCase.execute(current, { displayName: '' })).toThrow(ZodError);
    });

    it('rejects a displayName longer than 50 chars with ZodError', () => {
      const current = makeGuest();
      const tooLong = 'a'.repeat(51);

      expect(() => useCase.execute(current, { displayName: tooLong })).toThrow(ZodError);
    });

    it('accepts a displayName of exactly 50 chars', () => {
      const current = makeGuest();
      const exactly50 = 'a'.repeat(50);

      const updated = useCase.execute(current, { displayName: exactly50 });

      expect(updated.displayName).toBe(exactly50);
    });

    it('rejects an unknown avatarId with ZodError', () => {
      const current = makeGuest();

      // Cast justifié : on teste volontairement une valeur hors enum (TS-002)
      expect(() =>
        useCase.execute(current, {
          avatarId: 'not-an-avatar' as never,
        }),
      ).toThrow(ZodError);
    });
  });

  // ─── F7 passe 2 — photoUri (set / clear / inchangé) ───────
  describe('photoUri', () => {
    const PHOTO = '/mock/Documents/profile-photos/abc.jpg';

    it('sets photoUri from a string', () => {
      const current = makeGuest();

      const updated = useCase.execute(current, { photoUri: PHOTO });

      expect(updated.photoUri).toBe(PHOTO);
    });

    it('clears photoUri when null (field removed)', () => {
      const current = makeGuest({ photoUri: PHOTO });

      const updated = useCase.execute(current, { photoUri: null });

      expect(updated.photoUri).toBeUndefined();
      expect('photoUri' in updated).toBe(false);
    });

    it('leaves photoUri untouched when field is absent', () => {
      const current = makeGuest({ photoUri: PHOTO });

      const updated = useCase.execute(current, { displayName: 'Léo' });

      expect(updated.photoUri).toBe(PHOTO);
      expect(updated.displayName).toBe('Léo');
    });

    it('rejects an empty-string photoUri with ZodError', () => {
      const current = makeGuest();

      expect(() => useCase.execute(current, { photoUri: '' })).toThrow(ZodError);
    });

    it('combines photoUri with displayName and avatarId', () => {
      const current = makeGuest();

      const updated = useCase.execute(current, {
        displayName: 'Max',
        avatarId: 'dragon',
        photoUri: PHOTO,
      });

      expect(updated.displayName).toBe('Max');
      expect(updated.avatarId).toBe('dragon');
      expect(updated.photoUri).toBe(PHOTO);
    });

    it('clears photoUri on an authenticated user without losing other fields', () => {
      const current = makeAuthenticated({ photoUri: PHOTO, avatarUrl: 'https://x.test/a.png' });

      const updated = useCase.execute(current, { photoUri: null });

      expect(updated.photoUri).toBeUndefined();
      if (updated.type !== 'authenticated') throw new Error('expected authenticated user');
      expect(updated.email).toBe('lea@example.com');
      expect(updated.avatarUrl).toBe('https://x.test/a.png');
    });
  });

  // ─── Préservation de la discriminated union ───────────────
  describe('discriminated union preservation', () => {
    it('preserves the guest type and createdAt', () => {
      const current = makeGuest();

      const updated = useCase.execute(current, { displayName: 'Léo' });

      expect(updated.type).toBe('guest');
      expect(updated.id).toBe(VALID_UUID);
      expect(updated.createdAt).toBe(VALID_DATETIME);
    });

    it('preserves authenticated-only fields (email, provider, avatarUrl)', () => {
      const current = makeAuthenticated({
        avatarUrl: 'https://example.com/a.png',
        provider: 'apple',
      });

      const updated = useCase.execute(current, { displayName: 'Inès', avatarId: 'owl' });

      expect(updated.type).toBe('authenticated');
      if (updated.type !== 'authenticated') throw new Error('expected authenticated user');
      expect(updated.email).toBe('lea@example.com');
      expect(updated.provider).toBe('apple');
      expect(updated.avatarUrl).toBe('https://example.com/a.png');
      expect(updated.displayName).toBe('Inès');
      expect(updated.avatarId).toBe('owl');
    });
  });
});
