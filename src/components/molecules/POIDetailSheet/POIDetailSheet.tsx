/**
 * @file POIDetailSheet.tsx
 * @description Molecule POIDetailSheet — bottom sheet de détail d'un POI
 *              avec actions "Y aller" et "Fermer".
 *              POIDetailSheet molecule — POI detail bottom sheet
 *              with "Navigate" and "Close" actions.
 *
 * @example
 * ```tsx
 * <POIDetailSheet
 *   poi={selectedPOI}
 *   distanceMeters={1200}
 *   onClose={() => setSelectedPOI(null)}
 * />
 * ```
 *
 * @module components/molecules/POIDetailSheet/POIDetailSheet
 */

// [ADDED] Molecule POIDetailSheet — détail POI en bottom sheet

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme, type Theme } from '@theme';
import { Navigation } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { getCategoryIcon } from '@features/POI/utils/poiIcons';
import { getDistanceLabel } from '@services/utils/format/distance';

/**
 * Props du composant POIDetailSheet.
 * POIDetailSheet component props.
 *
 * @param poi — POI à afficher (null = fermé) / POI to display (null = closed)
 * @param distanceMeters — Distance au midpoint en mètres / Distance to midpoint in meters
 * @param onClose — Callback de fermeture / Close callback
 * @param testID — Identifiant de test / Test identifier
 */
export interface POIDetailSheetProps {
  /** POI à afficher (null = fermé) / POI to display (null = closed) */
  readonly poi: PointOfInterest | null;
  /** Distance au midpoint en mètres / Distance to midpoint in meters */
  readonly distanceMeters: number;
  /** Callback de fermeture / Close callback */
  readonly onClose: () => void;
  /** Identifiant de test / Test identifier */
  readonly testID?: string;
}

/** Taille de l'icône catégorie large / Large category icon size */
const LARGE_ICON_SIZE = 32;

/**
 * Ouvre l'application de navigation native vers les coordonnées du POI.
 * Opens the native navigation app to the POI coordinates.
 *
 * @param poi — POI cible / Target POI
 */
const openNativeNavigation = async (poi: PointOfInterest): Promise<void> => {
  const { latitude, longitude } = poi.coordinates;
  const encodedName = encodeURIComponent(poi.name);

  const nativeUrl =
    Platform.OS === 'ios'
      ? `maps://?daddr=${latitude},${longitude}`
      : `geo:0,0?q=${latitude},${longitude}(${encodedName})`;

  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  try {
    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
    } else {
      await Linking.openURL(fallbackUrl);
    }
  } catch {
    // Fallback Google Maps web si erreur d'ouverture
    await Linking.openURL(fallbackUrl);
  }

  console.log(
    `[INFO][POIDetailSheet][openNativeNavigation][?][${new Date().toISOString().slice(11, 19)}] ` +
      `Navigation opened for "${poi.name}" (${latitude}, ${longitude})`,
  );
};

/**
 * Molecule POIDetailSheet du Design System Mivro.
 * Mivro Design System POIDetailSheet molecule.
 *
 * Bottom sheet avec détails du POI et actions de navigation.
 * Bottom sheet with POI details and navigation actions.
 *
 * @param props — {@link POIDetailSheetProps}
 * @returns Composant POIDetailSheet / POIDetailSheet component
 */
const POIDetailSheet: React.FC<POIDetailSheetProps> = ({
  poi,
  distanceMeters,
  onClose,
  testID,
}) => {
  const { t } = useTranslation('poi');
  const theme = useTheme();
  const styles = buildStyles(theme);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '80%'], []);

  // Ouvrir/fermer le sheet selon la présence d'un POI
  // Open/close sheet based on POI presence
  useEffect(() => {
    if (poi != null) {
      sheetRef.current?.snapToIndex(0);
      console.log(
        `[INFO][POIDetailSheet][open][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Detail sheet opened for "${poi.name}"`,
      );
    } else {
      sheetRef.current?.close();
    }
  }, [poi]);

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose();
  }, [onClose]);

  const handleNavigate = useCallback(() => {
    if (poi != null) {
      openNativeNavigation(poi).catch(() => {
        // Navigation failure already handled inside openNativeNavigation
      });
    }
  }, [poi]);

  // Rendu même si poi est null (le sheet est simplement fermé)
  // Render even when poi is null (sheet is just closed)
  const Icon = poi != null ? getCategoryIcon(poi.category) : null;
  const distanceLabel = getDistanceLabel(distanceMeters);
  const categoryLabel = poi != null ? t(`categories.${poi.category}`) : '';

  return (
    <View testID={testID}>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.content}>
          {poi != null && (
            <>
              {/* [ADDED] Header : icône + nom + catégorie */}
              <View style={styles.header} testID={testID ? `${testID}-header` : undefined}>
                {Icon != null && (
                  <Icon
                    size={LARGE_ICON_SIZE}
                    color={theme.color.interactive.brand.default}
                    strokeWidth={1.5}
                  />
                )}
                <View style={styles.headerText}>
                  <Text variant="h4" weight="bold" numberOfLines={2}>
                    {poi.name}
                  </Text>
                  <Text variant="small" color="secondary">
                    {categoryLabel}
                  </Text>
                </View>
              </View>

              {/* [ADDED] Infos : distance, adresse, coordonnées */}
              <View style={styles.infoSection}>
                <Text variant="body" color="secondary">
                  {t('detail.distance', { distance: distanceLabel })}
                </Text>
                {poi.address != null && (
                  <Text variant="small" color="secondary" numberOfLines={2}>
                    {t('detail.address', { address: poi.address })}
                  </Text>
                )}
                <Text variant="caption" color="tertiary">
                  {poi.coordinates.latitude.toFixed(5)}, {poi.coordinates.longitude.toFixed(5)}
                </Text>
              </View>

              {/* [ADDED] Actions : Y aller + Fermer */}
              <View style={styles.actionsSection}>
                <Pressable
                  onPress={handleNavigate}
                  style={({ pressed }) => [
                    styles.navigateButton,
                    pressed ? styles.navigateButtonPressed : undefined,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('detail.actions.navigate')}
                  testID={testID ? `${testID}-navigate` : undefined}
                >
                  <Navigation
                    size={theme.typography.fontSize.body}
                    color={theme.color.text.onBrand}
                    strokeWidth={2}
                  />
                  <Text variant="body" weight="semibold" color="onBrand">
                    {t('detail.actions.navigate')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed ? styles.closeButtonPressed : undefined,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('detail.actions.close')}
                  testID={testID ? `${testID}-close` : undefined}
                >
                  <Text variant="body" weight="semibold" color="brand">
                    {t('detail.actions.close')}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: theme.color.surface.primary,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
    },
    sheetHandle: {
      backgroundColor: theme.color.border.default,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    headerText: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    infoSection: {
      gap: theme.spacing.xs,
    },
    actionsSection: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    navigateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.color.interactive.brand.default,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      minHeight: theme.touchTarget.min,
    },
    navigateButtonPressed: {
      backgroundColor: theme.color.interactive.brand.pressed,
    },
    closeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      minHeight: theme.touchTarget.min,
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
  });

export default POIDetailSheet;
