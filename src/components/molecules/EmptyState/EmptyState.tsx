/**
 * @file EmptyState.tsx
 * @description Molecule EmptyState — placeholder visuel pour les listes vides,
 *              écrans sans données ou résultats de recherche vides.
 *              EmptyState molecule — visual placeholder for empty lists,
 *              no-data screens or empty search results.
 *
 *              Réutilisable pour F1 (participants), F2 (POI), F3 (carte), etc.
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

// [ADDED] Molecule EmptyState

import { useTheme, type Theme } from '@theme';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';

/**
 * Props du composant EmptyState.
 * EmptyState component props.
 *
 * @param icon - Icône Lucide optionnelle / Optional Lucide icon
 * @param title - Titre du placeholder / Placeholder title
 * @param description - Description optionnelle / Optional description
 * @param testID - ID de test / Test ID
 */
export interface EmptyStateProps {
  /** Icône Lucide optionnelle / Optional Lucide icon */
  icon?: LucideIcon;
  /** Titre du placeholder / Placeholder title */
  title: string;
  /** Description optionnelle / Optional description */
  description?: string;
  /** ID de test / Test ID */
  testID?: string;
}

/**
 * Molecule EmptyState du Design System Mivro.
 * Mivro Design System EmptyState molecule.
 *
 * Layout vertical centré avec icône optionnelle, titre et description.
 *
 * @param props - {@link EmptyStateProps}
 * @returns Composant EmptyState / EmptyState component
 */
const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, testID }) => {
  const theme = useTheme();
  const styles = buildStyles(theme);

  const label = description != null ? `${title}, ${description}` : title;

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
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
