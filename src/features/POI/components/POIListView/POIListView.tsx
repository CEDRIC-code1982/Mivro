/**
 * @file POIListView.tsx
 * @description Molecule POIListView — liste FlatList de POICard avec gestion
 *              des états loading, error et empty.
 *              POIListView molecule — FlatList of POICard with loading,
 *              error and empty state handling.
 *
 * @example
 * ```tsx
 * <POIListView
 *   pois={pois}
 *   midpoint={midpoint}
 *   onPressPOI={(poi) => setSelectedPOI(poi)}
 *   isLoading={isLoading}
 *   error={error}
 * />
 * ```
 *
 * @module features/POI/components/POIListView/POIListView
 */

// [ADDED] Molecule POIListView — liste de POI triée par distance

import { useTheme, type Theme } from '@theme';
import { AlertCircle, SearchX } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';
import EmptyState from '@components/molecules/EmptyState';
import type { Coordinates } from '@entities/Location';
import type { PointOfInterest } from '@entities/PointOfInterest';
import POICard from '@features/POI/components/POICard';
import { distanceBetween } from '@services/utils/geo';

/**
 * Props du composant POIListView.
 * POIListView component props.
 *
 * @param pois — Liste de POI / POI list
 * @param midpoint — Coordonnées du midpoint (pour calcul distance) / Midpoint coordinates
 * @param onPressPOI — Callback au tap d'un POI / POI tap callback
 * @param isLoading — État de chargement / Loading state
 * @param error — Erreur éventuelle / Optional error
 * @param testID — Identifiant de test / Test identifier
 */
export interface POIListViewProps {
  /** Liste de POI / POI list */
  readonly pois: readonly PointOfInterest[];
  /** Coordonnées du midpoint / Midpoint coordinates */
  readonly midpoint: Coordinates;
  /** Callback au tap d'un POI / POI tap callback */
  readonly onPressPOI: (poi: PointOfInterest) => void;
  /** État de chargement / Loading state */
  readonly isLoading?: boolean;
  /** Erreur éventuelle / Optional error */
  readonly error?: Error | null | undefined;
  /** Identifiant de test / Test identifier */
  readonly testID?: string;
}

/**
 * POI enrichi avec sa distance au midpoint (pour le tri).
 * POI enriched with distance to midpoint (for sorting).
 */
interface POIWithDistance {
  readonly poi: PointOfInterest;
  readonly distance: number;
}

/**
 * Molecule POIListView du Design System Mivro.
 * Mivro Design System POIListView molecule.
 *
 * Affiche les POI triés par distance croissante, avec gestion
 * des 3 états obligatoires : loading, error, empty (ERR-003).
 *
 * @param props — {@link POIListViewProps}
 * @returns Composant POIListView / POIListView component
 */
const POIListView: React.FC<POIListViewProps> = ({
  pois,
  midpoint,
  onPressPOI,
  isLoading = false,
  error = null,
  testID,
}) => {
  const { t } = useTranslation('poi');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // Tri par distance croissante, mémoïsé
  // Sort by ascending distance, memoized
  const sortedPois = useMemo<readonly POIWithDistance[]>(() => {
    const withDistance = pois.map((poi) => ({
      poi,
      distance: distanceBetween(midpoint, poi.coordinates),
    }));
    return withDistance.sort((a, b) => a.distance - b.distance);
  }, [pois, midpoint]);

  // ─── État loading ──────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centerContainer} testID={testID ? `${testID}-loading` : undefined}>
        <ActivityIndicator size="large" color={theme.color.text.brand} />
        <Text variant="body" color="secondary" align="center">
          {t('list.loading')}
        </Text>
      </View>
    );
  }

  // ─── État error ────────────────────────────────────────────
  if (error != null) {
    return (
      <View style={styles.centerContainer} {...(testID != null && { testID: `${testID}-error` })}>
        <EmptyState
          icon={AlertCircle}
          title={t('errors.unknown')}
          description={error.message}
          {...(testID != null && { testID: `${testID}-error-state` })}
        />
      </View>
    );
  }

  // ─── État empty ────────────────────────────────────────────
  if (sortedPois.length === 0) {
    return (
      <View style={styles.centerContainer} {...(testID != null && { testID: `${testID}-empty` })}>
        <EmptyState
          icon={SearchX}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          {...(testID != null && { testID: `${testID}-empty-state` })}
        />
      </View>
    );
  }

  // ─── État normal — FlatList de POICard ─────────────────────
  return (
    <FlatList<POIWithDistance>
      data={sortedPois}
      keyExtractor={(item) => item.poi.externalId}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <POICard
          poi={item.poi}
          distanceMeters={item.distance}
          onPress={() => onPressPOI(item.poi)}
          {...(testID != null && { testID: `${testID}-card-${item.poi.externalId}` })}
        />
      )}
      ItemSeparatorComponent={POIListSeparator}
      testID={testID}
    />
  );
};

/**
 * Séparateur stable entre les POICard (extrait pour éviter le warning
 * react/no-unstable-nested-components).
 * Stable separator between POICards.
 *
 * @returns Le séparateur rendu / The rendered separator
 */
const POIListSeparator: React.FC = () => {
  const theme = useTheme();
  return <View style={{ height: theme.spacing.sm }} />;
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    listContent: {
      padding: theme.spacing.lg,
    },
    separator: {
      height: theme.spacing.sm,
    },
  });

export default POIListView;
