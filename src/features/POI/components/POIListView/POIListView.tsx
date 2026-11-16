/**
 * @file POIListView.tsx
 * @description POIListView molecule — FlatList of POICard with loading,
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

// [ADDED] POIListView molecule — POI list sorted by distance

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
import { POIError } from '@services/domain/poi/IPOIService';
import { distanceBetween } from '@services/utils/geo';

/**
 * POIListView component props.
 *
 * @param pois — POI list
 * @param midpoint — Midpoint coordinates (used for distance computation)
 * @param onPressPOI — POI tap callback
 * @param isLoading — Loading state
 * @param error — Optional error
 * @param testID — Test identifier
 */
export interface POIListViewProps {
  /** POI list */
  readonly pois: readonly PointOfInterest[];
  /** Midpoint coordinates */
  readonly midpoint: Coordinates;
  /** POI tap callback */
  readonly onPressPOI: (poi: PointOfInterest) => void;
  /** Loading state */
  readonly isLoading?: boolean;
  /** Optional error */
  readonly error?: Error | null | undefined;
  /** Test identifier */
  readonly testID?: string;
}

/**
 * POI enriched with its distance to the midpoint (for sorting).
 */
interface POIWithDistance {
  readonly poi: PointOfInterest;
  readonly distance: number;
}

/**
 * Maps a POI search error to a dedicated i18n message key (poi namespace).
 *
 * [FIXED] "POI rayon géant": the error state used to show the raw technical message
 * (`error.message`, in English) under a generic title. `invalid_input` has no dedicated
 * message: it comes from inputs the user cannot fix (missing center or radius, or a radius
 * outside the bounds of SearchPOIUseCase — below 100 m is still possible, see TODO "POI rayon
 * minuscule").
 *
 * @param error — Error surfaced by usePOIQuery
 * @returns i18n key (poi namespace)
 */
const poiErrorKey = (error: Error): string => {
  if (error instanceof POIError) {
    switch (error.code) {
      case 'rate_limited':
        return 'errors.rate_limited';
      case 'network':
        return 'errors.network';
      case 'server_error':
        return 'errors.server_error';
      case 'query_timeout':
        return 'errors.query_timeout';
      case 'parse_error':
        return 'errors.parse_error';
      default:
        return 'errors.unknown';
    }
  }
  return 'errors.unknown';
};

/**
 * Mivro Design System POIListView molecule.
 *
 * Shows POIs sorted by ascending distance, handling the
 * 3 mandatory states: loading, error, empty (ERR-003).
 *
 * @param props — {@link POIListViewProps}
 * @returns POIListView component
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

  // Sort by ascending distance, memoized
  const sortedPois = useMemo<readonly POIWithDistance[]>(() => {
    const withDistance = pois.map((poi) => ({
      poi,
      distance: distanceBetween(midpoint, poi.coordinates),
    }));
    return withDistance.sort((a, b) => a.distance - b.distance);
  }, [pois, midpoint]);

  // ─── Loading state ─────────────────────────────────────────
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

  // ─── Error state ───────────────────────────────────────────
  if (error != null) {
    return (
      <View style={styles.centerContainer} {...(testID != null && { testID: `${testID}-error` })}>
        <EmptyState
          icon={AlertCircle}
          title={t('errors.title')}
          description={t(poiErrorKey(error))}
          {...(testID != null && { testID: `${testID}-error-state` })}
        />
      </View>
    );
  }

  // ─── Empty state ───────────────────────────────────────────
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

  // ─── Normal state — FlatList of POICard ────────────────────
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
 * Stable separator between POICards (extracted to avoid the
 * react/no-unstable-nested-components warning).
 *
 * @returns The rendered separator
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
