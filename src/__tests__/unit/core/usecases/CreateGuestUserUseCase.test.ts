/**
 * @file CreateGuestUserUseCase.test.ts
 * @description Tests unitaires du use case CreateGuestUser.
 *              Unit tests for the CreateGuestUser use case.
 *
 * @module __tests__/unit/core/usecases/CreateGuestUserUseCase
 */

// [ADDED] Tests unitaires CreateGuestUserUseCase

// Mock uuid pour des résultats déterministes
// Mock uuid for deterministic results
// Variables préfixées `mock` pour respecter la contrainte jest.mock()
const mockUuid1 = '550e8400-e29b-41d4-a716-446655440000';
const mockUuid2 = '660e8400-e29b-41d4-a716-446655440001';
let mockCallCount = 0;

jest.mock('uuid', () => ({
  v4: () => {
    mockCallCount++;
    // Premier appel = fallbackName slug, deuxième appel = id
    // First call = fallbackName slug, second call = id
    return mockCallCount % 2 === 1 ? mockUuid1 : mockUuid2;
  },
}));

import { GuestUserSchema } from '@core/entities/User';
import { CreateGuestUserUseCase } from '@core/usecases/CreateGuestUserUseCase';

describe('CreateGuestUserUseCase', () => {
  let useCase: CreateGuestUserUseCase;

  beforeEach(() => {
    useCase = new CreateGuestUserUseCase();
    mockCallCount = 0;
  });

  it('generates a guest with a valid UUID id', () => {
    const guest = useCase.execute();

    // UUID format: 8-4-4-4-12 hex digits
    expect(guest.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('generates a default displayName matching "Invité-XXXX" pattern', () => {
    const guest = useCase.execute();

    // Le fallbackName est "Invité-" + 4 premiers chars du premier UUID en majuscules
    // The fallbackName is "Invité-" + first 4 chars of the first UUID uppercased
    expect(guest.displayName).toMatch(/^Invité-[A-F0-9]{4}$/);
  });

  it('uses the provided displayName when given', () => {
    const guest = useCase.execute({ displayName: 'Anonyme' });

    expect(guest.displayName).toBe('Anonyme');
  });

  it('generates a valid ISO datetime for createdAt', () => {
    const before = new Date().toISOString();
    const guest = useCase.execute();
    const after = new Date().toISOString();

    // createdAt doit être un ISO datetime valide entre before et after
    expect(guest.createdAt).toBeTruthy();
    expect(new Date(guest.createdAt).toISOString()).toBe(guest.createdAt);
    expect(guest.createdAt >= before).toBe(true);
    expect(guest.createdAt <= after).toBe(true);
  });

  it('sets type to "guest"', () => {
    const guest = useCase.execute();

    expect(guest.type).toBe('guest');
  });

  it('produces a user that passes GuestUserSchema Zod validation', () => {
    const guest = useCase.execute({ displayName: 'TestUser' });
    const result = GuestUserSchema.safeParse(guest);

    expect(result.success).toBe(true);
  });

  it('produces a user with default name that passes GuestUserSchema Zod validation', () => {
    const guest = useCase.execute();
    const result = GuestUserSchema.safeParse(guest);

    expect(result.success).toBe(true);
  });
});
