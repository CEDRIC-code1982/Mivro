/**
 * @file RealtimeConsentModal.tsx
 * @description RealtimeConsentModal molecule — explicit & SEPARATE GDPR consent
 *              for real-time location sharing (F4).
 *
 *              ⚠️ GDPR (CLAUDE.md): this consent is separate from GPS consent.
 *              Until granted, the user's position is NOT published (they can
 *              still view others). The choice is NOT persisted (GDPR — per
 *              session).
 *
 *              start() resets the realtime store (consent included) and
 *              useRealtimeTracking drops any consent granted without active
 *              tracking: consent is granted AFTER start(), never before.
 *
 * @example
 *   <RealtimeConsentModal
 *     visible={isConsentVisible}
 *     onAccept={() => { start(sessionId, participantId); setSharingConsent(true); }}
 *     onDecline={() => { setSharingConsent(false); start(sessionId, participantId); }}
 *   />
 *
 * @module components/molecules/RealtimeConsentModal/RealtimeConsentModal
 */

// [ADDED] F4 — RealtimeConsentModal molecule (separate GDPR consent)
import { useTheme, type Theme } from '@theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@components/atoms';

/**
 * RealtimeConsentModal component props.
 *
 * @param visible - Modal visibility
 * @param onAccept - Consent granted callback
 * @param onDecline - Consent declined callback
 * @param testID - Test ID
 */
export interface RealtimeConsentModalProps {
  /** Modal visibility */
  readonly visible: boolean;
  /** Consent granted callback (sharing allowed) */
  readonly onAccept: () => void;
  /** Consent declined callback (view only) */
  readonly onDecline: () => void;
  /** Test ID */
  readonly testID?: string;
}

/**
 * GDPR real-time location sharing consent molecule.
 *
 * @param props - {@link RealtimeConsentModalProps}
 * @returns RealtimeConsentModal component
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
