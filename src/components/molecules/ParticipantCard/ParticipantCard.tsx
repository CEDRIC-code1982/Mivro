/**
 * @file ParticipantCard.tsx
 * @description ParticipantCard molecule — displays a participant with avatar,
 *              name, address and optional remove button.
 *
 * @example
 * ```tsx
 * <ParticipantCard
 *   participant={participant}
 *   onRemove={() => removeParticipant(participant.id)}
 *   accessibilityHint={t('list.participantHint')}
 *   removeAccessibilityLabel={t('list.removeParticipant', { name: participant.displayName })}
 *   removeAccessibilityHint={t('list.removeParticipantHint')}
 * />
 * ```
 *
 * @module components/molecules/ParticipantCard/ParticipantCard
 */

// [ADDED] ParticipantCard molecule

import { useTheme, type Theme } from '@theme';
import { X } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Avatar from '@components/atoms/Avatar'; // [ADDED] F7
import Text from '@components/atoms/Text';
import type { Participant } from '@entities/MidpointSession';

/**
 * ParticipantCard component props.
 *
 * @param participant - Participant data
 * @param onRemove - Remove callback (if provided, × button visible)
 * @param accessibilityLabelOverride - a11y label override
 * @param accessibilityHint - Translated a11y hint of the card (A11Y-003)
 * @param removeAccessibilityLabel - Translated a11y label of the × button (falls back to the name)
 * @param removeAccessibilityHint - Translated a11y hint of the × button (A11Y-003)
 * @param testID - Test ID
 */
export interface ParticipantCardProps {
  /** Participant data */
  participant: Participant;
  /** Remove callback (if provided, × button visible) */
  onRemove?: () => void;
  /** a11y label override */
  accessibilityLabelOverride?: string;
  /** Translated a11y hint of the card (A11Y-003) */
  accessibilityHint?: string;
  /** Translated a11y label of the × button; falls back to the participant name */
  removeAccessibilityLabel?: string;
  /** Translated a11y hint of the × button (A11Y-003) */
  removeAccessibilityHint?: string;
  /** Test ID */
  testID?: string;
}

/**
 * Mivro Design System ParticipantCard molecule.
 *
 * Horizontal layout: [Avatar] [Name + Address] [optional ×]
 *
 * @param props - {@link ParticipantCardProps}
 * @returns ParticipantCard component
 */
const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  onRemove,
  accessibilityLabelOverride,
  accessibilityHint,
  removeAccessibilityLabel,
  removeAccessibilityHint,
  testID,
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme);

  const { displayName, startLocation, avatarId } = participant; // [MODIFIED] F7 — avatarId
  const address = startLocation.formattedAddress;

  const cardLabel = accessibilityLabelOverride ?? `${displayName}, ${address}`;

  return (
    <View
      style={styles.container}
      accessibilityLabel={cardLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="none"
      testID={testID}
    >
      {/* [MODIFIED] F7 — Chosen emoji avatar (initial fallback via the Avatar atom) */}
      <Avatar
        avatarId={avatarId}
        fallbackName={displayName}
        size={AVATAR_SIZE}
        testID={testID ? `${testID}-avatar` : undefined}
      />

      {/* [ADDED] Name + address */}
      <View style={styles.textContainer}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={2}>
          {address}
        </Text>
      </View>

      {/* [ADDED] × remove button (if onRemove provided) */}
      {onRemove != null && (
        <Pressable
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed ? styles.removeButtonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={removeAccessibilityLabel ?? displayName}
          accessibilityHint={removeAccessibilityHint}
          hitSlop={styles.hitSlop}
          testID={testID ? `${testID}-remove` : undefined}
        >
          <X size={theme.typography.fontSize.body} color={theme.color.text.error} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const AVATAR_SIZE = 40;

// [ADDED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.md,
      backgroundColor: theme.color.surface.secondary,
      borderRadius: theme.radius.md,
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    removeButton: {
      width: theme.touchTarget.min,
      height: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.sm,
    },
    removeButtonPressed: {
      backgroundColor: theme.color.feedback.errorBg,
    },
    // [ADDED] Expand touch target for accessibility (A11Y-002)
    hitSlop: {
      top: theme.spacing.sm,
      bottom: theme.spacing.sm,
      left: theme.spacing.sm,
      right: theme.spacing.sm,
    },
  });

export default ParticipantCard;
