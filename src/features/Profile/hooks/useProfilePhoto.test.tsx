/**
 * @file useProfilePhoto.test.tsx
 * @description Tests unitaires du hook useProfilePhoto (F7 passe 2).
 *              Unit tests for the useProfilePhoto hook (F7 pass 2).
 *
 * @module __tests__/unit/presentation/hooks/useProfilePhoto
 */

// [ADDED] F7 passe 2 — Tests unitaires useProfilePhoto
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { User } from '@entities/User';
import { useProfilePhoto } from '@features/Profile/hooks/useProfilePhoto';
import { ProfilePhotoError } from '@services/domain/user/IProfilePhotoService';

// ─── Mock DI container ──────────────────────────────────────
const mockPickFromLibrary = jest.fn();
const mockPickFromCamera = jest.fn();
const mockDeletePhoto = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    profilePhotoService: {
      pickFromLibrary: mockPickFromLibrary,
      pickFromCamera: mockPickFromCamera,
      deletePhoto: mockDeletePhoto,
    },
  })),
}));

// ─── Mock auth ──────────────────────────────────────────────
const mockUpdateProfile = jest.fn();
let mockUser: User | null = null;

jest.mock('@features/Profile/hooks/useAuth', () => ({
  useAuthUser: () => mockUser,
  useAuthActions: () => ({ updateProfile: mockUpdateProfile }),
}));

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2026-01-15T10:30:00.000Z';

const makeUser = (photoUri?: string): User => ({
  type: 'guest',
  id: VALID_UUID,
  displayName: 'Léa',
  createdAt: VALID_DATETIME,
  ...(photoUri !== undefined ? { photoUri } : {}),
});

describe('useProfilePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockUser = makeUser();
    mockDeletePhoto.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── État initial ─────────────────────────────────────────
  it('exposes the current photoUri from the user (null when none)', () => {
    mockUser = makeUser();
    const { result } = renderHook(() => useProfilePhoto());

    expect(result.current.photoUri).toBeNull();
    expect(result.current.isBusy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes the user photoUri when present', () => {
    mockUser = makeUser('/old.jpg');
    const { result } = renderHook(() => useProfilePhoto());

    expect(result.current.photoUri).toBe('/old.jpg');
  });

  // ─── pickPhoto — succès ───────────────────────────────────
  describe('pickPhoto', () => {
    it('persists the picked photo (library) via updateProfile', async () => {
      mockPickFromLibrary.mockResolvedValueOnce({ uri: '/new.jpg' });
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      expect(mockPickFromLibrary).toHaveBeenCalled();
      expect(mockUpdateProfile).toHaveBeenCalledWith({ photoUri: '/new.jpg' });
      expect(result.current.isBusy).toBe(false);
    });

    it('uses the camera service when source is camera', async () => {
      mockPickFromCamera.mockResolvedValueOnce({ uri: '/cam.jpg' });
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('camera');
      });

      expect(mockPickFromCamera).toHaveBeenCalled();
      expect(mockUpdateProfile).toHaveBeenCalledWith({ photoUri: '/cam.jpg' });
    });

    it('cleans up the previous file when replacing the photo', async () => {
      mockUser = makeUser('/old.jpg');
      mockPickFromLibrary.mockResolvedValueOnce({ uri: '/new.jpg' });
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({ photoUri: '/new.jpg' });
      expect(mockDeletePhoto).toHaveBeenCalledWith('/old.jpg');
    });

    it('does not delete when the new uri equals the previous one', async () => {
      mockUser = makeUser('/same.jpg');
      mockPickFromLibrary.mockResolvedValueOnce({ uri: '/same.jpg' });
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      expect(mockDeletePhoto).not.toHaveBeenCalled();
    });

    // ─── pickPhoto — annulation ─────────────────────────────
    it('is a no-op on cancellation (null result): no update, no error', async () => {
      mockUser = makeUser('/old.jpg');
      mockPickFromLibrary.mockResolvedValueOnce(null);
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockDeletePhoto).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    // ─── pickPhoto — erreur ─────────────────────────────────
    it('sets error by code when the service throws a ProfilePhotoError', async () => {
      mockPickFromLibrary.mockRejectedValueOnce(
        new ProfilePhotoError('denied', 'permission_denied'),
      );
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      expect(result.current.error).toBe('permission_denied');
      expect(result.current.isBusy).toBe(false);
    });

    it('sets error "unknown" for a non-ProfilePhotoError', async () => {
      mockPickFromLibrary.mockRejectedValueOnce(new Error('boom'));
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      expect(result.current.error).toBe('unknown');
    });

    it('clears a previous error on a new pick attempt', async () => {
      mockPickFromLibrary
        .mockRejectedValueOnce(new ProfilePhotoError('x', 'camera_unavailable'))
        .mockResolvedValueOnce({ uri: '/ok.jpg' });
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });
      expect(result.current.error).toBe('camera_unavailable');

      await act(async () => {
        await result.current.pickPhoto('library');
      });
      expect(result.current.error).toBeNull();
    });

    it('toggles isBusy during the pick operation', async () => {
      let resolvePick: ((v: { uri: string }) => void) | undefined;
      mockPickFromLibrary.mockImplementationOnce(
        () =>
          new Promise<{ uri: string }>((resolve) => {
            resolvePick = resolve;
          }),
      );
      const { result } = renderHook(() => useProfilePhoto());

      let promise: Promise<void>;
      act(() => {
        promise = result.current.pickPhoto('library');
      });
      expect(result.current.isBusy).toBe(true);

      await act(async () => {
        resolvePick?.({ uri: '/x.jpg' });
        await promise;
      });
      expect(result.current.isBusy).toBe(false);
    });

    it('is a no-op when there is no user', async () => {
      mockUser = null;
      mockPickFromLibrary.mockResolvedValueOnce({ uri: '/x.jpg' });
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.pickPhoto('library');
      });

      // Le service est appelé mais le persist se fait sur updateProfile (mocké)
      expect(mockUpdateProfile).toHaveBeenCalledWith({ photoUri: '/x.jpg' });
    });
  });

  // ─── removePhoto ──────────────────────────────────────────
  describe('removePhoto', () => {
    it('clears the photo in the profile and deletes the local file', async () => {
      mockUser = makeUser('/old.jpg');
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.removePhoto();
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({ photoUri: null });
      expect(mockDeletePhoto).toHaveBeenCalledWith('/old.jpg');
    });

    it('is a no-op when there is no current photo', async () => {
      mockUser = makeUser();
      const { result } = renderHook(() => useProfilePhoto());

      await act(async () => {
        await result.current.removePhoto();
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockDeletePhoto).not.toHaveBeenCalled();
    });
  });

  // ─── Concurrence (déjà busy) ──────────────────────────────
  describe('busy guard', () => {
    it('ignores a second pick while one is in progress', async () => {
      let resolvePick: ((v: { uri: string }) => void) | undefined;
      mockPickFromLibrary.mockImplementationOnce(
        () =>
          new Promise<{ uri: string }>((resolve) => {
            resolvePick = resolve;
          }),
      );
      const { result } = renderHook(() => useProfilePhoto());

      let first: Promise<void>;
      act(() => {
        first = result.current.pickPhoto('library');
      });
      expect(result.current.isBusy).toBe(true);

      // Deuxième appel pendant que busy → ignoré
      await act(async () => {
        await result.current.pickPhoto('camera');
      });
      expect(mockPickFromCamera).not.toHaveBeenCalled();

      await act(async () => {
        resolvePick?.({ uri: '/x.jpg' });
        await first;
      });
    });
  });

  // ─── clearError ───────────────────────────────────────────
  it('clearError resets the error state', async () => {
    mockPickFromLibrary.mockRejectedValueOnce(new ProfilePhotoError('x', 'unknown'));
    const { result } = renderHook(() => useProfilePhoto());

    await act(async () => {
      await result.current.pickPhoto('library');
    });
    expect(result.current.error).toBe('unknown');

    act(() => {
      result.current.clearError();
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });
});
