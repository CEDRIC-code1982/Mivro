/**
 * @file POIScreen.tsx
 * @description Écran F3 — Affichage des POI autour du midpoint avec
 *              toggle Liste/Carte, filtres catégorie et détail bottom sheet.
 *              F3 Screen — POI display around midpoint with List/Map toggle,
 *              category filters and detail bottom sheet.
 *
 * @module presentation/screens/POIScreen
 */

// [ADDED] Écran POIScreen — feature F3 complète

import { useNavigation } from '@react-navigation/native';
import { useTheme, type Theme } from '@theme';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@components/atoms/Text';
import EmptyState from '@components/molecules/EmptyState';
import POIDetailSheet from '@components/molecules/POIDetailSheet';
import POIListView from '@components/molecules/POIListView';
import POIMapView from '@components/molecules/POIMapView';
import POIScreenHeader, { type POIViewMode } from '@components/molecules/POIScreenHeader';
import { ALL_POI_CATEGORIES, type POICategory } from '@entities/POICategory';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { usePOIQuery } from '@features/POI/hooks/usePOIQuery';
import { distanceBetween } from '@services/utils/geo';
import { useSessionStore } from '@state/useSessionStore';

/**
 * Écran POI F3 — affiche les lieux d'intérêt autour du midpoint calculé.
 * POI Screen F3 — displays points of interest around the computed midpoint.
 *
 * @returns Composant POIScreen / POIScreen component
 */
const POIScreen: React.FC = () => {
  const { t } = useTranslation('poi');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const styles = buildStyles(theme, insets.top, insets.bottom);

  // ─── Store ──────────────────────────────────────────────────
  const session = useSessionStore((s) => s.session);
  const isComputed = session?.status === 'computed';
  const midpoint = isComputed ? session.midpoint : undefined;
  const radius = isComputed ? session.midpointRadius : undefined;

  // ─── État local ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<POIViewMode>('list');
  const [selectedCategories, setSelectedCategories] =
    useState<readonly POICategory[]>(ALL_POI_CATEGORIES);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);

  // ─── Query POI ──────────────────────────────────────────────
  const {
    data: pois,
    isLoading,
    error,
  } = usePOIQuery({
    center: midpoint ?? null,
    radiusMeters: radius ?? null,
    categories: selectedCategories,
  });

  // ─── Counts par catégorie (pour badges) ─────────────────────
  const categoryCounts = useMemo<Partial<Record<POICategory, number>>>(() => {
    if (!pois) return {};
    const counts: Partial<Record<POICategory, number>> = {};
    for (const poi of pois) {
      counts[poi.category] = (counts[poi.category] ?? 0) + 1;
    }
    return counts;
  }, [pois]);

  // ─── Distance du POI sélectionné ───────────────────────────
  const selectedPOIDistance = useMemo(() => {
    if (!selectedPOI || !midpoint) return 0;
    return distanceBetween(midpoint, selectedPOI.coordinates);
  }, [selectedPOI, midpoint]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleViewModeChange = useCallback((mode: POIViewMode) => {
    setViewMode(mode);
    console.log(
      `[INFO][POIScreen][handleViewModeChange][?][${new Date().toISOString().slice(11, 19)}] ` +
        `View mode changed to "${mode}"`,
    );
  }, []);

  const handleToggleCategory = useCallback((category: POICategory) => {
    setSelectedCategories((prev) => {
      const isSelected = prev.includes(category);
      const next = isSelected ? prev.filter((c) => c !== category) : [...prev, category];
      console.log(
        `[INFO][POIScreen][handleToggleCategory][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Category "${category}" ${isSelected ? 'removed' : 'added'}`,
      );
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCategories(ALL_POI_CATEGORIES);
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  const handlePressPOI = useCallback((poi: PointOfInterest) => {
    setSelectedPOI(poi);
    console.log(
      `[INFO][POIScreen][handlePressPOI][?][${new Date().toISOString().slice(11, 19)}] ` +
        `POI selected: "${poi.name}" (${poi.externalId})`,
    );
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedPOI(null);
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // ─── Cas : pas de session computed ─────────────────────────
  if (!isComputed || !midpoint || !radius) {
    return (
      <View style={styles.emptyContainer} testID="poi-screen-no-session">
        <EmptyState
          icon={MapPin}
          title={t('noSession.title')}
          description={t('noSession.description')}
          testID="poi-empty-no-session"
        />
        <Pressable
          onPress={handleGoBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('noSession.action')}
          testID="poi-btn-back"
        >
          <Text variant="body" weight="semibold" color="brand">
            {t('noSession.action')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Cas : pas de filtres sélectionnés ─────────────────────
  const showNoFilters = selectedCategories.length === 0;
  const displayPois = pois ?? [];

  return (
    <View style={styles.root} testID="poi-screen">
      {/* [ADDED] Header : titre + retour */}
      <View style={styles.header}>
        <Pressable
          onPress={handleGoBack}
          style={styles.headerBackButton}
          accessibilityRole="button"
          accessibilityLabel={t('noSession.action')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="poi-header-back"
        >
          <ArrowLeft
            size={theme.typography.fontSize.h3}
            color={theme.color.text.primary}
            strokeWidth={2}
          />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text variant="h4" weight="bold" numberOfLines={1}>
            {t('title')}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {t('subtitle')}
          </Text>
        </View>
      </View>

      {/* [ADDED] POIScreenHeader : toggle + filtres */}
      <POIScreenHeader
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onSelectAllCategories={handleSelectAll}
        onClearCategories={handleClearAll}
        categoryCounts={categoryCounts}
        testID="poi-header"
      />

      {/* [ADDED] Body : vue conditionnelle */}
      <View style={styles.body}>
        {showNoFilters ? (
          <View style={styles.noFiltersContainer} testID="poi-no-filters">
            <EmptyState
              icon={MapPin}
              title={t('list.noFilters.title')}
              description={t('list.noFilters.description')}
              testID="poi-empty-no-filters"
            />
          </View>
        ) : viewMode === 'list' ? (
          <POIListView
            pois={displayPois}
            midpoint={midpoint}
            onPressPOI={handlePressPOI}
            isLoading={isLoading}
            error={error ?? null}
            testID="poi-list"
          />
        ) : (
          <POIMapView
            participants={session.participants}
            midpoint={midpoint}
            radius={radius}
            pois={displayPois}
            onPressPOI={handlePressPOI}
            testID="poi-map"
          />
        )}
      </View>

      {/* [ADDED] Bottom sheet détail POI (overlay) */}
      <POIDetailSheet
        poi={selectedPOI}
        distanceMeters={selectedPOIDistance}
        onClose={handleCloseDetail}
        testID="poi-detail"
      />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const buildStyles = (theme: Theme, topInset: number, _bottomInset: number) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.color.surface.primary,
      paddingTop: topInset,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.surface.primary,
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerBackButton: {
      width: theme.touchTarget.min,
      height: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitleContainer: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    body: {
      flex: 1,
    },
    backButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noFiltersContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default POIScreen;
