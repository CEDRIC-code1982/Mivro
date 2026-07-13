/**
 * @file RealtimeConsentModal.tsx
 * @description Molecule RealtimeConsentModal — consentement RGPD explicite et
 *              SÉPARÉ au partage de position temps réel (F4).
 *              RealtimeConsentModal molecule — explicit & SEPARATE GDPR consent
 *              for real-time location sharing (F4).
 *
 *              ⚠️ RGPD (CLAUDE.md) : ce consentement est distinct du
 *              consentement GPS. Tant qu'il n'est pas accordé, la position de
 *              l'utilisateur N'EST PAS publiée (il peut quand même voir les
 *              autres). Le choix n'est PAS persisté (RGPD — par session).
 *
 *              ⚠️ GDPR: this consent is separate from GPS consent. Until
 *              granted, the user's position is NOT published (they can still
 *              view others). The choice is NOT persisted (per session).
 *
 * @example
 *   <RealtimeConsentModal
 *     visible={isConsentVisible}
 *     onAccept={() => { setSharingConsent(true); start(); }}
 *     onDecline={() => setSharingConsent(false)}
 *   />
 *
 * @module presentation/components/molecules/RealtimeConsentModal
 */

// [ADDED] F4 — Molecule RealtimeConsentModal (consentement RGPD séparé)
import { useTheme, type Theme } from '@theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@components/atoms';

/**
 * Props du composant RealtimeConsentModal.
 * RealtimeConsentModal component props.
 *
 * @param visible - Visibilité de la modal / Modal visibility
 * @param onAccept - Callback consentement accordé / Consent granted callback
 * @param onDecline - Callback consentement refusé / Consent declined callback
 * @param testID - ID de test / Test ID
 */
export interface RealtimeConsentModalProps {
  /** Visibilité de la modal / Modal visibility */
  readonly visible: boolean;
  /** Callback consentement accordé (partage autorisé) / Consent granted callback */
  readonly onAccept: () => void;
  /** Callback consentement refusé (voir seulement) / Consent declined callback */
  readonly onDecline: () => void;
  /** ID de test / Test ID */
  readonly testID?: string;
}

/**
 * Molecule de consentement RGPD au partage de position temps réel.
 * GDPR real-time location sharing consent molecule.
 *
 * @param props - {@link RealtimeConsentModalProps}
 * @returns Composant RealtimeConsentModal / RealtimeConsentModal component
 */
const RealtimeConsentModal: React.FC<RealtimeConsentModalProps> = ({
  visible,
  onAccept,
  onDecline,
  testID,
}) => {
  const { t } = useTranslation('realtime');
  const theme = useTheme();
  const styles = buildStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View
          style={styles.card}
          accessibilityViewIsModal
          accessibilityLabel={t('consent.title')}
          testID={testID ? `${testID}-card` : undefined}
        >
          <Text variant="h3" weight="bold">
            {t('consent.title')}
          </Text>

          <Text variant="body" weight="semibold">
            {t('consent.question')}
          </Text>

          <Text variant="small" color="secondary">
            {t('consent.description')}
          </Text>

          <Text variant="caption" color="tertiary">
            {t('consent.note')}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('consent.accept')}
              accessibilityHint={t('consent.question')}
              testID={testID ? `${testID}-accept` : undefined}
            >
              <Text variant="body" weight="semibold" color="onBrand">
                {t('consent.accept')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onDecline}
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('consent.decline')}
              testID={testID ? `${testID}-decline` : undefined}
            >
              <Text variant="body" weight="semibold" color="brand">
                {t('consent.decline')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.surface.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    card: {
      width: '100%',
      backgroundColor: theme.color.surface.primary,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      ...theme.elevation.xl,
    },
    actions: {
      flexDirection: 'column',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    button: {
      alignSelf: 'stretch',
      minHeight: theme.touchTarget.min,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.color.interactive.brand.default,
    },
    primaryButtonPressed: {
      backgroundColor: theme.color.interactive.brand.pressed,
    },
    secondaryButton: {
      backgroundColor: theme.color.surface.secondary,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.color.interactive.neutral.pressed,
    },
  });

export default RealtimeConsentModal;
