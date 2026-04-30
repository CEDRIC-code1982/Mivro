/**
 * @file useAuthStore.test.ts
 * @description Tests unitaires du store useAuthStore.
 *              Unit tests for the useAuthStore.
 *
 * @module __tests__/unit/presentation/stores/useAuthStore
 */

// [ADDED] Tests unitaires useAuthStore

// Mock uuid pour des résultats déterministes
const mockUuid = '550e8400-e29b-41d4-a716-446655440000';

jest.mock('uuid', () => ({
  v4: () => mockUuid,
}));

// Mock DI container avec storage in-memory + CreateGuestUserUseCase réel
const mockStorage = new Map<string, string>();

jest.mock('@/di/container', () => {
  const { CreateGuestUserUseCase } = require('@core/usecases/CreateGuestUserUseCase');
  return {
    getContainer: () => ({
      zustandStorage: {
        getItem: (key: string) => mockStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          mockStorage.set(key, value);
        },
        removeItem: (key: string) => {
          mockStorage.delete(key);
        },
      },
      createGuestUserUseCase: new CreateGuestUserUseCase(),
    }),
  };
});

import { useAuthStore } from '@presentation/stores/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    // Reset store to initial state between tests
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  // ─── Initial state ────────────────────────────────────────
  describe('initial state', () => {
    it('has user set to null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('has isAuthenticated set to false', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─── signInAsGuest ────────────────────────────────────────
  describe('signInAsGuest', () => {
    it('creates a GuestUser and sets isAuthenticated to true', () => {
      useAuthStore.getState().signInAsGuest();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user?.type).toBe('guest');
    });

    it('creates a guest with the provided displayName', () => {
      useAuthStore.getState().signInAsGuest('Mon Nom');

      expect(useAuthStore.getState().user?.displayName).toBe('Mon Nom');
    });

    it('creates a guest with a generated displayName when none provided', () => {
      useAuthStore.getState().signInAsGuest();

      // Avec le mock uuid, le fallback est "Invité-" + 4 premiers chars du UUID
      expect(useAuthStore.getState().user?.displayName).toMatch(/^Invité-[A-F0-9]{4}$/);
    });
  });

  // ─── signOut ──────────────────────────────────────────────
  describe('signOut', () => {
    it('resets to initial state', () => {
      // Sign in first
      useAuthStore.getState().signInAsGuest('Test');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Sign out
      useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // ─── updateDisplayName ────────────────────────────────────
  describe('updateDisplayName', () => {
    it('updates the display name of the current user', () => {
      useAuthStore.getState().signInAsGuest('Ancien Nom');

      useAuthStore.getState().updateDisplayName('Nouveau Nom');

      expect(useAuthStore.getState().user?.displayName).toBe('Nouveau Nom');
    });

    it('does nothing if no user is signed in', () => {
      useAuthStore.getState().updateDisplayName('Ghost');

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ─── signInWithGoogle / signInWithApple (no-op MVP) ───────
  describe('signInWithGoogle', () => {
    it('throws "not implemented" error', async () => {
      await expect(useAuthStore.getState().signInWithGoogle()).rejects.toThrow(
        'Google Sign-In not implemented yet',
      );
    });
  });

  describe('signInWithApple', () => {
    it('throws "not implemented" error', async () => {
      await expect(useAuthStore.getState().signInWithApple()).rejects.toThrow(
        'Apple Sign-In not implemented yet',
      );
    });
  });
});
