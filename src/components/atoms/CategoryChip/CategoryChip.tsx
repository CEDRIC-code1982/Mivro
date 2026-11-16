/**
 * @file CategoryChip.tsx
 * @description CategoryChip atom — category filter chip with icon,
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
 * @module components/atoms/CategoryChip/CategoryChip
 */

// [ADDED] CategoryChip atom — POI category filter

import { useTheme, type Theme } from '@theme';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';

/**
 * CategoryChip component props.
 *
 * @param label — Display text
 * @param icon — Optional Lucide icon
 * @param selected — Selected state
 * @param onPress — Tap callback
 * @param count — Result count (badge)
 * @param accessibilityLabel — a11y label override
 * @param accessibilityHint — Translated a11y hint describing what the tap does (A11Y-003)
 * @param testID — Test identifier
 */
export interface CategoryChipProps {
  /** Display text */
  readonly label: string;
  /** Optional Lucide icon */
  readonly icon?: LucideIcon;
  /** Selected state */
  readonly selected: boolean;
  /** Tap callback */
  readonly onPress: () => void;
  /** Result count (badge) */
  readonly count?: number;
  /** a11y label override */
  readonly accessibilityLabel?: string;
  /** Translated a11y hint describing what the tap does (A11Y-003) */
  readonly accessibilityHint?: string;
  /** Test identifier */
  readonly testID?: string;
}

/** Icon size inside chip */
const CHIP_ICON_SIZE = 16;
/** Chip height */
const CHIP_HEIGHT = 36;

/**
 * Mivro Design System CategoryChip atom.
 *
 * Selectable chip with optional icon and count badge.
 *
 * @param props — {@link CategoryChipProps}
 * @returns CategoryChip component
 */
const CategoryChip: React.FC<CategoryChipProps> = ({
  label,
  icon: Icon,
  selected,
  onPress,
  count,
  accessibilityLabel: a11yLabel,
  accessibilityHint,
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
      accessibilityHint={accessibilityHint}
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
