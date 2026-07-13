/**
 * @file AvatarPicker.tsx
 * @description Molecule AvatarPicker — grille de sélection des 20 avatars emoji.
 *              AvatarPicker molecule — grid to pick from the 20 emoji avatars.
 *
 *              F7 (1re passe) : avatars prédéfinis uniquement (pas de photo).
 *              Chaque cellule est un bouton accessible (A11Y-002/003) ; l'avatar
 *              sélectionné est mis en évidence par un anneau + état a11y.
 *              F7 (first pass): predefined avatars only (no photo).
 *              Each cell is an accessible button; the selected avatar is
 *              highlighted with a ring + a11y selected state.
 *
 * @example
 * ```tsx
 * <AvatarPicker selectedAvatarId={user.avatarId} onSelect={handleSelectAvatar} />
 * ```
 *
 * @module presentation/components/molecules/AvatarPicker
 */

// [ADDED] F7 — Molecule AvatarPicker (grille des 20 avatars)
import { useTheme, type Theme } from '@theme';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@components/atoms';
import { AVATARS, type AvatarId, type PredefinedAvatar } from '@entities/Avatar';

/** Diamètre d'un avatar dans la grille / Avatar diameter in the grid */
const GRID_AVATAR_SIZE = 56;

/**
 * Props du composant AvatarPicker.
 * AvatarPicker component props.
 */
export interface AvatarPickerProps {
  /** Avatar actuellement sélectionné / Currently selected avatar */
  selectedAvatarId?: AvatarId | undefined;
  /** Callback de sélection d'un avatar / Avatar selection callback */
  onSelect: (avatarId: AvatarId) => void;
  /** ID de test / Test ID */
  testID?: string;
}

/**
 * Cellule individuelle d'avatar (bouton sélectionnable).
 * Single avatar cell (selectable button).
 */
interface AvatarCellProps {
  avatar: PredefinedAvatar;
  isSelected: boolean;
  onSelect: (avatarId: AvatarId) => void;
  label: string;
  hint: string;
  testID?: string | undefined;
}

const AvatarCell: React.FC<AvatarCellProps> = ({
  avatar,
  isSelected,
  onSelect,
  label,
  hint,
  testID,
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme);

  const handlePress = useCallback(() => {
    onSelect(avatar.id);
  }, [avatar.id, onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: isSelected, checked: isSelected }}
      style={({ pressed }) => [
        styles.cell,
        isSelected ? styles.cellSelected : undefined,
        pressed ? styles.cellPressed : undefined,
      ]}
      testID={testID}
    >
      <Avatar avatarId={avatar.id} fallbackName={avatar.emoji} size={GRID_AVATAR_SIZE} />
    </Pressable>
  );
};

/**
 * Molecule AvatarPicker du Design System Mivro.
 * Mivro Design System AvatarPicker molecule.
 *
 * Affiche les 20 avatars prédéfinis en grille fluide (wrap). La sélection est
 * contrôlée par le parent via `selectedAvatarId` + `onSelect`.
 * Displays the 20 predefined avatars in a fluid wrapping grid. Selection is
 * controlled by the parent via `selectedAvatarId` + `onSelect`.
 *
 * @param props - {@link AvatarPickerProps}
 * @returns Composant AvatarPicker / AvatarPicker component
 */
const AvatarPicker: React.FC<AvatarPickerProps> = ({ selectedAvatarId, onSelect, testID }) => {
  const { t } = useTranslation('profile');
  const theme = useTheme();
  const styles = buildStyles(theme);

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" testID={testID}>
      {AVATARS.map((avatar) => {
        const isSelected = avatar.id === selectedAvatarId;
        const baseLabel = t(`avatarNames.${avatar.id}`);
        return (
          <AvatarCell
            key={avatar.id}
            avatar={avatar}
            isSelected={isSelected}
            onSelect={onSelect}
            label={baseLabel}
            hint={t('avatarPicker.selectHint', { name: baseLabel })}
            testID={testID ? `${testID}-${avatar.id}` : undefined}
          />
        );
      })}
    </View>
  );
};

// [ADDED] Build styles from theme tokens — no magic numbers (DS-001/002)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    cell: {
      // Touch target ≥ touchTarget.min garanti par minWidth/minHeight (A11Y-002) ;
      // l'avatar (56) dépasse déjà cette cible.
      padding: theme.spacing.xs,
      borderRadius: theme.radius.full,
      borderWidth: theme.spacing.xxs,
      borderColor: 'transparent',
      minWidth: theme.touchTarget.min,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cellSelected: {
      borderColor: theme.color.border.focus,
      backgroundColor: theme.color.surface.secondary,
    },
    cellPressed: {
      opacity: 0.7,
    },
  });

export default AvatarPicker;
