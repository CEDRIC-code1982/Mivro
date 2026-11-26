/**
 * @file AvatarPicker.tsx
 * @description AvatarPicker molecule — grid to pick from the 20 emoji avatars.
 *
 *              F7 (first pass): predefined avatars only (no photo).
 *              Each cell is an accessible button (A11Y-002/003); the selected
 *              avatar is highlighted with a ring + a11y selected state.
 *
 * @example
 * ```tsx
 * <AvatarPicker selectedAvatarId={user.avatarId} onSelect={handleSelectAvatar} />
 * ```
 *
 * @module components/molecules/AvatarPicker/AvatarPicker
 */

// [ADDED] F7 — AvatarPicker molecule (grid of the 20 avatars)
import { useTheme, type Theme } from '@theme';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@components/atoms';
import { AVATARS, type AvatarId, type PredefinedAvatar } from '@entities/Avatar';

/** Avatar diameter in the grid */
const GRID_AVATAR_SIZE = 56;

/**
 * AvatarPicker component props.
 */
export interface AvatarPickerProps {
  /** Currently selected avatar */
  selectedAvatarId?: AvatarId | undefined;
  /** Avatar selection callback */
  onSelect: (avatarId: AvatarId) => void;
  /** Test ID */
  testID?: string;
}

/**
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
      {/* `fallbackName` is unreachable here: `avatar.id` always comes from the
          AVATARS grid, so the atom resolves it through `getAvatarById` and
          renders the emoji (render order photo > emoji via `avatarId` >
          initial via `getInitial(fallbackName)`; no `photoUri` is passed). It
          is only passed because the prop is required by the `Avatar` atom. */}
      <Avatar avatarId={avatar.id} fallbackName={avatar.emoji} size={GRID_AVATAR_SIZE} />
    </Pressable>
  );
};

/**
 * Mivro Design System AvatarPicker molecule.
 *
 * Displays the 20 predefined avatars in a fluid wrapping grid. Selection is
 * controlled by the parent via `selectedAvatarId` + `onSelect`.
 *
 * @param props - {@link AvatarPickerProps}
 * @returns AvatarPicker component
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
      // Touch target ≥ touchTarget.min guaranteed by minWidth/minHeight (A11Y-002);
      // the avatar (56) already exceeds this target.
      padding: theme.spacing.xs,
      borderRadius: theme.radius.full,
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.color.border.none,
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
