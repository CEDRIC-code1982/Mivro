/**
 * @file SessionMapView.tsx
 * @description Vue cartographique d'une session de calcul midpoint.
 *              Map view for a midpoint calculation session.
 *
 *              Affiche les markers des participants, le marker midpoint
 *              et un cercle de zone autour du midpoint.
 *              Displays participant markers, midpoint marker,
 *              and a zone circle around the midpoint.
 *
 *              Note a11y : la carte n'est pas accessible aux lecteurs
 *              d'écran. Une vue liste alternative DOIT être proposée
 *              au niveau de l'écran parent (MapScreen — A11Y-006).
 *              A11y note: the map is not accessible to screen readers.
 *              A textual list alternative MUST be provided by the parent
 *              screen (MapScreen — A11Y-006).
 *
 * @example
 *   <SessionMapView
 *     participants={participants}
 *     midpoint={midpoint}
 *     radius={radius}
 *   />
 *
 * @module presentation/components/molecules/SessionMapView
 */

// [ADDED] Molecule SessionMapView — carte interactive session
import React, { useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Coordinates } from '@core/entities/Location';
import type { Participant } from '@core/entities/MidpointSession';
import { useTheme, type Theme } from '@core/theme';
import { Text } from '@presentation/components/atoms';

/**
 * Props du composant SessionMapView.
 * SessionMapView component props.
 *
 * @param participants — liste des participants / participant list
 * @param midpoint — coordonnées du midpoint / midpoint coordinates
 * @param radius — rayon de zone en mètres / zone radius in meters
 * @param edgePadding — padding pour fitToCoordinates (défaut 80) / padding for fitToCoordinates (default 80)
 * @param testID — identifiant de test / test identifier
 */
export interface SessionMapViewProps {
  readonly participants: readonly Participant[];
  readonly midpoint: Coordinates;
  readonly radius: number;
  /** Padding pour fitToCoordinates (défaut 80) / Padding for fitToCoordinates (default 80) */
  readonly edgePadding?: number;
  readonly testID?: string;
}

/**
 * Vue cartographique d'une session avec markers et cercle de zone.
 * Map view of a session with markers and zone circle.
 *
 * @param props — SessionMapViewProps
 * @returns Composant SessionMapView / SessionMapView component
 */
const SessionMapView: React.FC<SessionMapViewProps> = ({
  participants,
  midpoint,
  radius,
  edgePadding = 80,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const mapRef = useRef<MapView>(null);

  // Centrage automatique sur tous les points + midpoint
  // Auto-fit on all points + midpoint when map is ready
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || participants.length === 0) return;

    const allCoords = [...participants.map((p) => p.startLocation.coordinates), midpoint];

    mapRef.current.fitToCoordinates(allCoords, {
      edgePadding: {
        top: edgePadding,
        right: edgePadding,
        bottom: edgePadding,
        left: edgePadding,
      },
      animated: true,
    });
  }, [participants, midpoint, edgePadding]);

  // Couleur du cercle de zone avec 15% opacité (hex 26)
  // Zone circle color with 15% opacity (hex 26)
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

        {/* [ADDED] Marker midpoint (distinctif — étoile, plus gros) */}
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
      </MapView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

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
      width: 36,
      height: 36,
      backgroundColor: theme.color.interactive.accent.default,
    },
    midpointMarker: {
      width: 48,
      height: 48,
      backgroundColor: theme.color.interactive.brand.default,
    },
  });

export default SessionMapView;
