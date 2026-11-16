/**
 * @file EmptyState.tsx
 * @description EmptyState molecule — visual placeholder for empty lists,
 *              no-data screens or empty search results.
 *
 *              Reusable for F1 (participants), F2 (POI), F3 (map), etc.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={MapPin}
 *   title={t('create:list.empty.title')}
 *   description={t('create:list.empty.description')}
 * />
 * ```
 *
 * @module components/molecules/EmptyState/EmptyState
 */

// [ADDED] EmptyState molecule

import { useTheme, type Theme } from '@theme';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';

/**
 * EmptyState component props.
 *
 * @param icon - Optional Lucide icon
 * @param title - Placeholder title
 * @param description - Optional description
 * @param accessibilityHint - Optional translated a11y hint (A11Y-003)
 * @param testID - Test ID
 */
export interface EmptyStateProps {
  /** Optional Lucide icon */
  icon?: LucideIcon;
  /** Placeholder title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional translated a11y hint, read after the title and description (A11Y-003) */
  accessibilityHint?: string;
  /** Test ID */
  testID?: string;
}

/**
 * Mivro Design System EmptyState molecule.
 *
 * Centered vertical layout with optional icon, title and description.
 *
 * @param props - {@link EmptyStateProps}
 * @returns EmptyState component
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  accessibilityHint,
  testID,
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme);

  const label = description != null ? `${title}, ${description}` : title;

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="none"
      testID={testID}
    >
      {Icon != null && (
        <View style={styles.iconContainer} testID={testID ? `${testID}-icon` : undefined}>
          <Icon size={theme.touchTarget.min} color={theme.color.text.tertiary} strokeWidth={1.5} />
        </View>
      )}
      <Text variant="h4" weight="semibold" align="center">
        {title}
      </Text>
      {description != null && (
        <Text variant="body" color="secondary" align="center" numberOfLines={3}>
          {description}
        </Text>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    iconContainer: {
      marginBottom: theme.spacing.sm,
    },
  });

export default EmptyState;
