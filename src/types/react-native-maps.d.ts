/**
 * @file react-native-maps.d.ts
 * @description Type declarations pour react-native-maps.
 *              Overrides les types source de la lib qui ne sont pas compatibles
 *              avec exactOptionalPropertyTypes: true.
 *
 *              Ne déclare que les types utilisés dans le projet.
 *
 * @module types/react-native-maps.d
 */

// [ADDED] Déclaration locale react-native-maps (compatibilité TS strict)
declare module 'react-native-maps' {
  import type { Component } from 'react';
  import type { ViewProps } from 'react-native';

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface EdgePadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }

  export interface MapViewProps extends ViewProps {
    provider?: 'google' | null | undefined;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsCompass?: boolean;
    showsScale?: boolean;
    toolbarEnabled?: boolean;
    initialRegion?: Region;
    region?: Region;
    onMapReady?: () => void;
    onRegionChange?: (region: Region) => void;
    onRegionChangeComplete?: (region: Region) => void;
  }

  export default class MapView extends Component<MapViewProps> {
    fitToCoordinates(
      coordinates: LatLng[],
      options?: {
        edgePadding?: EdgePadding;
        animated?: boolean;
      },
    ): void;
    animateToRegion(region: Region, duration?: number): void;
  }

  export interface MarkerProps extends ViewProps {
    coordinate: LatLng;
    title?: string;
    description?: string;
    anchor?: { x: number; y: number };
    calloutAnchor?: { x: number; y: number };
    flat?: boolean;
    draggable?: boolean;
    onPress?: () => void;
    onDragEnd?: (e: { nativeEvent: { coordinate: LatLng } }) => void;
    children?: React.ReactNode;
  }

  export class Marker extends Component<MarkerProps> {}

  export interface CircleProps extends ViewProps {
    center: LatLng;
    radius: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  }

  export class Circle extends Component<CircleProps> {}

  export const PROVIDER_GOOGLE: 'google';
}
