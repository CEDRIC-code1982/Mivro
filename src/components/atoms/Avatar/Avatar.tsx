/**
 * @file Avatar.tsx
 * @description Atome Avatar — affiche un avatar emoji sur fond coloré.
 *              Avatar atom — renders an emoji avatar on a colored background.
 *
 *              Ordre de rendu : photo (`photoUri`) > emoji (`avatarId`) > initiale.
 *              F7 passe 2 : photo de profil locale (FileSystem) prioritaire ;
 *              sinon avatar emoji prédéfini ; sinon initiale du nom en fallback.
 *              Render order: photo (`photoUri`) > emoji (`avatarId`) > initial.
 *              F7 pass 2: local profile photo (FileSystem) first; otherwise a
 *              predefined emoji avatar; otherwise the name initial fallback.
 *
 * @example
 * ```tsx
 * <Avatar
 *   photoUri={user.photoUri}
 *   avatarId={user.avatarId}
 *   fallbackName={user.displayName}
 *   size={40}
 * />
 * ```
 *
 * @module components/atoms/Avatar/Avatar
 */

// [MODIFIED] F7 passe 2 — Atome Avatar (photo > emoji > initiale)
import { useTheme, type Theme } from '@theme';
import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Text from '@components/atoms/Text';
import { getAvatarById } from '@entities/Avatar';

/**
 * Props du composant Avatar.
 * Avatar component props.
 */
export interface AvatarProps {
  /**
   * Chemin local d'une photo de profil (prioritaire sur l'emoji).
   * Local profile photo path (takes priority over the emoji).
   */
  photoUri?: string | undefined;
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
 * Ordre de rendu : photo (`photoUri`) > emoji (`avatarId`) > initiale.
 * Affiche la photo de profil locale si fournie, sinon l'emoji de l'avatar
 * prédéfini si `avatarId` correspond à un avatar connu, sinon l'initiale de
 * `fallbackName` sur fond brand.
 * Render order: photo (`photoUri`) > emoji (`avatarId`) > initial.
 * Renders the local profile photo if provided, otherwise the predefined
 * avatar emoji if `avatarId` maps to a known avatar, otherwise the
 * `fallbackName` initial on a brand background.
 *
 * Décoratif par défaut (`accessibilityElementsHidden`) : le label porteur de
 * sens est sur le conteneur parent (ParticipantCard, ligne de profil…).
 * Decorative by default: the meaningful label lives on the parent container.
 *
 * @param props - {@link AvatarProps}
 * @returns Composant Avatar / Avatar component
 */
const Avatar: React.FC<AvatarProps> = ({
  photoUri,
  avatarId,
  fallbackName,
  size = 40,
  style,
  testID,
}) => {
  const theme = useTheme();
  const avatar = getAvatarById(avatarId);
  const hasPhoto = photoUri != null && photoUri.length > 0;
  const styles = buildStyles(theme, size, avatar?.backgroundColor);

  /**
   * Sélectionne le contenu selon l'ordre photo > emoji > initiale.
   * Picks the content following the photo > emoji > initial order.
   *
   * @returns Le contenu affiché dans l'avatar / The avatar content
   */
  const renderContent = (): React.ReactElement => {
    if (hasPhoto) {
      return (
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          resizeMode="cover"
          testID={testID ? `${testID}-photo` : undefined}
        />
      );
    }
    if (avatar) {
      return (
        <Text variant="body" style={styles.emoji} testID={testID ? `${testID}-emoji` : undefined}>
          {avatar.emoji}
        </Text>
      );
    }
    return (
      <Text
        variant="body"
        weight="bold"
        color="onBrand"
        testID={testID ? `${testID}-initial` : undefined}
      >
        {getInitial(fallbackName)}
      </Text>
    );
  };

  return (
    <View
      style={[styles.circle, style]}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {renderContent()}
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
      // Clippe la photo au cercle / clips the photo to the circle
      overflow: 'hidden',
    },
    emoji: {
      fontSize: size * EMOJI_SIZE_RATIO,
      lineHeight: size * EMOJI_SIZE_RATIO * theme.typography.lineHeight.tight,
      textAlign: 'center',
    },
    // [ADDED] F7 passe 2 — photo de profil remplit le cercle / photo fills the circle
    photo: {
      width: size,
      height: size,
    },
  });

export default Avatar;
