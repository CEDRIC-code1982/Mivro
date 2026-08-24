/**
 * @file POICard.tsx
 * @description Molecule POICard — carte de lieu d'intérêt avec icône catégorie,
 *              nom, distance et chevron d'action.
 *              POICard molecule — point of interest card with category icon,
 *              name, distance and action chevron.
 *
 * @example
 * ```tsx
 * <POICard
 *   poi={poi}
 *   distanceMeters={1250}
 *   onPress={() => selectPOI(poi)}
 * />
 * ```
 *
 * @module components/molecules/POICard/POICard
 */

// [ADDED] Molecule POICard — carte POI

import { useTheme, type Theme } from '@theme';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { getCategoryIcon } from '@features/POI/utils/poiIcons';
import { getDistanceLabel } from '@services/utils/format/distance';

/**
 * Props du composant POICard.
 * POICard component props.
 *
 * @param poi — Point d'intérêt à afficher / Point of interest to display
 * @param distanceMeters — Distance au midpoint en mètres / Distance to midpoint in meters
 * @param onPress — Callback au tap / Tap callback
 * @param testID — Identifiant de test / Test identifier
 */
export interface POICardProps {
  /** Point d'intérêt à afficher / Point of interest to display */
  readonly poi: PointOfInterest;
  /** Distance au midpoint en mètres / Distance to midpoint in meters */
  readonly distanceMeters: number;
  /** Callback au tap / Tap callback */
  readonly onPress: () => void;
  /** Identifiant de test / Test identifier */
  readonly testID?: string;
}

/** Taille du cercle icône / Icon circle size */
const ICON_CIRCLE_SIZE = 40;
/** Taille de l'icône catégorie / Category icon size */
const CATEGORY_ICON_SIZE = 24;
/** Taille du chevron / Chevron size */
const CHEVRON_SIZE = 20;

/**
 * Molecule POICard du Design System Mivro.
 * Mivro Design System POICard molecule.
 *
 * Layout horizontal : [Icon catégorie] [Nom + catégorie + distance] [Chevron]
 *
 * @param props — {@link POICardProps}
 * @returns Composant POICard / POICard component
 */
const POICard: React.FC<POICardProps> = ({ poi, distanceMeters, onPress, testID }) => {
  const { t } = useTranslation('poi');
  const theme = useTheme();
  const styles = buildStyles(theme);

  const Icon = getCategoryIcon(poi.category);
  const distanceLabel = getDistanceLabel(distanceMeters);
  const categoryLabel = t(`categories.${poi.category}`);

  const a11yLabel = `${poi.name}, ${categoryLabel}, ${distanceLabel}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : undefined]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t('detail.actions.navigate')}
      testID={testID}
    >
      {/* [ADDED] Icône catégorie dans cercle */}
      <View style={styles.iconCircle}>
        <Icon
          size={CATEGORY_ICON_SIZE}
          color={theme.color.interactive.brand.default}
          strokeWidth={1.5}
        />
      </View>

      {/* [ADDED] Texte : nom + catégorie + distance */}
      <View style={styles.textContainer}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {poi.name}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {categoryLabel} · {distanceLabel}
        </Text>
      </View>

      {/* [ADDED] Chevron d'action */}
      <ChevronRight size={CHEVRON_SIZE} color={theme.color.text.tertiary} strokeWidth={2} />
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.primary,
      gap: theme.spacing.md,
    },
    cardPressed: {
      opacity: 0.7,
    },
    iconCircle: {
      width: ICON_CIRCLE_SIZE,
      height: ICON_CIRCLE_SIZE,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface.tertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });

export default POICard;
