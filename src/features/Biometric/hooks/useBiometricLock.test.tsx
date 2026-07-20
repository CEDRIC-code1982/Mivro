/**
 * @file useBiometricLock.test.tsx
 * @description Tests unitaires du hook useBiometricLock (F8).
 *              Unit tests for the useBiometricLock hook (F8).
 *
 *              Couvre : isLocked au lancement selon biometricEnabled, unlock
 *              (succès / échec / annulation), compteur consecutiveFailures (reset
 *              au succès / (re)verrouillage, cancelled n'incrémente PAS),
 *              showDisableEscape (codes inutilisables OU >= 3 échecs),
 *              disableLockAndContinue (best-effort, jamais bloquant),
 *              re-lock sur inactive/background (PAS → active — garde anti-boucle),
 *              auto-désactivation au montage (enabled + supportedType null),
 *              enableLock avec rollback, disableLock, garde anti-concurrence,
 *              détection du type supporté, sélecteurs stables.
 *
 * @module __tests__/unit/presentation/hooks/useBiometricLock
 */

// [ADDED] F8 — Tests unitaires useBiometricLock
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useBiometricLock } from '@features/Biometric/hooks/useBiometricLock';
import { BiometricError } from '@services/domain/biometric/IBiometricService';

// ─── Helpers AppState (exposés par jest.setup.js) ───────────
declare const __emitAppState: (next: string) => void;
declare const __resetAppState: () => void;

// ─── Mock DI container ──────────────────────────────────────
const mockGetSupportedType = jest.fn();
const mockIsEnrolled = jest.fn();
const mockAuthenticate = jest.fn();
const mockEnableLock = jest.fn();
const mockDisableLock = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    biometricService: {
      getSupportedType: mockGetSupportedType,
      isEnrolled: mockIsEnrolled,
      authenticate: mockAuthenticate,
      enableLock: mockEnableLock,
      disableLock: mockDisableLock,
    },
  })),
}));

// ─── Mock usePreferencesStore (sélecteurs + state pilotable) ─
let mockBiometricEnabled = false;
const mockSetBiometricEnabled = jest.fn((next: boolean) => {
  mockBiometricEnabled = next;
});

jest.mock('@state/usePreferencesStore', () => {
  const usePreferencesStore = (
    selector: (s: {
      biometricEnabled: boolean;
      setBiometricEnabled: (n: boolean) => void;
    }) => unknown,
  ) =>
    selector({
      biometricEnabled: mockBiometricEnabled,
      setBiometricEnabled: mockSetBiometricEnabled,
    });
  return { usePreferencesStore };
});

describe('useBiometricLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    mockBiometricEnabled = false;
    mockGetSupportedType.mockResolvedValue('face');
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue(true);
    mockEnableLock.mockResolvedValue(undefined);
    mockDisableLock.mockResolvedValue(undefined);
    __resetAppState();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── isLocked au lancement ────────────────────────────────
  describe('isLocked at launch', () => {
    it('is unlocked when biometricEnabled is false', async () => {
      mockBiometricEnabled = false;
      const { result } = renderHook(() => useBiometricLock());
      expect(result.current.isLocked).toBe(false);
      // Laisse l'effet de détection (async) se résoudre dans act.
      await act(async () => {
        await Promise.resolve();
      });
    });

    it('is locked at launch when biometricEnabled is true', async () => {
      mockBiometricEnabled = true;
      const { result } = renderHook(() => useBiometricLock());
      expect(result.current.isLocked).toBe(true);
      await act(async () => {
        await Promise.resolve();
      });
    });
  });

  // ─── Détection du type supporté ───────────────────────────
  describe('supported type detection', () => {
    it('exposes the detected biometric type after mount', async () => {
      mockGetSupportedType.mockResolvedValueOnce('fingerprint');
      const { result } = renderHook(() => useBiometricLock());

      await waitFor(() => {
        expect(result.current.supportedType).toBe('fingerprint');
      });
    });

    it('falls back to null when detection rejects', async () => {
      mockGetSupportedType.mockRejectedValueOnce(new Error('boom'));
      const { result } = renderHook(() => useBiometricLock());

      await waitFor(() => {
        expect(mockGetSupportedType).toHaveBeenCalled();
      });
      expect(result.current.supportedType).toBeNull();
    });
  });

  // ─── unlock ───────────────────────────────────────────────
  describe('unlock', () => {
    it('unlocks the app on a successful authentication', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useBiometricLock());
      expect(result.current.isLocked).toBe(true);

      await act(async () => {
        await result.current.unlock('Unlock Mivro');
      });

      expect(mockAuthenticate).toHaveBeenCalledWith('Unlock Mivro');
      expect(result.current.isLocked).toBe(false);
      expect(result.current.unlockError).toBeNull();
    });

    it('stays locked and sets unlockError "failed" when auth returns false', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(false);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.isLocked).toBe(true);
      expect(result.current.unlockError).toBe('failed');
    });

    it('stays locked and exposes the typed code when auth throws (cancelled)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValueOnce(new BiometricError('cancel', 'cancelled'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.isLocked).toBe(true);
      expect(result.current.unlockError).toBe('cancelled');
    });

    it('maps a non-BiometricError throw to "unknown"', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValueOnce(new Error('boom'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.unlockError).toBe('unknown');
    });
  });

  // ─── Garde anti-concurrence ───────────────────────────────
  describe('anti-concurrency guard', () => {
    it('ignores a second unlock while a prompt is already in flight', async () => {
      mockBiometricEnabled = true;
      let resolveAuth: ((v: boolean) => void) | undefined;
      mockAuthenticate.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveAuth = resolve;
          }),
      );
      const { result } = renderHook(() => useBiometricLock());

      let first: Promise<void>;
      act(() => {
        first = result.current.unlock('Unlock');
      });

      // Second appel pendant que le premier prompt est en cours → ignoré.
      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveAuth?.(true);
        await first;
      });
      expect(result.current.isLocked).toBe(false);
    });
  });

  // ─── re-lock background → active (AppState) ───────────────
  describe('re-lock on background → active', () => {
    it('re-locks when returning to active from background (enabled)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useBiometricLock());

      // On déverrouille d'abord.
      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.isLocked).toBe(false);

      // background → active doit re-verrouiller.
      act(() => {
        __emitAppState('background');
        __emitAppState('active');
      });

      expect(result.current.isLocked).toBe(true);
      expect(result.current.unlockError).toBeNull();
    });

    it('re-locks when returning to active from inactive', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      act(() => {
        __emitAppState('inactive');
        __emitAppState('active');
      });

      expect(result.current.isLocked).toBe(true);
    });

    it('does NOT re-lock when the lock is disabled', async () => {
      mockBiometricEnabled = false;
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        __emitAppState('background');
        __emitAppState('active');
      });

      expect(result.current.isLocked).toBe(false);
    });
  });

  // ─── Régression : pas de boucle de re-verrouillage due au prompt ─
  describe('no re-lock loop from its own native prompt (regression F8)', () => {
    it('stays unlocked after unlock despite the prompt-induced inactive→active cycle', async () => {
      mockBiometricEnabled = true;
      // Le prompt Face ID/Touch ID fait passer l'app en 'inactive' PENDANT l'auth
      // (iOS) puis réussit. Cette transition doit être ignorée (isAuthenticatingRef).
      mockAuthenticate.mockImplementationOnce(async () => {
        __emitAppState('inactive');
        return true;
      });
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      // Fermeture du prompt → retour 'active'.
      act(() => {
        __emitAppState('active');
      });

      // Avant le fix : 'active' (prev 'inactive') re-verrouillait juste après le
      // succès → l'overlay se remontait → auto-prompt → boucle infinie.
      // Après : transition pendant l'auth ignorée + aucun re-lock sur → active.
      expect(result.current.isLocked).toBe(false);
    });

    it('does not re-lock merely on returning to active (no → active re-lock)', async () => {
      mockBiometricEnabled = true;
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.isLocked).toBe(false);

      act(() => {
        __emitAppState('active');
      });
      expect(result.current.isLocked).toBe(false);
    });
  });

  // ─── enableLock (avec rollback) ───────────────────────────
  describe('enableLock', () => {
    it('returns not_enrolled and never sets the flag when not enrolled', async () => {
      mockIsEnrolled.mockResolvedValueOnce(false);
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.enableLock('Confirm');
      });

      expect(outcome).toEqual({ success: false, errorCode: 'not_enrolled' });
      expect(mockEnableLock).not.toHaveBeenCalled();
      expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
    });

    it('stores the sentinel + sets the flag on a successful confirmation', async () => {
      mockIsEnrolled.mockResolvedValueOnce(true);
      mockAuthenticate.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.enableLock('Confirm');
      });

      expect(mockEnableLock).toHaveBeenCalled();
      expect(mockAuthenticate).toHaveBeenCalledWith('Confirm');
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true);
      expect(outcome).toEqual({ success: true, errorCode: null });
    });

    it('rolls back the sentinel and does not set the flag when confirmation fails', async () => {
      mockIsEnrolled.mockResolvedValueOnce(true);
      mockAuthenticate.mockResolvedValueOnce(false);
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.enableLock('Confirm');
      });

      expect(mockEnableLock).toHaveBeenCalled();
      // Rollback : sentinelle retirée, flag non posé.
      expect(mockDisableLock).toHaveBeenCalled();
      expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
      expect(outcome).toEqual({ success: false, errorCode: 'failed' });
    });

    it('rolls back and exposes the typed code when enableLock throws', async () => {
      mockIsEnrolled.mockResolvedValueOnce(true);
      mockEnableLock.mockRejectedValueOnce(new BiometricError('x', 'not_available'));
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.enableLock('Confirm');
      });

      expect(mockDisableLock).toHaveBeenCalled();
      expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
      expect(outcome).toEqual({ success: false, errorCode: 'not_available' });
    });

    it('does not crash if the rollback disableLock itself throws', async () => {
      mockIsEnrolled.mockResolvedValueOnce(true);
      mockAuthenticate.mockRejectedValueOnce(new BiometricError('x', 'failed'));
      mockDisableLock.mockRejectedValueOnce(new Error('reset failed'));
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.enableLock('Confirm');
      });

      expect(outcome).toEqual({ success: false, errorCode: 'failed' });
    });
  });

  // ─── disableLock ──────────────────────────────────────────
  describe('disableLock', () => {
    it('removes the sentinel and clears the flag', async () => {
      mockBiometricEnabled = true;
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.disableLock();
      });

      expect(mockDisableLock).toHaveBeenCalled();
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
      expect(outcome).toEqual({ success: true, errorCode: null });
    });

    it('returns a typed failure when disableLock throws (defensive)', async () => {
      mockDisableLock.mockRejectedValueOnce(new BiometricError('x', 'unknown'));
      const { result } = renderHook(() => useBiometricLock());

      let outcome;
      await act(async () => {
        outcome = await result.current.disableLock();
      });

      expect(outcome).toEqual({ success: false, errorCode: 'unknown' });
      expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
    });
  });

  // ─── Compteur d'échecs consécutifs ────────────────────────
  describe('consecutiveFailures counter', () => {
    it('starts at 0', async () => {
      mockBiometricEnabled = true;
      const { result } = renderHook(() => useBiometricLock());

      expect(result.current.consecutiveFailures).toBe(0);
      await act(async () => {
        await Promise.resolve();
      });
    });

    it('increments on a failed unlock (auth returns false)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValue(false);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.consecutiveFailures).toBe(1);

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.consecutiveFailures).toBe(2);
    });

    it('increments on a thrown "failed" error', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValue(new BiometricError('x', 'failed'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.consecutiveFailures).toBe(1);
    });

    it('does NOT increment on a cancelled attempt', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValue(new BiometricError('cancel', 'cancelled'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.consecutiveFailures).toBe(0);
      expect(result.current.unlockError).toBe('cancelled');
    });

    it('resets to 0 after a successful unlock', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.consecutiveFailures).toBe(2);

      mockAuthenticate.mockResolvedValueOnce(true);
      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.consecutiveFailures).toBe(0);
      expect(result.current.isLocked).toBe(false);
    });

    it('resets to 0 on a re-lock (background → active)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValue(false);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.consecutiveFailures).toBe(2);

      act(() => {
        __emitAppState('background');
        __emitAppState('active');
      });

      expect(result.current.consecutiveFailures).toBe(0);
    });
  });

  // ─── showDisableEscape ────────────────────────────────────
  describe('showDisableEscape', () => {
    it('is false initially (no error, no failures)', async () => {
      mockBiometricEnabled = true;
      const { result } = renderHook(() => useBiometricLock());

      expect(result.current.showDisableEscape).toBe(false);
      await act(async () => {
        await Promise.resolve();
      });
    });

    it('becomes true when unlockError is not_enrolled (unusable)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValueOnce(new BiometricError('x', 'not_enrolled'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.showDisableEscape).toBe(true);
    });

    it('becomes true when unlockError is not_available (unusable)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValueOnce(new BiometricError('x', 'not_available'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.showDisableEscape).toBe(true);
    });

    it('stays false on a single "failed" attempt (below threshold)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValueOnce(new BiometricError('x', 'failed'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });

      expect(result.current.showDisableEscape).toBe(false);
    });

    it('becomes true after 3 consecutive failures (threshold reached)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValue(false);
      const { result } = renderHook(() => useBiometricLock());

      for (let i = 0; i < 3; i += 1) {
        await act(async () => {
          await result.current.unlock('Unlock');
        });
      }

      expect(result.current.consecutiveFailures).toBe(3);
      expect(result.current.showDisableEscape).toBe(true);
    });

    it('does NOT become true from repeated cancellations (not accumulated)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValue(new BiometricError('cancel', 'cancelled'));
      const { result } = renderHook(() => useBiometricLock());

      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await result.current.unlock('Unlock');
        });
      }

      expect(result.current.consecutiveFailures).toBe(0);
      expect(result.current.showDisableEscape).toBe(false);
    });
  });

  // ─── disableLockAndContinue (échappatoire, jamais bloquant) ─
  describe('disableLockAndContinue', () => {
    it('removes the sentinel, clears the flag and unlocks', async () => {
      mockBiometricEnabled = true;
      const { result } = renderHook(() => useBiometricLock());
      expect(result.current.isLocked).toBe(true);

      await act(async () => {
        await result.current.disableLockAndContinue();
      });

      expect(mockDisableLock).toHaveBeenCalled();
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
      expect(result.current.isLocked).toBe(false);
      expect(result.current.unlockError).toBeNull();
      expect(result.current.consecutiveFailures).toBe(0);
    });

    it('unlocks even if the keychain removal throws (best-effort, never blocking)', async () => {
      mockBiometricEnabled = true;
      mockDisableLock.mockRejectedValueOnce(new Error('reset failed'));
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.disableLockAndContinue();
      });

      // Le retrait échoue mais on déverrouille quand même.
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
      expect(result.current.isLocked).toBe(false);
    });

    it('resets the failure counter and error when recovering from a lockout', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockRejectedValue(new BiometricError('x', 'failed'));
      const { result } = renderHook(() => useBiometricLock());

      for (let i = 0; i < 3; i += 1) {
        await act(async () => {
          await result.current.unlock('Unlock');
        });
      }
      expect(result.current.showDisableEscape).toBe(true);

      await act(async () => {
        await result.current.disableLockAndContinue();
      });

      expect(result.current.consecutiveFailures).toBe(0);
      expect(result.current.unlockError).toBeNull();
      expect(result.current.showDisableEscape).toBe(false);
    });
  });

  // ─── Auto-désactivation au montage (anti-lockout) ─────────
  describe('auto-disable on mount when biometrics became unusable', () => {
    it('auto-disables when enabled but supportedType resolves to null', async () => {
      mockBiometricEnabled = true;
      // null de façon stable (le flag passe à false → l'effet peut se ré-exécuter).
      mockGetSupportedType.mockResolvedValue(null);
      const { result } = renderHook(() => useBiometricLock());

      await waitFor(() => {
        expect(mockDisableLock).toHaveBeenCalled();
      });
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
      expect(result.current.isLocked).toBe(false);
      expect(result.current.supportedType).toBeNull();
    });

    it('does NOT auto-disable when a supported type is detected', async () => {
      mockBiometricEnabled = true;
      mockGetSupportedType.mockResolvedValueOnce('face');
      const { result } = renderHook(() => useBiometricLock());

      await waitFor(() => {
        expect(result.current.supportedType).toBe('face');
      });
      expect(mockDisableLock).not.toHaveBeenCalled();
      expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
      // Reste verrouillé : la biométrie est utilisable.
      expect(result.current.isLocked).toBe(true);
    });

    it('does NOT auto-disable when the lock is not enabled (even if type is null)', async () => {
      mockBiometricEnabled = false;
      mockGetSupportedType.mockResolvedValueOnce(null);
      const { result } = renderHook(() => useBiometricLock());

      await waitFor(() => {
        expect(result.current.supportedType).toBeNull();
      });
      expect(mockDisableLock).not.toHaveBeenCalled();
      expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
    });

    it('still unlocks even if the cleanup disableLock throws during auto-disable', async () => {
      mockBiometricEnabled = true;
      mockGetSupportedType.mockResolvedValueOnce(null);
      mockDisableLock.mockRejectedValueOnce(new Error('cleanup boom'));
      const { result } = renderHook(() => useBiometricLock());

      await waitFor(() => {
        expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
      });
      expect(result.current.isLocked).toBe(false);
    });
  });

  // ─── re-lock sur inactive / background (avant snapshot OS) ─
  describe('re-lock when leaving the foreground', () => {
    it('re-locks on inactive (masks the app-switcher snapshot)', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.isLocked).toBe(false);

      act(() => {
        __emitAppState('inactive');
      });

      expect(result.current.isLocked).toBe(true);
    });

    it('re-locks on background', async () => {
      mockBiometricEnabled = true;
      mockAuthenticate.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await result.current.unlock('Unlock');
      });
      expect(result.current.isLocked).toBe(false);

      act(() => {
        __emitAppState('background');
      });

      expect(result.current.isLocked).toBe(true);
    });

    it('does NOT re-lock on inactive/background when the lock is disabled', async () => {
      mockBiometricEnabled = false;
      const { result } = renderHook(() => useBiometricLock());

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        __emitAppState('inactive');
      });

      expect(result.current.isLocked).toBe(false);
    });
  });

  // ─── Stabilité des callbacks (sélecteurs stables) ─────────
  describe('stable callbacks', () => {
    it('keeps unlock / enableLock / disableLock referentially stable across renders', async () => {
      const { result, rerender } = renderHook(() => useBiometricLock());
      const first = {
        unlock: result.current.unlock,
        enableLock: result.current.enableLock,
        disableLock: result.current.disableLock,
        disableLockAndContinue: result.current.disableLockAndContinue,
      };

      rerender({});

      expect(result.current.unlock).toBe(first.unlock);
      expect(result.current.enableLock).toBe(first.enableLock);
      expect(result.current.disableLock).toBe(first.disableLock);
      expect(result.current.disableLockAndContinue).toBe(first.disableLockAndContinue);
      // Laisse l'effet de détection (async) se résoudre dans act.
      await act(async () => {
        await Promise.resolve();
      });
    });
  });
});
