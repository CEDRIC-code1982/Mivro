/**
 * @file BiometricLockScreen.tsx
 * @description Molecule BiometricLockScreen — écran de verrouillage biométrique
 *              plein écran et bloquant (F8).
 *              BiometricLockScreen molecule — full-screen blocking biometric
 *              lock screen (F8).
 *
 *              Affiché par App.tsx (sous les providers) tant que l'app est
 *              verrouillée. Bloque toute interaction avec l'app sous-jacente.
 *              Bouton « Déverrouiller » qui relance le prompt natif ; affiche
 *              un message localisé en cas d'échec / annulation (reste verrouillé).
 *              Tente un prompt automatique au montage / à chaque verrouillage.
 *
 *              Shown by App.tsx (under the providers) while the app is locked.
 *              Blocks all interaction with the underlying app. "Unlock" button
 *              re-triggers the native prompt; shows a localized message on
 *              failure / cancellation (stays locked). Attempts an automatic
 *              prompt on mount / on each lock.
 *
 * @module presentation/components/molecules/BiometricLockScreen
 */

// [ADDED] F8 — Molecule BiometricLockScreen (overlay bloquant)
import { useTheme, type Theme } from '@theme';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@components/atoms';
import type {
  BiometricErrorCode,
  BiometricType,
} from '@services/domain/biometric/IBiometricService';

/**
 * Props du composant BiometricLockScreen.
 * BiometricLockScreen component props.
 */
export interface BiometricLockScreenProps {
  /** Type de biométrie supporté (libellé du bouton) ou null / Supported biometry type or null */
  readonly supportedType: BiometricType | null;
  /** Code d'erreur de la dernière tentative, ou null / Last attempt error code, or null */
  readonly errorCode: BiometricErrorCode | null;
  /**
   * true si l'échappatoire « Désactiver le verrou et continuer » doit être
   * affichée (biométrie inutilisable ou trop d'échecs).
   * true if the "Disable lock and continue" escape hatch must be shown
   * (biometrics unusable or too many failures).
   */
  readonly showDisableEscape?: boolean;
  /** Déclenche le prompt natif (reçoit la raison i18n) / Triggers the native prompt (receives the i18n reason) */
  readonly onUnlock: (reason: string) => void;
  /**
   * Échappatoire : désactive le verrou et déverrouille / Escape hatch: disables
   * the lock and unlocks.
   */
  readonly onDisableAndContinue?: () => void;
  /** ID de test / Test ID */
  readonly testID?: string;
}

/**
 * Écran de verrouillage biométrique bloquant.
 * Blocking biometric lock screen.
 *
 * @param props - {@link BiometricLockScreenProps}
 * @returns Composant BiometricLockScreen / BiometricLockScreen component
 */
const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({
  supportedType,
  errorCode,
  showDisableEscape = false,
  onUnlock,
  onDisableAndContinue,
  testID,
}) => {
  const { t } = useTranslation('biometric');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // Libellé localisé du type biométrique (Face ID / Touch ID / …) pour la raison.
  // Localized biometric type label (Face ID / Touch ID / …) for the reason.
  const typeLabel = t(`settings.types.${supportedType ?? 'generic'}`);
  const reason = t('lock.reason', { type: typeLabel });

  // Tente un prompt automatique une seule fois, DIFFÉRÉ jusqu'à ce que le type
  // supporté soit résolu (supportedType !== null) afin que le prompt natif
  // affiche le bon libellé (Face ID / Touch ID) plutôt que le générique « la
  // biométrie ». Si aucun type ne se résout (biométrie indisponible), la couche
  // hook auto-désactive le verrou — pas d'auto-prompt à tirer ici.
  // Attempts an automatic prompt once, DEFERRED until the supported type is
  // resolved (supportedType !== null) so the native prompt shows the right label
  // (Face ID / Touch ID) instead of the generic "biometrics". If no type resolves
  // (biometrics unavailable), the hook layer auto-disables the lock — no auto-
  // prompt to fire here.
  const hasAutoPromptedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hasAutoPromptedRef.current && supportedType !== null) {
      hasAutoPromptedRef.current = true;
      onUnlock(reason);
    }
  }, [onUnlock, reason, supportedType]);

  const handleUnlock = useCallback((): void => {
    onUnlock(reason);
  }, [onUnlock, reason]);

  const handleDisableAndContinue = useCallback((): void => {
    onDisableAndContinue?.();
  }, [onDisableAndContinue]);

  // Libellé du bouton : « Déverrouiller » (générique, indépendant du type).
  // Après une erreur, on propose « Réessayer ».
  const buttonLabel = errorCode != null ? t('lock.retry') : t('lock.unlock');
  const errorMessage = errorCode != null ? t(`lock.errors.${errorCode}`) : null;

  return (
    <View
      style={styles.backdrop}
      accessibilityViewIsModal
      accessibilityLabel={t('lock.title')}
      testID={testID}
    >
      <View style={styles.content}>
        <Text variant="h2" weight="bold" align="center" accessibilityRole="header">
          {t('lock.title')}
        </Text>
        <Text variant="body" color="secondary" align="center">
          {t('lock.subtitle')}
        </Text>

        {errorMessage != null ? (
          <Text
            variant="small"
            color="error"
            align="center"
            accessibilityLiveRegion="polite"
            testID={testID ? `${testID}-error` : undefined}
          >
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={handleUnlock}
          style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : undefined]}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          accessibilityHint={t('lock.unlockHint')}
          testID={testID ? `${testID}-unlock` : undefined}
        >
          <Text variant="body" weight="semibold" color="onBrand">
            {buttonLabel}
          </Text>
        </Pressable>

        {/* Échappatoire anti-lockout : biométrie inutilisable ou trop d'échecs.
            Anti-lockout escape hatch: unusable biometrics or too many failures. */}
        {showDisableEscape ? (
          <Pressable
            onPress={handleDisableAndContinue}
            style={({ pressed }) => [
              styles.escapeButton,
              pressed ? styles.escapeButtonPressed : undefined,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('lock.disableAndContinue')}
            accessibilityHint={t('lock.disableAndContinueHint')}
            testID={testID ? `${testID}-disable-escape` : undefined}
          >
            <Text variant="body" weight="semibold" color="brand">
              {t('lock.disableAndContinue')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      // [DS] Plein écran opaque — bloque l'app sous-jacente.
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.color.surface.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
      zIndex: theme.zIndex.modal,
    },
    content: {
      width: '100%',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    button: {
      alignSelf: 'stretch',
      minHeight: theme.touchTarget.min,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.interactive.brand.default,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPressed: {
      backgroundColor: theme.color.interactive.brand.pressed,
    },
    // Bouton secondaire (échappatoire) — outline, distinct du primaire.
    // Secondary button (escape hatch) — outline, distinct from the primary.
    escapeButton: {
      alignSelf: 'stretch',
      minHeight: theme.touchTarget.min,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.color.border.strong,
      backgroundColor: theme.color.surface.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    escapeButtonPressed: {
      backgroundColor: theme.color.surface.secondary,
    },
  });

export default BiometricLockScreen;
