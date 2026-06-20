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
const mockSetUser = jest.fn(); // [ADDED]

jest.mock('@/di/container', () => {
  const { CreateGuestUserUseCase } = require('@core/usecases/CreateGuestUserUseCase');
  const { UpdateProfileUseCase } = require('@core/usecases/UpdateProfileUseCase'); // [ADDED] F7
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
      updateProfileUseCase: new UpdateProfileUseCase(), // [ADDED] F7
      // [ADDED] Mock crashReporter pour les tests auth → Sentry
      crashReporter: {
        setUser: mockSetUser,
        captureException: jest.fn(),
        captureMessage: jest.fn(),
        setTag: jest.fn(),
        addBreadcrumb: jest.fn(),
        init: jest.fn(),
        flush: jest.fn().mockResolvedValue(true),
      },
    }),
  };
});

import { UserSchema } from '@core/entities/User'; // [ADDED] F7
import { useAuthStore } from '@presentation/stores/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockSetUser.mockClear(); // [ADDED]
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

    // [ADDED] Test liaison auth → crashReporter
    it('sets crashReporter user on signInAsGuest', () => {
      useAuthStore.getState().signInAsGuest('Test');

      expect(mockSetUser).toHaveBeenCalledWith({
        id: mockUuid,
        type: 'guest',
      });
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

    // [ADDED] Test liaison auth → crashReporter
    it('clears crashReporter user on signOut', () => {
      useAuthStore.getState().signInAsGuest('Test');
      mockSetUser.mockClear();

      useAuthStore.getState().signOut();

      expect(mockSetUser).toHaveBeenCalledWith(null);
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

  // ─── updateProfile (F7) ───────────────────────────────────
  describe('updateProfile', () => {
    it('updates displayName of the current user and persists it', () => {
      useAuthStore.getState().signInAsGuest('Ancien');

      useAuthStore.getState().updateProfile({ displayName: 'Récent' });

      expect(useAuthStore.getState().user?.displayName).toBe('Récent');
      // Persistance : l'adapter MMKV mocké doit contenir le nouveau nom
      expect(mockStorage.get('auth')).toContain('Récent');
    });

    it('updates the avatarId of the current user and persists it', () => {
      useAuthStore.getState().signInAsGuest('Léa');

      useAuthStore.getState().updateProfile({ avatarId: 'panda' });

      expect(useAuthStore.getState().user?.avatarId).toBe('panda');
      expect(mockStorage.get('auth')).toContain('panda');
    });

    it('updates both name and avatar at once', () => {
      useAuthStore.getState().signInAsGuest('Léa');

      useAuthStore.getState().updateProfile({ displayName: 'Max', avatarId: 'fox' });

      const user = useAuthStore.getState().user;
      expect(user?.displayName).toBe('Max');
      expect(user?.avatarId).toBe('fox');
    });

    it('does nothing if no user is signed in (no-op)', () => {
      useAuthStore.getState().updateProfile({ displayName: 'Ghost', avatarId: 'cat' });

      expect(useAuthStore.getState().user).toBeNull();
    });

    it('throws (ZodError) on an invalid patch and leaves the user unchanged', () => {
      useAuthStore.getState().signInAsGuest('Stable');

      expect(() => useAuthStore.getState().updateProfile({ displayName: '' })).toThrow();
      expect(useAuthStore.getState().user?.displayName).toBe('Stable');
    });

    it('persists a user carrying an avatarId in a Zod-valid, rehydratable shape', () => {
      // Simule un user déjà persisté avec avatarId.
      useAuthStore.getState().signInAsGuest('Léa');
      useAuthStore.getState().updateProfile({ avatarId: 'owl' });

      // Le blob persisté contient bien l'avatarId.
      const raw = mockStorage.get('auth');
      expect(raw).toBeDefined();
      const persisted = JSON.parse(raw ?? '{}') as {
        state: { user: unknown };
      };

      // Le user persisté repasse la validation Zod faite à la rehydratation
      // (onRehydrateStorage) → il ne sera pas effacé au prochain démarrage.
      const result = UserSchema.safeParse(persisted.state.user);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.avatarId).toBe('owl');
      }
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
