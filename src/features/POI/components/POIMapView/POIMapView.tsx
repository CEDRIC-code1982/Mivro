/**
 * @file POIMapView.tsx
 * @description POIMapView molecule — map with participant markers,
 *              midpoint, zone circle AND POI markers, plus a status banner
 *              for the loading, error and empty states (ERR-003).
 *
 *              Component independent from SessionMapView (MVP option 2)
 *              to avoid coupling F2 and F3.
 *
 * @example
 * ```tsx
 * <POIMapView
 *   participants={session.participants}
 *   midpoint={midpoint}
 *   radius={radius}
 *   pois={filteredPois}
 *   onPressPOI={(poi) => setSelectedPOI(poi)}
 *   isLoading={isLoading}
 *   error={error}
 * />
 * ```
 *
 * @module features/POI/components/POIMapView/POIMapView
 */

// [ADDED] POIMapView molecule — map with POI markers

import { useTheme, type Theme } from '@theme';
import { AlertCircle, SearchX } from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Text } from '@components/atoms';
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { poiErrorKey } from '@features/POI/utils/poiErrorKey';
import { getCategoryIcon } from '@features/POI/utils/poiIcons';

/**
 * POIMapView component props.
 *
 * @param participants — Participant list
 * @param midpoint — Midpoint coordinates
 * @param radius — Zone radius in meters
 * @param pois — POI list to display
 * @param onPressPOI — POI marker tap callback
 * @param isLoading — POI search in progress (status banner with a spinner)
 * @param error — POI search error (status banner with the translated message)
 * @param testID — Test identifier
 */
export interface POIMapViewProps {
  readonly participants: readonly Participant[];
  readonly midpoint: Coordinates;
  readonly radius: number;
  readonly pois: readonly PointOfInterest[];
  readonly onPressPOI: (poi: PointOfInterest) => void;
  /** POI search in progress */
  readonly isLoading?: boolean;
  /** POI search error */
  readonly error?: Error | null | undefined;
  readonly testID?: string;
}

/** POI marker size */
const POI_MARKER_SIZE = 32;
/** Icon size inside the POI marker */
const POI_ICON_SIZE = 16;
/** Participant marker size */
const PARTICIPANT_MARKER_SIZE = 36;
/** Midpoint marker size */
const MIDPOINT_MARKER_SIZE = 48;
/** Padding for fitToCoordinates */
const EDGE_PADDING = 80;
/** Icon size inside the status banner */
const BANNER_ICON_SIZE = 20;

/** Search state shown by the status banner; `null` when POIs are displayed. */
type MapStatus = 'loading' | 'error' | 'empty' | null;

/**
 * Mivro Design System POIMapView molecule.
 *
 * Full map with participants, midpoint, zone and POI markers. While the search runs, fails or
 * returns nothing, a banner at the top of the map says so, with the same priority and texts as
 * POIListView (loading > error > empty); the map stays usable underneath.
 *
 * @param props — {@link POIMapViewProps}
 * @returns POIMapView component
 */
const POIMapView: React.FC<POIMapViewProps> = ({
  participants,
  midpoint,
  radius,
  pois,
  onPressPOI,
  isLoading = false,
  error = null,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation('poi');
  const mapRef = useRef<MapView>(null);

  // Auto-fit on all points when the map is ready
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

  // Zone circle fill color, 15% opacity
  const circleFillColor = theme.color.map.strokeFill;

  // [FIXED] "Vue carte POI sans état loading ni error": a failed or empty search left a map
  // without any marker or explanation (ERR-003).
  const status: MapStatus = isLoading
    ? 'loading'
    : error != null
    ? 'error'
    : pois.length === 0
    ? 'empty'
    : null;

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

        {/* [ADDED] Midpoint marker */}
        <Marker
          coordinate={midpoint}
          anchor={{ x: 0.5, y: 0.5 }}
          accessibilityLabel={t('mapView.midpointMarker')}
          testID={testID ? `${testID}-marker-midpoint` : undefined}
        >
          <View style={[styles.markerCircle, styles.midpointMarker]}>
            <Text variant="body" weight="bold" color="onBrand">
              ★
            </Text>
          </View>
        </Marker>

        {/* [ADDED] POI markers */}
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
              {/* [FIXED P0-5] pointerEvents="none" prevents View from intercepting Marker touch */}
              <View style={styles.poiMarker} pointerEvents="none">
                <Icon size={POI_ICON_SIZE} color={theme.color.text.primary} strokeWidth={2} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* [ADDED] Status banner over the map; box-none keeps the map pannable around it */}
      {status !== null && (
        <View
          style={styles.bannerContainer}
          pointerEvents="box-none"
          testID={testID ? `${testID}-status` : undefined}
        >
          <MapStatusBanner status={status} error={error} testID={testID} />
        </View>
      )}
    </View>
  );
};

/**
 * MapStatusBanner props.
 *
 * @param status — Search state to show
 * @param error — Search error (read when status is 'error')
 * @param testID — Test identifier of the parent map view
 */
interface MapStatusBannerProps {
  readonly status: Exclude<MapStatus, null>;
  readonly error: Error | null;
  readonly testID: string | undefined;
}

/**
 * Banner shown at the top of the POI map while the search is loading, failed or found nothing.
 * Same texts as POIListView. The error is announced as an alert; loading and empty go through a
 * polite live region.
 *
 * @param props — {@link MapStatusBannerProps}
 * @returns The rendered banner
 */
const MapStatusBanner: React.FC<MapStatusBannerProps> = ({ status, error, testID }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation('poi');

  const title =
    status === 'loading'
      ? t('list.loading')
      : status === 'error'
      ? t('errors.title')
      : t('list.empty.title');
  const description =
    status === 'error'
      ? t(poiErrorKey(error ?? new Error()))
      : status === 'empty'
      ? t('list.empty.description')
      : null;

  return (
    <View
      style={[styles.banner, status === 'error' && styles.bannerError]}
      accessible
      accessibilityRole={status === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      accessibilityLabel={description === null ? title : `${title}. ${description}`}
      testID={testID ? `${testID}-status-${status}` : undefined}
    >
      {status === 'loading' ? (
        <ActivityIndicator size="small" color={theme.color.text.brand} />
      ) : status === 'error' ? (
        <AlertCircle size={BANNER_ICON_SIZE} color={theme.color.text.error} strokeWidth={2} />
      ) : (
        <SearchX size={BANNER_ICON_SIZE} color={theme.color.text.secondary} strokeWidth={2} />
      )}
      <View style={styles.bannerText}>
        <Text variant="body" weight="semibold">
          {title}
        </Text>
        {description !== null && (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        )}
      </View>
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
      borderWidth: theme.borderWidth.thick,
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
    bannerContainer: {
      position: 'absolute',
      top: theme.spacing.md,
      left: theme.spacing.md,
      right: theme.spacing.md,
    },
    // Opaque surface: the text keeps its AA contrast whatever map tiles lie underneath
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface.primary,
      borderWidth: theme.borderWidth.hairline,
      borderColor: theme.color.border.default,
      ...theme.elevation.md,
    },
    bannerError: {
      borderColor: theme.color.border.error,
    },
    bannerText: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });

export default POIMapView;
