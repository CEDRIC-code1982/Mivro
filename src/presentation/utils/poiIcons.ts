/**
 * @file poiIcons.ts
 * @description Mapping POICategory → Lucide icon component.
 *              Centralise les icônes utilisées dans toute la feature F3.
 *              Centralizes icons used throughout the F3 feature.
 *
 * @module presentation/utils/poiIcons
 */

// [ADDED] Mapping POICategory → icônes Lucide

import {
  Utensils,
  Coffee,
  Beer,
  Trees,
  Film,
  Landmark,
  ShoppingBag,
  Dumbbell,
  Hotel,
  MapPin,
  type LucideIcon,
} from 'lucide-react-native';
import type { POICategory } from '@core/entities/POICategory';

/**
 * Mapping catégorie POI → composant icône Lucide.
 * POI category → Lucide icon component mapping.
 */
export const POI_CATEGORY_ICONS: Record<POICategory, LucideIcon> = {
  restaurant: Utensils,
  cafe: Coffee,
  bar: Beer,
  park: Trees,
  cinema: Film,
  museum: Landmark,
  shop: ShoppingBag,
  sport: Dumbbell,
  hotel: Hotel,
};

/**
 * Icône fallback générique pour catégories inconnues.
 * Generic fallback icon for unknown categories.
 */
export const POI_GENERIC_ICON: LucideIcon = MapPin;

/**
 * Retourne l'icône Lucide correspondant à une catégorie POI.
 * Returns the Lucide icon matching a POI category.
 *
 * @param category — catégorie POI / POI category
 * @returns Composant icône Lucide / Lucide icon component
 */
export const getCategoryIcon = (category: POICategory): LucideIcon =>
  POI_CATEGORY_ICONS[category] ?? POI_GENERIC_ICON;
