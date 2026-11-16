/**
 * @file TabBarIcon.tsx
 * @description TabBarIcon atom — Lucide wrapper for tab bar icons.
 *
 *              Applies focused/unfocused colors from theme
 *              and adjusts strokeWidth for active state.
 *
 *              The icon is decorative: it is hidden from screen readers,
 *              since the tab button already carries its own label
 *              (`tabBarAccessibilityLabel` in the navigator).
 *
 * @example
 * ```tsx
 * // Active tab icon
 * import { MapPin } from 'lucide-react-native';
 * <TabBarIcon icon={MapPin} focused={true} />
 *
 * // Inactive tab icon, custom size
 * <TabBarIcon icon={User} focused={false} size={28} />
 * ```
 *
 * @module components/atoms/TabBarIcon/TabBarIcon
 */

import { useTheme } from '@theme';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

// [ADDED] StrokeWidth for focused/unfocused state
const STROKE_WIDTH_FOCUSED = 2.5;
const STROKE_WIDTH_DEFAULT = 2;

/**
 * TabBarIcon component props.
 *
 * @param icon - Lucide icon component
 * @param focused - Tab active state
 * @param size - Icon size (default: 24)
 */
export interface TabBarIconProps {
  icon: LucideIcon;
  focused: boolean;
  size?: number;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

/**
 * Mivro Design System TabBarIcon atom.
 *
 * Lightweight wrapper around Lucide icons, applying theme colors
 * and stroke widths based on focused state.
 *
 * @param props - {@link TabBarIconProps}
 * @returns Styled TabBarIcon component
 */
const TabBarIcon: React.FC<TabBarIconProps> = ({ icon: Icon, focused, size = 24 }) => {
  const theme = useTheme();

  // [ADDED] Color based on focused state — theme tokens (DS-001)
  const color = focused ? theme.color.text.brand : theme.color.text.tertiary;

  // [ADDED] Thicker strokeWidth when active — visual effect
  const strokeWidth = focused ? STROKE_WIDTH_FOCUSED : STROKE_WIDTH_DEFAULT;

  return (
    // [MODIFIED] A11Y-003 — Decorative icon: hidden from screen readers (iOS and
    // Android), the tab button announces its own label (tabBarAccessibilityLabel).
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Icon size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
};

export default TabBarIcon;
