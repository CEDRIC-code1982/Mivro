/**
 * @file ParticipantCard.tsx
 * @description Molecule ParticipantCard — affiche un participant avec avatar,
 *              nom, adresse et bouton de suppression optionnel.
 *              ParticipantCard molecule — displays a participant with avatar,
 *              name, address and optional remove button.
 *
 * @example
 * ```tsx
 * <ParticipantCard
 *   participant={participant}
 *   onRemove={() => removeParticipant(participant.id)}
 * />
 * ```
 *
 * @module presentation/components/molecules/ParticipantCard
 */

// [ADDED] Molecule ParticipantCard

import { X } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Participant } from '@core/entities/MidpointSession';
import { useTheme, type Theme } from '@core/theme';
import Text from '@presentation/components/atoms/Text';

/**
 * Props du composant ParticipantCard.
 * ParticipantCard component props.
 *
 * @param participant - Données du participant / Participant data
 * @param onRemove - Callback de suppression (si fourni, bouton × visible) / Remove callback
 * @param accessibilityLabelOverride - Override du label a11y / a11y label override
 * @param testID - ID de test / Test ID
 */
export interface ParticipantCardProps {
  /** Données du participant / Participant data */
  participant: Participant;
  /** Callback de suppression (si fourni, bouton × visible) / Remove callback (if provided, × button visible) */
  onRemove?: () => void;
  /** Override du label a11y / a11y label override */
  accessibilityLabelOverride?: string;
  /** ID de test / Test ID */
  testID?: string;
}

/**
 * Extrait l'initiale d'un nom pour l'avatar.
 * Extracts the initial from a name for the avatar.
 *
 * @param name - Nom du participant / Participant name
 * @returns Initiale en majuscule / Uppercase initial
 */
const getInitial = (name: string): string => {
  const firstChar = name.trim().charAt(0);
  return firstChar.toUpperCase();
};

/**
 * Molecule ParticipantCard du Design System Mivro.
 * Mivro Design System ParticipantCard molecule.
 *
 * Layout horizontal : [Avatar] [Nom + Adresse] [× optionnel]
 *
 * @param props - {@link ParticipantCardProps}
 * @returns Composant ParticipantCard / ParticipantCard component
 */
const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  onRemove,
  accessibilityLabelOverride,
  testID,
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme);

  const { displayName, startLocation } = participant;
  const initial = getInitial(displayName);
  const address = startLocation.formattedAddress;

  const cardLabel = accessibilityLabelOverride ?? `${displayName}, ${address}`;

  return (
    <View
      style={styles.container}
      accessibilityLabel={cardLabel}
      accessibilityRole="none"
      testID={testID}
    >
      {/* [ADDED] Avatar circulaire avec initiale */}
      <View
        style={styles.avatar}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          variant="body"
          weight="bold"
          color="onBrand"
          testID={testID ? `${testID}-initial` : undefined}
        >
          {initial}
        </Text>
      </View>

      {/* [ADDED] Nom + adresse */}
      <View style={styles.textContainer}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={2}>
          {address}
        </Text>
      </View>

      {/* [ADDED] Bouton × de suppression (si onRemove fourni) */}
      {onRemove != null && (
        <Pressable
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed ? styles.removeButtonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}`}
          accessibilityHint={address}
          hitSlop={styles.hitSlop}
          testID={testID ? `${testID}-remove` : undefined}
        >
          <X
            size={theme.typography.fontSize.body}
            color={theme.color.interactive.danger.default}
            strokeWidth={2}
          />
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
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.interactive.brand.default,
      justifyContent: 'center',
      alignItems: 'center',
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
