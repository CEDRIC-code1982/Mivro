/**
 * @file useBiometricLock.ts
 * @description Hook d'orchestration du verrou biométrique (F8).
 *              Biometric lock orchestration hook (F8).
 *
 *              Responsabilités / Responsibilities:
 *              - Détecte le type de biométrie supporté (via IBiometricService, DI).
 *              - Gère l'état verrouillé/déverrouillé au lancement et au retour
 *                d'arrière-plan (AppState background → active).
 *              - Expose `unlock()` qui déclenche le prompt natif et lève/garde
 *                le verrou selon le résultat (succès / échec / annulation).
 *              - Fournit `enableLock()` / `disableLock()` pour le toggle Profile :
 *                vérifie la disponibilité + authentifie AVANT de poser le flag.
 *
 *              L'écran et App.tsx passent par ce hook, jamais par keychain.
 *              The screen and App.tsx go through this hook, never through keychain.
 *
 * @module presentation/hooks/useBiometricLock
 */

// [ADDED] F8 — Hook useBiometricLock
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  BiometricError,
  type BiometricErrorCode,
  type BiometricType,
} from '@services/domain/biometric/IBiometricService';
import { getContainer } from '@services/serviceContainer';
import { usePreferencesStore } from '@state/usePreferencesStore';

/**
 * Résultat de l'orchestration d'activation/désactivation du verrou.
 * Result of the lock enable/disable orchestration.
 */
export interface ToggleLockResult {
  /** true si l'opération a réussi / true if the operation succeeded */
  success: boolean;
  /** Code d'erreur si échec, sinon null / Error code if failed, otherwise null */
  errorCode: BiometricErrorCode | null;
}

/**
 * Résultat du hook useBiometricLock.
 * useBiometricLock hook result.
 */
export interface UseBiometricLockResult {
  /** true si l'app est verrouillée (auth requise) / true if the app is locked */
  isLocked: boolean;
  /** Type de biométrie supporté ou null / Supported biometry type or null */
  supportedType: BiometricType | null;
  /** true si le flag verrou est activé / true if the lock flag is enabled */
  biometricEnabled: boolean;
  /** Code d'erreur de la dernière tentative de déverrouillage / Last unlock attempt error code */
  unlockError: BiometricErrorCode | null;
  /** Nombre d'échecs de déverrouillage consécutifs / Consecutive unlock failures count */
  consecutiveFailures: number;
  /**
   * true si une échappatoire applicative doit être proposée (biométrie
   * inutilisable ou trop d'échecs) → bouton « Désactiver le verrou et continuer ».
   * true if an applicative escape hatch must be offered (biometrics unusable
   * or too many failures) → "Disable lock and continue" button.
   */
  showDisableEscape: boolean;
  /** Déclenche le prompt natif pour déverrouiller / Triggers the native prompt to unlock */
  unlock: (reason: string) => Promise<void>;
  /** Active le verrou (vérifie dispo + auth de confirmation) / Enables the lock (checks availability + confirmation auth) */
  enableLock: (reason: string) => Promise<ToggleLockResult>;
  /** Désactive le verrou (retire la sentinelle) / Disables the lock (removes the sentinel) */
  disableLock: () => Promise<ToggleLockResult>;
  /**
   * Échappatoire : désactive le verrou (retire sentinelle + flag) PUIS
   * déverrouille — pour sortir d'un lockout permanent.
   * Escape hatch: disables the lock (removes sentinel + flag) THEN unlocks —
   * to recover from a permanent lockout.
   */
  disableLockAndContinue: () => Promise<void>;
}

/**
 * Seuil d'échecs consécutifs au-delà duquel l'échappatoire applicative
 * « Désactiver le verrou et continuer » est proposée.
 * Consecutive-failures threshold beyond which the "Disable lock and continue"
 * escape hatch is offered.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Codes d'erreur indiquant une biométrie durablement inutilisable : on propose
 * (ou applique) immédiatement l'échappatoire sans attendre N échecs.
 * Error codes meaning biometrics are durably unusable: the escape hatch is
 * offered (or applied) immediately without waiting for N failures.
 */
const UNUSABLE_CODES: ReadonlySet<BiometricErrorCode> = new Set<BiometricErrorCode>([
  'not_enrolled',
  'not_available',
]);

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Extrait un code d'erreur biométrique typé d'une erreur quelconque.
 * Extracts a typed biometric error code from any error.
 *
 * @param err - Erreur capturée / Caught error
 * @returns Code typé / Typed code
 */
const toErrorCode = (err: unknown): BiometricErrorCode =>
  err instanceof BiometricError ? err.code : 'unknown';

/**
 * Hook d'orchestration du verrou biométrique.
 * Biometric lock orchestration hook.
 *
 * @returns Résultat du hook / Hook result
 */
export const useBiometricLock = (): UseBiometricLockResult => {
  // Sélecteurs Zustand stables (1 primitive par sélecteur — évite le bug v5).
  const biometricEnabled = usePreferencesStore((s) => s.biometricEnabled);
  const setBiometricEnabled = usePreferencesStore((s) => s.setBiometricEnabled);

  // Verrouillé au lancement si le flag est actif (résolu après le 1er effet).
  // Locked at launch if the flag is active (resolved after the first effect).
  const [isLocked, setIsLocked] = useState<boolean>(biometricEnabled);
  const [supportedType, setSupportedType] = useState<BiometricType | null>(null);
  const [unlockError, setUnlockError] = useState<BiometricErrorCode | null>(null);
  // Compteur d'échecs consécutifs (remis à 0 au succès / nouveau verrouillage).
  // Consecutive failure counter (reset to 0 on success / new lock).
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);

  // Garde anti-concurrence : un seul prompt natif à la fois.
  // Anti-concurrency guard: a single native prompt at a time.
  const isAuthenticatingRef = useRef<boolean>(false);

  // Détecte le type supporté au montage (introspection, aucun prompt).
  // Si le verrou est actif mais que la biométrie n'est plus enrôlée/dispo, on
  // AUTO-DÉSACTIVE le verrou plutôt que de rester bloqué à vie (anti-lockout).
  // Detects the supported type on mount (introspection, no prompt). If the lock
  // is enabled but biometrics are no longer enrolled/available, AUTO-DISABLE the
  // lock instead of staying locked forever (anti-lockout).
  useEffect(() => {
    let cancelled = false;
    const detect = async (): Promise<void> => {
      const { biometricService } = getContainer();
      let type: BiometricType | null = null;
      try {
        type = await biometricService.getSupportedType();
      } catch {
        type = null;
      }
      if (cancelled) return;
      setSupportedType(type);

      // Évaluation anti-lockout : verrou actif + aucune biométrie utilisable.
      // Anti-lockout evaluation: lock enabled + no usable biometrics.
      if (biometricEnabled && type === null) {
        try {
          await biometricService.disableLock();
        } catch {
          /* cleanup best-effort */
        }
        if (cancelled) return;
        setBiometricEnabled(false);
        setIsLocked(false);
        setUnlockError(null);
        console.warn(
          `[WARN][useBiometricLock][detect][?][${timestamp()}] ` +
            'Biometrics unusable at evaluation — auto-disabled lock (anti-lockout)',
        );
      }
    };
    // getSupportedType ne rejette pas (catché en interne) ; fire-and-forget sûr.
    detect().catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // biometricEnabled/setBiometricEnabled stables (Zustand) — exécution au montage.
  }, [biometricEnabled, setBiometricEnabled]);

  // Si le flag est désactivé (ex : depuis Profile), on déverrouille de fait.
  // If the flag gets disabled (e.g. from Profile), effectively unlock.
  useEffect(() => {
    if (!biometricEnabled) {
      setIsLocked(false);
      setUnlockError(null);
    }
  }, [biometricEnabled]);

  /**
   * Déclenche le prompt natif pour déverrouiller l'app.
   * Triggers the native prompt to unlock the app.
   *
   * @param reason - Raison affichée dans le prompt / Reason shown in the prompt
   */
  const authenticate = useCallback(async (reason: string): Promise<boolean> => {
    if (isAuthenticatingRef.current) return false;
    isAuthenticatingRef.current = true;
    try {
      return await getContainer().biometricService.authenticate(reason);
    } finally {
      isAuthenticatingRef.current = false;
    }
  }, []);

  const unlock = useCallback(
    async (reason: string): Promise<void> => {
      setUnlockError(null);
      try {
        // La raison (i18n) est fournie par l'écran de verrouillage au moment du
        // tap. The (i18n) reason is supplied by the lock screen on tap.
        const ok = await authenticate(reason);
        if (ok) {
          setIsLocked(false);
          setConsecutiveFailures(0);
          console.log(
            `[INFO][useBiometricLock][unlock][?][${timestamp()}] App unlocked via biometrics`,
          );
        } else {
          setUnlockError('failed');
          setConsecutiveFailures((n) => n + 1);
        }
      } catch (err: unknown) {
        const code = toErrorCode(err);
        setUnlockError(code);
        // L'annulation utilisateur n'est pas un échec « subi » : ne pas
        // l'accumuler vers l'échappatoire (sinon une annulation répétée la
        // déclencherait alors que la biométrie marche).
        // User cancellation is not a "suffered" failure: don't accumulate it
        // toward the escape hatch.
        if (code !== 'cancelled') {
          setConsecutiveFailures((n) => n + 1);
        }
        console.warn(
          `[WARN][useBiometricLock][unlock][?][${timestamp()}] Unlock attempt failed | code: ${code}`,
        );
      }
    },
    [authenticate],
  );

  /**
   * Active le verrou : vérifie la disponibilité, authentifie en confirmation,
   * pose la sentinelle puis le flag persisté.
   * Enables the lock: checks availability, authenticates as confirmation,
   * stores the sentinel then the persisted flag.
   */
  const enableLock = useCallback(
    async (reason: string): Promise<ToggleLockResult> => {
      try {
        const { biometricService } = getContainer();
        const enrolled = await biometricService.isEnrolled();
        if (!enrolled) {
          return { success: false, errorCode: 'not_enrolled' };
        }

        // Pose la sentinelle protégée biométrie, PUIS authentifie pour confirmer
        // que l'utilisateur peut bien la relire (déclenche le prompt natif).
        // Store the biometry-protected sentinel, THEN authenticate to confirm
        // the user can read it back (triggers the native prompt).
        await biometricService.enableLock();
        const ok = await biometricService.authenticate(reason);
        if (!ok) {
          // Confirmation échouée : on retire la sentinelle (best-effort) et on
          // ne pose pas le flag.
          // Confirmation failed: remove the sentinel (best-effort), don't set the flag.
          await biometricService.disableLock();
          return { success: false, errorCode: 'failed' };
        }

        setBiometricEnabled(true);
        setIsLocked(false);
        console.log(
          `[INFO][useBiometricLock][enableLock][?][${timestamp()}] Biometric lock enabled`,
        );
        return { success: true, errorCode: null };
      } catch (err: unknown) {
        const code = toErrorCode(err);
        // Rollback best-effort de la sentinelle en cas d'échec après pose.
        // Best-effort sentinel rollback if it failed after storing.
        try {
          await getContainer().biometricService.disableLock();
        } catch {
          /* ignore */
        }
        console.warn(
          `[WARN][useBiometricLock][enableLock][?][${timestamp()}] Enable failed | code: ${code}`,
        );
        return { success: false, errorCode: code };
      }
    },
    [setBiometricEnabled],
  );

  /**
   * Désactive le verrou : retire la sentinelle puis le flag persisté.
   * Disables the lock: removes the sentinel then the persisted flag.
   */
  const disableLock = useCallback(async (): Promise<ToggleLockResult> => {
    try {
      await getContainer().biometricService.disableLock();
      setBiometricEnabled(false);
      setIsLocked(false);
      console.log(
        `[INFO][useBiometricLock][disableLock][?][${timestamp()}] Biometric lock disabled`,
      );
      return { success: true, errorCode: null };
    } catch (err: unknown) {
      const code = toErrorCode(err);
      // disableLock de l'adapter ne throw pas ; ce catch est défensif.
      // The adapter's disableLock does not throw; this catch is defensive.
      console.warn(
        `[WARN][useBiometricLock][disableLock][?][${timestamp()}] Disable failed | code: ${code}`,
      );
      return { success: false, errorCode: code };
    }
  }, [setBiometricEnabled]);

  /**
   * Échappatoire applicative : retire la sentinelle + le flag persisté PUIS
   * déverrouille, pour sortir d'un lockout permanent (biométrie inutilisable
   * ou trop d'échecs). Best-effort sur le retrait keychain — on déverrouille
   * de toute façon pour ne pas enfermer l'utilisateur.
   * Applicative escape hatch: removes the sentinel + persisted flag THEN unlocks,
   * to recover from a permanent lockout (unusable biometrics or too many
   * failures). Best-effort on keychain removal — we unlock regardless so the
   * user is never trapped.
   */
  const disableLockAndContinue = useCallback(async (): Promise<void> => {
    try {
      await getContainer().biometricService.disableLock();
    } catch {
      /* cleanup best-effort — on déverrouille quand même */
    }
    setBiometricEnabled(false);
    setIsLocked(false);
    setUnlockError(null);
    setConsecutiveFailures(0);
    console.warn(
      `[WARN][useBiometricLock][disableLockAndContinue][?][${timestamp()}] ` +
        'Lock disabled via escape hatch — app unlocked',
    );
  }, [setBiometricEnabled]);

  // Re-verrouillage AVANT le snapshot OS (inactive/background) ET au retour
  // (→ active). Couvrir inactive/background masque le contenu dans la vignette
  // du multitâche et évite le flash au retour ; → active garde l'exigence d'auth.
  // Re-lock BEFORE the OS snapshot (inactive/background) AND on return (→ active).
  // Covering inactive/background masks content in the app-switcher thumbnail and
  // avoids the flash on return; → active keeps the auth requirement.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      if (!biometricEnabled) return;

      // Masquer dès qu'on quitte le premier plan (avant le snapshot OS).
      // Mask as soon as we leave the foreground (before the OS snapshot).
      if (nextState === 'inactive' || nextState === 'background') {
        setIsLocked(true);
        return;
      }

      // Retour au premier plan depuis l'arrière-plan : on garde le verrou et on
      // remet à zéro l'erreur pour une nouvelle tentative propre.
      // Returning to foreground from background: keep the lock and clear the
      // error for a fresh attempt.
      if (nextState === 'active' && (previous === 'background' || previous === 'inactive')) {
        setIsLocked(true);
        setUnlockError(null);
        setConsecutiveFailures(0);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [biometricEnabled]);

  // Échappatoire proposée si biométrie durablement inutilisable OU trop d'échecs.
  // Escape hatch offered if biometrics durably unusable OR too many failures.
  const showDisableEscape =
    (unlockError != null && UNUSABLE_CODES.has(unlockError)) ||
    consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

  return {
    isLocked: biometricEnabled && isLocked,
    supportedType,
    biometricEnabled,
    unlockError,
    consecutiveFailures,
    showDisableEscape,
    unlock,
    enableLock,
    disableLock,
    disableLockAndContinue,
  };
};
