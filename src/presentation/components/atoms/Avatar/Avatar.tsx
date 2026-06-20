/**
 * @file Avatar.tsx
 * @description Atome Avatar — affiche un avatar emoji sur fond coloré.
 *              Avatar atom — renders an emoji avatar on a colored background.
 *
 *              F7 (1re passe) : avatars emoji prédéfinis, aucune dépendance
 *              native. Si aucun avatar n'est fourni, affiche l'initiale du nom
 *              en fallback (cohérent avec l'ancien rendu de ParticipantCard).
 *              F7 (first pass): predefined emoji avatars, no native dependency.
 *              If no avatar is provided, falls back to the name initial.
 *
 * @example
 * ```tsx
 * <Avatar avatarId={user.avatarId} fallbackName={user.displayName} size={40} />
 * ```
 *
 * @module presentation/components/atoms/Avatar
 */

// [ADDED] F7 — Atome Avatar (emoji prédéfini + fallback initiale)
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getAvatarById } from '@core/entities/Avatar';
import { useTheme, type Theme } from '@core/theme';
import Text from '@presentation/components/atoms/Text';

/**
 * Props du composant Avatar.
 * Avatar component props.
 */
export interface AvatarProps {
  /** Id d'avatar emoji prédéfini (optionnel) / Predefined emoji avatar id (optional) */
  avatarId?: string | undefined;
  /** Nom utilisé pour le fallback initiale / Name used for the initial fallback */
  fallbackName: string;
  /** Diamètre du cercle en points / Circle diameter in points (default: 40) */
  size?: number;
  /** Style override du conteneur / Container style override */
  style?: StyleProp<ViewStyle>;
  /** ID de test / Test ID */
  testID?: string | undefined;
}

/**
 * Extrait l'initiale d'un nom (majuscule).
 * Extracts the initial from a name (uppercase).
 *
 * @param name - Nom / Name
 * @returns Initiale en majuscule (ou '?') / Uppercase initial (or '?')
 */
const getInitial = (name: string): string => {
  const firstChar = name.trim().charAt(0);
  return firstChar.length > 0 ? firstChar.toUpperCase() : '?';
};

/** Ratio emoji/diamètre pour un rendu équilibré / Emoji-to-diameter ratio */
const EMOJI_SIZE_RATIO = 0.55;

/**
 * Atome Avatar du Design System Mivro.
 * Mivro Design System Avatar atom.
 *
 * Affiche l'emoji de l'avatar prédéfini si `avatarId` correspond à un avatar
 * connu, sinon l'initiale de `fallbackName` sur fond brand.
 * Renders the predefined avatar emoji if `avatarId` maps to a known avatar,
 * otherwise the `fallbackName` initial on a brand background.
 *
 * Décoratif par défaut (`accessibilityElementsHidden`) : le label porteur de
 * sens est sur le conteneur parent (ParticipantCard, ligne de profil…).
 * Decorative by default: the meaningful label lives on the parent container.
 *
 * @param props - {@link AvatarProps}
 * @returns Composant Avatar / Avatar component
 */
const Avatar: React.FC<AvatarProps> = ({ avatarId, fallbackName, size = 40, style, testID }) => {
  const theme = useTheme();
  const avatar = getAvatarById(avatarId);
  const styles = buildStyles(theme, size, avatar?.backgroundColor);

  return (
    <View
      style={[styles.circle, style]}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {avatar ? (
        <Text variant="body" style={styles.emoji} testID={testID ? `${testID}-emoji` : undefined}>
          {avatar.emoji}
        </Text>
      ) : (
        <Text
          variant="body"
          weight="bold"
          color="onBrand"
          testID={testID ? `${testID}-initial` : undefined}
        >
          {getInitial(fallbackName)}
        </Text>
      )}
    </View>
  );
};

// [ADDED] Build styles from theme tokens — taille dynamique (DS-001/002)
const buildStyles = (theme: Theme, size: number, backgroundColor: string | undefined) =>
  StyleSheet.create({
    circle: {
      width: size,
      height: size,
      borderRadius: theme.radius.full,
      // Fond de l'avatar choisi, sinon brand (cohérent avec le fallback initiale)
      backgroundColor: backgroundColor ?? theme.color.interactive.brand.default,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emoji: {
      fontSize: size * EMOJI_SIZE_RATIO,
      lineHeight: size * EMOJI_SIZE_RATIO * theme.typography.lineHeight.tight,
      textAlign: 'center',
    },
  });

export default Avatar;
