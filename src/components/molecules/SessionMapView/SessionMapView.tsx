/**
 * @file SessionMapView.tsx
 * @description Map view for a midpoint calculation session.
 *
 *              Displays participant markers, midpoint marker,
 *              and a zone circle around the midpoint.
 *
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

// [ADDED] SessionMapView molecule — interactive session map
import { useTheme, type Theme } from '@theme';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Text } from '@components/atoms';
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import type { RealtimeParticipant } from '@entities/RealtimeParticipant';

/**
 * SessionMapView component props.
 *
 * @param participants — participant list
 * @param midpoint — midpoint coordinates
 * @param radius — zone radius in meters
 * @param edgePadding — padding for fitToCoordinates (default 80)
 * @param testID — test identifier
 */
export interface SessionMapViewProps {
  readonly participants: readonly Participant[];
  readonly midpoint: Coordinates;
  readonly radius: number;
  /**
   * Live participant positions (F4 — Firebase real-time).
   *
   * Rendered with markers distinct (pulse/halo) from start points.
   * Empty or absent = no live markers (backward-compatible with F2).
   */
  readonly liveParticipants?: readonly RealtimeParticipant[];
  /** Padding for fitToCoordinates (default 80) */
  readonly edgePadding?: number;
  /**
   * Accessibility label summarizing the map content (A11Y-006).
   *
   * If provided, the map is announced as a single element by screen
   * readers (markers are not explorable — the parent list view is the
   * textual alternative).
   */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/**
 * Map view of a session with markers and zone circle.
 *
 * @param props — SessionMapViewProps
 * @returns SessionMapView component
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
  const { t } = useTranslation('map');
  const mapRef = useRef<MapView>(null);

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

  // Zone circle color with 15% opacity (hex 26)
  const circleFillColor = theme.color.map.strokeFill;

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
        {/* [ADDED] Zone circle around the midpoint */}
        <Circle
          center={midpoint}
          radius={radius}
          fillColor={circleFillColor}
          strokeColor={theme.color.map.stroke}
          strokeWidth={1.5}
          testID={testID ? `${testID}-circle` : undefined}
        />

        {/* [ADDED] Participant markers */}
        {participants.map((participant) => (
          <Marker
            key={participant.id}
            coordinate={participant.startLocation.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={`${participant.displayName}, ${participant.startLocation.formattedAddress}`}
            testID={testID ? `${testID}-marker-${participant.id}` : undefined}
          >
            <View style={[styles.markerCircle, styles.participantMarker]}>
              {/* onAccent: the fill is teal, white does not pass AA on it */}
              <Text variant="caption" weight="bold" color="onAccent">
                {participant.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </Marker>
        ))}

        {/* [ADDED] Midpoint marker (distinctive — star, larger) */}
        <Marker
          coordinate={midpoint}
          anchor={{ x: 0.5, y: 0.5 }}
          accessibilityLabel={t('markers.midpoint')}
          testID={testID ? `${testID}-marker-midpoint` : undefined}
        >
          <View style={[styles.markerCircle, styles.midpointMarker]}>
            <Text variant="body" weight="bold" color="onBrand">
              ★
            </Text>
          </View>
        </Marker>

        {/* [ADDED] F4 — Live participant markers (real-time).
            Distinct from start points: online/offline colored halo. */}
        {liveParticipants.map((live) => (
          <Marker
            key={`live-${live.participantId}`}
            coordinate={{ latitude: live.latitude, longitude: live.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            // [FIXED][I18N-001] No accessibilityLabel on the live marker: the
            // map is announced as a single image (accessibilityLabel set on the
            // parent container, which is `accessible`) and markers are not
            // individually explorable. The a11y text alternative is
            // LiveParticipantsList (A11Y-006). This avoids exposing a raw UUID
            // and a non-i18n string (consistent with the component docs).
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
    // [ADDED] F4 — Live marker (halo), distinct from start points.
    // [FIXED] Live markers unreadable on the map (J-021, J-067): they used
    // theme-relative tokens (`feedback.successBg`, `text.success`,
    // `surface.tertiary`, `border.strong`, `text.tertiary`), while map tiles
    // stay light in dark mode — ~1.78:1 online in dark mode, ~2.2:1 offline in
    // light mode. They now use the tile-relative `map.live*` tokens, identical
    // in both themes.
    liveMarker: {
      width: theme.size.marker.sm,
      height: theme.size.marker.sm,
      borderWidth: theme.borderWidth.thin,
    },
    liveMarkerOnline: {
      backgroundColor: theme.color.map.liveOnlineFill,
      borderColor: theme.color.map.liveOnline,
    },
    liveMarkerOffline: {
      backgroundColor: theme.color.map.liveOfflineFill,
      borderColor: theme.color.map.liveOffline,
    },
    liveDot: {
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.map.liveOnline,
    },
    liveDotOffline: {
      backgroundColor: theme.color.map.liveOffline,
    },
  });

export default SessionMapView;
