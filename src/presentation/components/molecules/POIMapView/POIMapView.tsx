/**
 * @file POIMapView.tsx
 * @description Molecule POIMapView — carte avec markers participants,
 *              midpoint, cercle de zone ET markers POI.
 *              POIMapView molecule — map with participant markers,
 *              midpoint, zone circle AND POI markers.
 *
 *              Composant indépendant de SessionMapView (Option 2 MVP)
 *              pour éviter le couplage entre F2 et F3.
 *
 * @example
 * ```tsx
 * <POIMapView
 *   participants={session.participants}
 *   midpoint={midpoint}
 *   radius={radius}
 *   pois={filteredPois}
 *   onPressPOI={(poi) => setSelectedPOI(poi)}
 * />
 * ```
 *
 * @module presentation/components/molecules/POIMapView
 */

// [ADDED] Molecule POIMapView — carte avec POI markers

import React, { useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Coordinates } from '@core/entities/Location';
import type { Participant } from '@core/entities/MidpointSession';
import type { PointOfInterest } from '@core/entities/PointOfInterest';
import { useTheme, type Theme } from '@core/theme';
import { Text } from '@presentation/components/atoms';
import { getCategoryIcon } from '@presentation/utils/poiIcons';

/**
 * Props du composant POIMapView.
 * POIMapView component props.
 *
 * @param participants — Liste des participants / Participant list
 * @param midpoint — Coordonnées du midpoint / Midpoint coordinates
 * @param radius — Rayon de zone en mètres / Zone radius in meters
 * @param pois — Liste de POI à afficher / POI list to display
 * @param onPressPOI — Callback au tap d'un marker POI / POI marker tap callback
 * @param testID — Identifiant de test / Test identifier
 */
export interface POIMapViewProps {
  readonly participants: readonly Participant[];
  readonly midpoint: Coordinates;
  readonly radius: number;
  readonly pois: readonly PointOfInterest[];
  readonly onPressPOI: (poi: PointOfInterest) => void;
  readonly testID?: string;
}

/** Taille du marker POI / POI marker size */
const POI_MARKER_SIZE = 32;
/** Taille de l'icône dans le marker POI / Icon size inside POI marker */
const POI_ICON_SIZE = 16;
/** Taille du marker participant / Participant marker size */
const PARTICIPANT_MARKER_SIZE = 36;
/** Taille du marker midpoint / Midpoint marker size */
const MIDPOINT_MARKER_SIZE = 48;
/** Padding pour fitToCoordinates / Padding for fitToCoordinates */
const EDGE_PADDING = 80;

/**
 * Molecule POIMapView du Design System Mivro.
 * Mivro Design System POIMapView molecule.
 *
 * Carte complète avec participants, midpoint, zone et POI markers.
 * Full map with participants, midpoint, zone and POI markers.
 *
 * @param props — {@link POIMapViewProps}
 * @returns Composant POIMapView / POIMapView component
 */
const POIMapView: React.FC<POIMapViewProps> = ({
  participants,
  midpoint,
  radius,
  pois,
  onPressPOI,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const mapRef = useRef<MapView>(null);

  // Centrage automatique sur tous les points
  // Auto-fit on all points when map is ready
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || participants.length === 0) return;

    const allCoords = [
      ...participants.map((p) => p.startLocation.coordinates),
      midpoint,
      ...pois.map((p) => p.coordinates),
    ];

    mapRef.current.fitToCoordinates(allCoords, {
      edgePadding: {
        top: EDGE_PADDING,
        right: EDGE_PADDING,
        bottom: EDGE_PADDING,
        left: EDGE_PADDING,
      },
      animated: true,
    });
  }, [participants, midpoint, pois]);

  // Couleur du cercle de zone avec 15% opacité
  const circleFillColor = `${theme.color.interactive.brand.default}26`;

  return (
    <View style={styles.container} testID={testID}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass
        showsScale
        toolbarEnabled={false}
        onMapReady={handleMapReady}
        testID={testID ? `${testID}-map` : undefined}
      >
        {/* [ADDED] Cercle de zone autour du midpoint */}
        <Circle
          center={midpoint}
          radius={radius}
          fillColor={circleFillColor}
          strokeColor={theme.color.interactive.brand.default}
          strokeWidth={1.5}
          testID={testID ? `${testID}-circle` : undefined}
        />

        {/* [ADDED] Markers participants */}
        {participants.map((participant) => (
          <Marker
            key={participant.id}
            coordinate={participant.startLocation.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={`${participant.displayName}, ${participant.startLocation.formattedAddress}`}
            testID={testID ? `${testID}-marker-${participant.id}` : undefined}
          >
            <View style={[styles.markerCircle, styles.participantMarker]}>
              <Text variant="caption" weight="bold" color="onBrand">
                {participant.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </Marker>
        ))}

        {/* [ADDED] Marker midpoint */}
        <Marker
          coordinate={midpoint}
          anchor={{ x: 0.5, y: 0.5 }}
          accessibilityLabel="Point de rencontre"
          testID={testID ? `${testID}-marker-midpoint` : undefined}
        >
          <View style={[styles.markerCircle, styles.midpointMarker]}>
            <Text variant="body" weight="bold" color="onBrand">
              ★
            </Text>
          </View>
        </Marker>

        {/* [ADDED] Markers POI */}
        {pois.map((poi) => {
          const Icon = getCategoryIcon(poi.category);
          return (
            <Marker
              key={poi.externalId}
              coordinate={poi.coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onPressPOI(poi)}
              accessibilityLabel={`${poi.name}, ${poi.category}`}
              testID={testID ? `${testID}-poi-${poi.externalId}` : undefined}
            >
              <View style={styles.poiMarker}>
                <Icon size={POI_ICON_SIZE} color={theme.color.text.primary} strokeWidth={2} />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: theme.radius.lg,
    },
    markerCircle: {
      borderRadius: theme.radius.full,
      borderWidth: 3,
      borderColor: theme.color.surface.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.elevation.md,
    },
    participantMarker: {
      width: PARTICIPANT_MARKER_SIZE,
      height: PARTICIPANT_MARKER_SIZE,
      backgroundColor: theme.color.interactive.accent.default,
    },
    midpointMarker: {
      width: MIDPOINT_MARKER_SIZE,
      height: MIDPOINT_MARKER_SIZE,
      backgroundColor: theme.color.interactive.brand.default,
    },
    poiMarker: {
      width: POI_MARKER_SIZE,
      height: POI_MARKER_SIZE,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.default,
      ...theme.elevation.sm,
    },
  });

export default POIMapView;
