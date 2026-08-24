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
 * @module components/molecules/SessionMapView/SessionMapView
 */

// [ADDED] Molecule SessionMapView — carte interactive session
import { useTheme, type Theme } from '@theme';
import React, { useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Text } from '@components/atoms';
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import type { RealtimeParticipant } from '@entities/RealtimeParticipant';

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
  /**
   * Positions live des participants (F4 — temps réel Firebase).
   * Live participant positions (F4 — Firebase real-time).
   *
   * Affichées par des markers distincts (pulsation/halo) des points de départ.
   * Vides ou absentes = aucun marker live (rétro-compatible F2).
   * Rendered with markers distinct (halo) from start points.
   * Empty or absent = no live markers (backward-compatible with F2).
   */
  readonly liveParticipants?: readonly RealtimeParticipant[];
  /** Padding pour fitToCoordinates (défaut 80) / Padding for fitToCoordinates (default 80) */
  readonly edgePadding?: number;
  /**
   * Label d'accessibilité résumant le contenu de la carte (A11Y-006).
   * Accessibility label summarizing the map content (A11Y-006).
   *
   * Si fourni, la carte est annoncée comme un élément unique par les
   * lecteurs d'écran (les markers ne sont pas explorables — la vue liste
   * du parent est l'alternative textuelle).
   * If provided, the map is announced as a single element by screen
   * readers (markers are not explorable — the parent list view is the
   * textual alternative).
   */
  readonly accessibilityLabel?: string;
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
  liveParticipants = [],
  edgePadding = 80,
  accessibilityLabel,
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
    <View
      style={styles.container}
      testID={testID}
      {...(accessibilityLabel != null && {
        accessible: true,
        accessibilityRole: 'image' as const,
        accessibilityLabel,
      })}
    >
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
              {/* onAccent : le remplissage est teal, le blanc n'y passe pas AA */}
              <Text variant="caption" weight="bold" color="onAccent">
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

        {/* [ADDED] F4 — Markers live des participants (temps réel).
            Distincts des points de départ : halo coloré online/offline. */}
        {liveParticipants.map((live) => (
          <Marker
            key={`live-${live.participantId}`}
            coordinate={{ latitude: live.latitude, longitude: live.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            // [FIXED][I18N-001] Aucun accessibilityLabel sur le marker live : la
            // carte est annoncée comme une image unique (accessibilityLabel posé
            // sur le conteneur parent, qui est `accessible`) et les markers ne
            // sont pas explorables individuellement. L'alternative textuelle a11y
            // est LiveParticipantsList (A11Y-006). On évite ainsi d'exposer un
            // UUID brut et une string non i18n (cohérent avec la doc du composant).
            // No accessibilityLabel on the live marker: the map is a single
            // image; LiveParticipantsList is the a11y text alternative.
            testID={testID ? `${testID}-live-marker-${live.participantId}` : undefined}
          >
            <View
              style={[
                styles.markerCircle,
                styles.liveMarker,
                live.isOnline ? styles.liveMarkerOnline : styles.liveMarkerOffline,
              ]}
            >
              <View style={[styles.liveDot, live.isOnline ? undefined : styles.liveDotOffline]} />
            </View>
          </Marker>
        ))}
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
      borderWidth: theme.borderWidth.thick,
      borderColor: theme.color.surface.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.elevation.md,
    },
    participantMarker: {
      width: theme.size.marker.md,
      height: theme.size.marker.md,
      backgroundColor: theme.color.interactive.accent.default,
    },
    midpointMarker: {
      width: theme.size.marker.lg,
      height: theme.size.marker.lg,
      backgroundColor: theme.color.interactive.brand.default,
    },
    // [ADDED] F4 — Marker live (halo) distinct des points de départ
    liveMarker: {
      width: theme.size.marker.sm,
      height: theme.size.marker.sm,
      borderWidth: theme.borderWidth.thin,
    },
    liveMarkerOnline: {
      backgroundColor: theme.color.feedback.successBg,
      borderColor: theme.color.text.success,
    },
    liveMarkerOffline: {
      backgroundColor: theme.color.surface.tertiary,
      borderColor: theme.color.border.strong,
    },
    liveDot: {
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.text.success,
    },
    liveDotOffline: {
      backgroundColor: theme.color.text.tertiary,
    },
  });

export default SessionMapView;
