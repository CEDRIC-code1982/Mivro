/**
 * @file useCreateSessionFlow.test.tsx
 * @description Tests unitaires du hook useCreateSessionFlow.
 *              Unit tests for the useCreateSessionFlow hook.
 *
 * @module __tests__/unit/presentation/hooks/useCreateSessionFlow
 */

// [ADDED] Tests unitaires useCreateSessionFlow

import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import type { Location } from '@core/entities/Location';
import type { User } from '@core/entities/User';
import { GeolocationError } from '@core/ports/IGeolocationService';
import { useCreateSessionFlow } from '@presentation/hooks/useCreateSessionFlow';
import { useSessionStore } from '@presentation/stores/useSessionStore';

// ─── Mock uuid ──────────────────────────────────────────────
let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: () => {
    mockUuidCounter++;
    return `test-uuid-${String(mockUuidCounter).padStart(4, '0')}`;
  },
}));

// ─── Mock auth (F7 passe 2 — avatarId du user courant) ──────
let mockUser: User | null = null;

jest.mock('@presentation/hooks/useAuth', () => ({
  useAuthUser: () => mockUser,
}));

// ─── Mock DI container ──────────────────────────────────────
const mockGetCurrentLocationExecute = jest.fn();

jest.mock('@/di/container', () => ({
  getContainer: jest.fn(() => ({
    getCurrentLocationUseCase: { execute: mockGetCurrentLocationExecute },
  })),
}));

// ─── Helpers ────────────────────────────────────────────────

const fakeLocation: Location = {
  id: 'loc-001',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
  formattedAddress: '1 Rue de Rivoli, Paris, France',
};

// [FIXED P1] Le use case renvoie désormais { location, addressResolved }
const fakeGpsResult = { location: fakeLocation, addressResolved: true };

const fakeGeocodeResult: GeocodeResult = {
  externalId: 'osm-12345',
  coordinates: { latitude: 48.8584, longitude: 2.2945 },
  displayName: 'Tour Eiffel, Paris, France',
  placeType: 'attraction',
  importance: 0.85,
};

const resetStores = (): void => {
  useSessionStore.setState({ session: null });
};

// ─── Tests ──────────────────────────────────────────────────

describe('useCreateSessionFlow', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    jest.clearAllMocks();
    resetStores();
    mockUser = null;
  });

  // ─── Initialisation ─────────────────────────────────────
  describe('initialization', () => {
    it('creates a session automatically when none exists', () => {
      renderHook(() => useCreateSessionFlow());

      const session = useSessionStore.getState().session;
      expect(session).not.toBeNull();
      expect(session?.status).toBe('draft');
    });

    it('does not create a new session if one already exists', () => {
      useSessionStore.getState().createSession();
      const sessionId = useSessionStore.getState().session?.id;

      renderHook(() => useCreateSessionFlow());

      expect(useSessionStore.getState().session?.id).toBe(sessionId);
    });

    it('starts with 0 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      expect(result.current.participantsCount).toBe(0);
      expect(result.current.participants).toEqual([]);
    });
  });

  // ─── addByGeocode ───────────────────────────────────────
  describe('addByGeocode', () => {
    it('adds a participant with auto-generated name when none provided', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult);
      });

      expect(result.current.participantsCount).toBe(1);
      expect(result.current.participants[0]?.displayName).toBe('Participant 1');
      expect(result.current.participants[0]?.startLocation.formattedAddress).toBe(
        'Tour Eiffel, Paris, France',
      );
    });

    it('uses provided displayName when given', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Cédric');
      });

      expect(result.current.participants[0]?.displayName).toBe('Cédric');
    });

    it('trims whitespace from displayName', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, '  Sophie  ');
      });

      expect(result.current.participants[0]?.displayName).toBe('Sophie');
    });

    it('falls back to auto-name when displayName is empty after trim', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, '   ');
      });

      expect(result.current.participants[0]?.displayName).toBe('Participant 1');
    });

    it('does not add when session is full (5 participants)', () => {
      const { result } = renderHook(() => useCreateSessionFlow());
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Ajouter 5 participants
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addByGeocode(fakeGeocodeResult, `P${String(i + 1)}`);
        }
      });

      expect(result.current.participantsCount).toBe(5);
      expect(result.current.isFull).toBe(true);

      // Le 6ème est refusé
      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'P6');
      });

      expect(result.current.participantsCount).toBe(5);
      warnSpy.mockRestore();
    });

    it('stores correct coordinates from geocode result', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult);
      });

      const location = result.current.participants[0]?.startLocation;
      expect(location?.coordinates).toEqual({
        latitude: 48.8584,
        longitude: 2.2945,
      });
    });
  });

  // ─── addByGps ─────────────────────────────────────────────
  describe('addByGps', () => {
    it('calls getCurrentLocationUseCase and adds participant', async () => {
      mockGetCurrentLocationExecute.mockResolvedValueOnce(fakeGpsResult);
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(mockGetCurrentLocationExecute).toHaveBeenCalledWith({
        language: 'fr',
      });
      expect(result.current.participantsCount).toBe(1);
      expect(result.current.participants[0]?.startLocation.formattedAddress).toBe(
        '1 Rue de Rivoli, Paris, France',
      );
    });

    it('uses provided displayName', async () => {
      mockGetCurrentLocationExecute.mockResolvedValueOnce(fakeGpsResult);
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps('Cédric');
      });

      expect(result.current.participants[0]?.displayName).toBe('Cédric');
    });

    // [FIXED P1] Adresse non résolue (hors ligne) → notice non-bloquante, point ajouté
    it('sets a non-blocking notice when the address could not be resolved', async () => {
      mockGetCurrentLocationExecute.mockResolvedValueOnce({
        location: fakeLocation,
        addressResolved: false,
      });
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.participantsCount).toBe(1);
      expect(result.current.gpsNotice).toEqual({ code: 'gps_address_unresolved' });
      expect(result.current.gpsError).toBeNull();
    });

    it('leaves notice null when the address is resolved', async () => {
      mockGetCurrentLocationExecute.mockResolvedValueOnce(fakeGpsResult);
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsNotice).toBeNull();
    });

    it('sets isAddingByGps during GPS call', async () => {
      let resolveGps: ((value: typeof fakeGpsResult) => void) | undefined;
      mockGetCurrentLocationExecute.mockImplementation(
        () =>
          new Promise<typeof fakeGpsResult>((resolve) => {
            resolveGps = resolve;
          }),
      );

      const { result } = renderHook(() => useCreateSessionFlow());

      // Lancer l'ajout GPS (sans await)
      let gpsPromise: Promise<void>;
      act(() => {
        gpsPromise = result.current.addByGps();
      });

      // isAddingByGps devrait être true pendant l'appel
      expect(result.current.isAddingByGps).toBe(true);

      // Résoudre le GPS
      await act(async () => {
        resolveGps?.(fakeGpsResult);
        await gpsPromise;
      });

      expect(result.current.isAddingByGps).toBe(false);
    });

    it('handles permission_denied error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('Permission denied', 'permission_denied'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({ code: 'gps_permission_denied' });
      expect(result.current.participantsCount).toBe(0);
      expect(result.current.isAddingByGps).toBe(false);
      errorSpy.mockRestore();
    });

    it('handles permission_blocked error as permission_denied', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('Permission blocked', 'permission_blocked'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({ code: 'gps_permission_denied' });
      errorSpy.mockRestore();
    });

    it('handles timeout error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('Timeout', 'timeout'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({ code: 'gps_timeout' });
      errorSpy.mockRestore();
    });

    it('handles unavailable error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('Unavailable', 'unavailable'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({ code: 'gps_unavailable' });
      errorSpy.mockRestore();
    });

    it('handles inaccurate error', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('Inaccurate', 'inaccurate'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({ code: 'gps_inaccurate' });
      errorSpy.mockRestore();
    });

    it('handles non-GeolocationError as unknown', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(new Error('Something went wrong'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({
        code: 'unknown',
        message: 'Something went wrong',
      });
      errorSpy.mockRestore();
    });

    it('clears gpsError on next successful addByGps', async () => {
      mockGetCurrentLocationExecute
        .mockRejectedValueOnce(new GeolocationError('Timeout', 'timeout'))
        .mockResolvedValueOnce(fakeGpsResult);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      // Première tentative : erreur
      await act(async () => {
        await result.current.addByGps();
      });
      expect(result.current.gpsError).not.toBeNull();

      // Deuxième tentative : succès
      await act(async () => {
        await result.current.addByGps();
      });
      expect(result.current.gpsError).toBeNull();
      errorSpy.mockRestore();
    });

    // ─── F7 passe 2 — avatarId du user courant porté sur le participant GPS ──
    it('carries the current user avatarId onto the GPS participant', async () => {
      mockUser = {
        type: 'guest',
        id: '550e8400-e29b-41d4-a716-446655440000',
        displayName: 'Léa',
        avatarId: 'fox',
        createdAt: '2026-01-15T10:30:00.000Z',
      };
      mockGetCurrentLocationExecute.mockResolvedValueOnce(fakeGpsResult);
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.participants[0]?.avatarId).toBe('fox');
    });

    it('does not set an avatarId when the current user has none', async () => {
      mockUser = {
        type: 'guest',
        id: '550e8400-e29b-41d4-a716-446655440000',
        displayName: 'Léa',
        createdAt: '2026-01-15T10:30:00.000Z',
      };
      mockGetCurrentLocationExecute.mockResolvedValueOnce(fakeGpsResult);
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.participants[0]?.avatarId).toBeUndefined();
    });

    it('does not set an avatarId when no user is signed in', async () => {
      mockUser = null;
      mockGetCurrentLocationExecute.mockResolvedValueOnce(fakeGpsResult);
      const { result } = renderHook(() => useCreateSessionFlow());

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.participants[0]?.avatarId).toBeUndefined();
    });

    it('sets session_full error when session is full', async () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      // Remplir la session
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addByGeocode(fakeGeocodeResult, `P${String(i + 1)}`);
        }
      });

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).toEqual({ code: 'session_full' });
      expect(mockGetCurrentLocationExecute).not.toHaveBeenCalled();
    });
  });

  // ─── removeParticipant ──────────────────────────────────
  describe('removeParticipant', () => {
    it('removes the correct participant', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
        result.current.addByGeocode(fakeGeocodeResult, 'Bob');
      });

      const aliceId = result.current.participants[0]?.id ?? '';

      act(() => {
        result.current.removeParticipant(aliceId);
      });

      expect(result.current.participantsCount).toBe(1);
      expect(result.current.participants[0]?.displayName).toBe('Bob');
    });
  });

  // ─── canContinue ────────────────────────────────────────
  describe('canContinue', () => {
    it('is false with 0 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());
      expect(result.current.canContinue).toBe(false);
    });

    it('is false with 1 participant', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
      });

      expect(result.current.canContinue).toBe(false);
    });

    it('is true with 2 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
        result.current.addByGeocode(fakeGeocodeResult, 'Bob');
      });

      expect(result.current.canContinue).toBe(true);
    });

    it('is true with 5 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addByGeocode(fakeGeocodeResult, `P${String(i + 1)}`);
        }
      });

      expect(result.current.canContinue).toBe(true);
    });
  });

  // ─── isFull ─────────────────────────────────────────────
  describe('isFull', () => {
    it('is false with less than 5 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
      });

      expect(result.current.isFull).toBe(false);
    });

    it('is true at 5 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addByGeocode(fakeGeocodeResult, `P${String(i + 1)}`);
        }
      });

      expect(result.current.isFull).toBe(true);
    });
  });

  // ─── remainingMin ───────────────────────────────────────
  describe('remainingMin', () => {
    it('is 2 with 0 participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());
      expect(result.current.remainingMin).toBe(2);
    });

    it('is 1 with 1 participant', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
      });

      expect(result.current.remainingMin).toBe(1);
    });

    it('is 0 with 2 or more participants', () => {
      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
        result.current.addByGeocode(fakeGeocodeResult, 'Bob');
      });

      expect(result.current.remainingMin).toBe(0);
    });
  });

  // ─── reset ──────────────────────────────────────────────
  describe('reset', () => {
    it('resets session and clears gpsError', async () => {
      mockGetCurrentLocationExecute.mockRejectedValueOnce(
        new GeolocationError('Timeout', 'timeout'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useCreateSessionFlow());

      act(() => {
        result.current.addByGeocode(fakeGeocodeResult, 'Alice');
      });

      await act(async () => {
        await result.current.addByGps();
      });

      expect(result.current.gpsError).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      // After reset, a new session is created by the useEffect
      await waitFor(() => {
        expect(result.current.participantsCount).toBe(0);
      });
      expect(result.current.gpsError).toBeNull();
      errorSpy.mockRestore();
    });
  });
});
