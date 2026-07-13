/**
 * @file CategoryChip.tsx
 * @description Atome CategoryChip — chip de filtre catégorie avec icône,
 *              label et badge optionnel.
 *              CategoryChip atom — category filter chip with icon,
 *              label and optional badge.
 *
 * @example
 * ```tsx
 * <CategoryChip
 *   label={t('poi:categories.restaurant')}
 *   icon={Utensils}
 *   selected={true}
 *   onPress={() => toggleCategory('restaurant')}
 *   count={12}
 * />
 * ```
 *
 * @module presentation/components/atoms/CategoryChip
 */

// [ADDED] Atome CategoryChip — filtre catégorie POI

import { useTheme, type Theme } from '@theme';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';

/**
 * Props du composant CategoryChip.
 * CategoryChip component props.
 *
 * @param label — Texte affiché / Display text
 * @param icon — Icône Lucide optionnelle / Optional Lucide icon
 * @param selected — État sélectionné / Selected state
 * @param onPress — Callback au tap / Tap callback
 * @param count — Nombre de résultats (badge) / Result count (badge)
 * @param accessibilityLabel — Override a11y label / a11y label override
 * @param testID — Identifiant de test / Test identifier
 */
export interface CategoryChipProps {
  /** Texte affiché / Display text */
  readonly label: string;
  /** Icône Lucide optionnelle / Optional Lucide icon */
  readonly icon?: LucideIcon;
  /** État sélectionné / Selected state */
  readonly selected: boolean;
  /** Callback au tap / Tap callback */
  readonly onPress: () => void;
  /** Nombre de résultats (badge) / Result count (badge) */
  readonly count?: number;
  /** Override a11y label / a11y label override */
  readonly accessibilityLabel?: string;
  /** Identifiant de test / Test identifier */
  readonly testID?: string;
}

/** Taille de l'icône dans le chip / Icon size inside chip */
const CHIP_ICON_SIZE = 16;
/** Hauteur du chip / Chip height */
const CHIP_HEIGHT = 36;

/**
 * Atome CategoryChip du Design System Mivro.
 * Mivro Design System CategoryChip atom.
 *
 * Chip sélectionnable avec icône optionnelle et badge de comptage.
 * Selectable chip with optional icon and count badge.
 *
 * @param props — {@link CategoryChipProps}
 * @returns Composant CategoryChip / CategoryChip component
 */
const CategoryChip: React.FC<CategoryChipProps> = ({
  label,
  icon: Icon,
  selected,
  onPress,
  count,
  accessibilityLabel: a11yLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme, selected);

  const computedA11yLabel = a11yLabel ?? (count != null ? `${label}, ${count}` : label);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : undefined]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={computedA11yLabel}
      hitSlop={{ top: 6, bottom: 6 }}
      testID={testID}
    >
      {Icon != null && (
        <Icon
          size={CHIP_ICON_SIZE}
          color={selected ? theme.color.text.onBrand : theme.color.text.primary}
          strokeWidth={2}
          {...(testID != null && { testID: `${testID}-icon` })}
        />
      )}
      <Text
        variant="small"
        weight={selected ? 'semibold' : 'regular'}
        color={selected ? 'onBrand' : 'primary'}
      >
        {label}
      </Text>
      {count != null && (
        <View style={styles.badge} testID={testID ? `${testID}-badge` : undefined}>
          <Text variant="caption" weight="medium" color={selected ? 'brand' : 'secondary'}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const buildStyles = (theme: Theme, selected: boolean) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      height: CHIP_HEIGHT,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.full,
      gap: theme.spacing.xs,
      backgroundColor: selected
        ? theme.color.interactive.brand.default
        : theme.color.surface.secondary,
      borderWidth: selected ? 0 : 1,
      borderColor: selected ? undefined : theme.color.border.subtle,
    },
    chipPressed: {
      opacity: 0.8,
    },
    badge: {
      backgroundColor: selected ? theme.color.surface.primary : theme.color.surface.tertiary,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      minWidth: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default CategoryChip;
