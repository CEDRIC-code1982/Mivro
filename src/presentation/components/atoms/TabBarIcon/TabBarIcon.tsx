/**
 * @file TabBarIcon.tsx
 * @description Atome TabBarIcon — wrapper Lucide pour les icônes de tab bar.
 *              TabBarIcon atom — Lucide wrapper for tab bar icons.
 *
 *              Applique les couleurs focused/unfocused depuis le thème
 *              et ajuste le strokeWidth pour l'état actif.
 *              Applies focused/unfocused colors from theme
 *              and adjusts strokeWidth for active state.
 *
 * @example
 * ```tsx
 * // FR: Icône de tab active
 * // EN: Active tab icon
 * import { MapPin } from 'lucide-react-native';
 * <TabBarIcon icon={MapPin} focused={true} accessibilityLabel={t('navigation:tabs.map')} />
 *
 * // FR: Icône de tab inactive, taille custom
 * // EN: Inactive tab icon, custom size
 * <TabBarIcon icon={User} focused={false} size={28} accessibilityLabel={t('navigation:tabs.profile')} />
 * ```
 *
 * @module presentation/components/atoms/TabBarIcon
 */

import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@core/theme';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

// [ADDED] StrokeWidth pour état focused/unfocused
const STROKE_WIDTH_FOCUSED = 2.5;
const STROKE_WIDTH_DEFAULT = 2;

/**
 * Props du composant TabBarIcon.
 * TabBarIcon component props.
 *
 * @param icon - Composant icône Lucide / Lucide icon component
 * @param focused - État actif de l'onglet / Tab active state
 * @param size - Taille de l'icône / Icon size (default: 24)
 * @param accessibilityLabel - Label a11y OBLIGATOIRE / Required a11y label
 */
export interface TabBarIconProps {
  icon: LucideIcon;
  focused: boolean;
  size?: number;
  accessibilityLabel: string;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

/**
 * Atome TabBarIcon du Design System Mivro.
 * Mivro Design System TabBarIcon atom.
 *
 * Wrapper léger autour des icônes Lucide, appliquant les couleurs
 * et épaisseurs de trait du thème selon l'état focused.
 * Lightweight wrapper around Lucide icons, applying theme colors
 * and stroke widths based on focused state.
 *
 * @param props - {@link TabBarIconProps}
 * @returns Composant TabBarIcon stylé / Styled TabBarIcon component
 */
const TabBarIcon: React.FC<TabBarIconProps> = ({
  icon: Icon,
  focused,
  size = 24,
  accessibilityLabel,
}) => {
  const theme = useTheme();

  // [ADDED] Couleur selon l'état focused — tokens thème (DS-001)
  const color = focused ? theme.color.interactive.brand.default : theme.color.text.tertiary;

  // [ADDED] StrokeWidth plus épais quand actif — effet visuel
  const strokeWidth = focused ? STROKE_WIDTH_FOCUSED : STROKE_WIDTH_DEFAULT;

  return (
    // [ADDED] View wrapper pour a11y — accessibilityLabel obligatoire (A11Y-003)
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <Icon size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
};

export default TabBarIcon;
