/**
 * @file POIScreenHeader.tsx
 * @description Molecule POIScreenHeader — toggle vue Liste/Carte +
 *              chips de filtres catégories en scroll horizontal.
 *              POIScreenHeader molecule — List/Map view toggle +
 *              horizontal scrolling category filter chips.
 *
 * @example
 * ```tsx
 * <POIScreenHeader
 *   viewMode="list"
 *   onViewModeChange={setViewMode}
 *   selectedCategories={selectedCategories}
 *   onToggleCategory={toggleCategory}
 *   onSelectAllCategories={selectAll}
 *   onClearCategories={clearAll}
 *   categoryCounts={counts}
 * />
 * ```
 *
 * @module features/POI/components/POIScreenHeader/POIScreenHeader
 */

// [ADDED] Molecule POIScreenHeader — toggle + filtres catégories

import { useTheme, type Theme } from '@theme';
import { List, Map } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import CategoryChip from '@components/atoms/CategoryChip';
import Text from '@components/atoms/Text';
import type { POICategory } from '@entities/POICategory';
import { ALL_POI_CATEGORIES } from '@entities/POICategory';
import { getCategoryIcon } from '@features/POI/utils/poiIcons';

/**
 * Mode d'affichage des POI.
 * POI display mode.
 */
export type POIViewMode = 'list' | 'map';

/**
 * Props du composant POIScreenHeader.
 * POIScreenHeader component props.
 *
 * @param viewMode — Mode d'affichage actuel / Current display mode
 * @param onViewModeChange — Callback de changement de vue / View change callback
 * @param selectedCategories — Catégories sélectionnées / Selected categories
 * @param onToggleCategory — Callback de toggle catégorie / Category toggle callback
 * @param onSelectAllCategories — Callback sélection toutes / Select all callback
 * @param onClearCategories — Callback déselection toutes / Clear all callback
 * @param categoryCounts — Compteurs par catégorie (badges) / Per-category counts (badges)
 * @param testID — Identifiant de test / Test identifier
 */
export interface POIScreenHeaderProps {
  /** Mode d'affichage actuel / Current display mode */
  readonly viewMode: POIViewMode;
  /** Callback de changement de vue / View change callback */
  readonly onViewModeChange: (mode: POIViewMode) => void;
  /** Catégories sélectionnées / Selected categories */
  readonly selectedCategories: readonly POICategory[];
  /** Callback de toggle catégorie / Category toggle callback */
  readonly onToggleCategory: (category: POICategory) => void;
  /** Callback sélection toutes / Select all callback */
  readonly onSelectAllCategories: () => void;
  /** Callback déselection toutes / Clear all callback */
  readonly onClearCategories: () => void;
  /** Compteurs par catégorie (badges) / Per-category counts (badges) */
  readonly categoryCounts?: Partial<Record<POICategory, number>>;
  /** Identifiant de test / Test identifier */
  readonly testID?: string;
}

/** Taille de l'icône dans le toggle / Icon size in toggle */
const TOGGLE_ICON_SIZE = 16;

/**
 * Molecule POIScreenHeader du Design System Mivro.
 * Mivro Design System POIScreenHeader molecule.
 *
 * @param props — {@link POIScreenHeaderProps}
 * @returns Composant POIScreenHeader / POIScreenHeader component
 */
const POIScreenHeader: React.FC<POIScreenHeaderProps> = ({
  viewMode,
  onViewModeChange,
  selectedCategories,
  onToggleCategory,
  onSelectAllCategories,
  onClearCategories,
  categoryCounts,
  testID,
}) => {
  const { t } = useTranslation('poi');
  const theme = useTheme();
  const styles = buildStyles(theme);

  const allSelected = selectedCategories.length === ALL_POI_CATEGORIES.length;

  const handleAllPress = () => {
    if (allSelected) {
      onClearCategories();
    } else {
      onSelectAllCategories();
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* [ADDED] Row 1 : Toggle pill Liste / Carte */}
      <View
        style={styles.toggleContainer}
        accessibilityRole="tablist"
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <Pressable
          onPress={() => onViewModeChange('list')}
          style={[styles.toggleButton, viewMode === 'list' ? styles.toggleActive : undefined]}
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === 'list' }}
          accessibilityLabel={t('viewMode.list')}
          testID={testID ? `${testID}-toggle-list` : undefined}
        >
          <List
            size={TOGGLE_ICON_SIZE}
            color={viewMode === 'list' ? theme.color.text.onBrand : theme.color.text.primary}
            strokeWidth={2}
          />
          <Text
            variant="small"
            weight="semibold"
            color={viewMode === 'list' ? 'onBrand' : 'primary'}
          >
            {t('viewMode.list')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onViewModeChange('map')}
          style={[styles.toggleButton, viewMode === 'map' ? styles.toggleActive : undefined]}
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === 'map' }}
          accessibilityLabel={t('viewMode.map')}
          testID={testID ? `${testID}-toggle-map` : undefined}
        >
          <Map
            size={TOGGLE_ICON_SIZE}
            color={viewMode === 'map' ? theme.color.text.onBrand : theme.color.text.primary}
            strokeWidth={2}
          />
          <Text
            variant="small"
            weight="semibold"
            color={viewMode === 'map' ? 'onBrand' : 'primary'}
          >
            {t('viewMode.map')}
          </Text>
        </Pressable>
      </View>

      {/* [ADDED] Row 2 : Chips catégories en scroll horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
        testID={testID ? `${testID}-chips` : undefined}
      >
        {/* Chip "Tout" */}
        <CategoryChip
          label={t('categories.all')}
          selected={allSelected}
          onPress={handleAllPress}
          {...(testID != null && { testID: `${testID}-chip-all` })}
        />

        {/* Chips par catégorie */}
        {ALL_POI_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category);
          const Icon = getCategoryIcon(category);
          const count = categoryCounts?.[category];

          return (
            <CategoryChip
              key={category}
              label={t(`categories.${category}`)}
              icon={Icon}
              selected={isSelected}
              onPress={() => onToggleCategory(category)}
              {...(count != null && { count })}
              {...(testID != null && { testID: `${testID}-chip-${category}` })}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    toggleContainer: {
      flexDirection: 'row',
      marginHorizontal: theme.spacing.lg,
      backgroundColor: theme.color.surface.tertiary,
      borderRadius: theme.radius.full,
      padding: theme.spacing.xxs,
    },
    toggleButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.full,
    },
    toggleActive: {
      backgroundColor: theme.color.interactive.brand.default,
    },
    chipsContent: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
  });

export default POIScreenHeader;
