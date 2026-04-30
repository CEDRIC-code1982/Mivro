/**
 * @file Screen.tsx
 * @description Atome Screen — wrapper safe-area + fond thémé du Design System.
 *              Screen atom — safe-area wrapper + themed background.
 *
 *              Combine SafeAreaView (insets) + View (background) + ScrollView optionnel.
 *              Combines SafeAreaView (insets) + View (background) + optional ScrollView.
 *
 * @example
 * ```tsx
 * // FR: Écran principal avec scroll
 * // EN: Main screen with scroll
 * <Screen background="primary" scrollable>
 *   <Text variant="h1">{t('title')}</Text>
 * </Screen>
 *
 * // FR: Écran secondaire sans scroll, insets top uniquement
 * // EN: Secondary screen without scroll, top inset only
 * <Screen background="secondary" edges={['top']}>
 *   <Text variant="body">{t('content')}</Text>
 * </Screen>
 * ```
 *
 * @module presentation/components/atoms/Screen
 */

import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '@core/theme';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

// [ADDED] Surface background variant — maps to theme.color.surface keys
type ScreenBackground = 'primary' | 'secondary' | 'tertiary';

/**
 * Props du composant Screen.
 * Screen component props.
 *
 * @param children - Contenu de l'écran / Screen content
 * @param edges - Côtés safe-area à respecter / Safe area edges (default: all 4)
 * @param background - Couleur de surface du fond / Background surface color (default: 'primary')
 * @param scrollable - Envelopper dans un ScrollView / Wrap in ScrollView (default: false)
 * @param style - Style override additionnel / Additional style override
 * @param testID - Identifiant de test / Test identifier
 */
export interface ScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  background?: ScreenBackground;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

/**
 * Atome Screen du Design System MidPoint.
 * MidPoint Design System Screen atom.
 *
 * Fournit un conteneur safe-area avec fond thémé et padding horizontal.
 * Provides a safe-area container with themed background and horizontal padding.
 *
 * @param props - {@link ScreenProps}
 * @returns Composant Screen stylé / Styled Screen component
 */
const Screen: React.FC<ScreenProps> = ({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  background = 'primary',
  scrollable = false,
  style,
  testID,
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme, background);

  // [ADDED] Contenu interne — View ou ScrollView selon la prop scrollable
  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, style]}
      testID={testID ? `${testID}-scroll` : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, style]}>{children}</View>
  );

  return (
    // [ADDED] SafeAreaView avec edges configurables et fond thémé
    <SafeAreaView style={styles.safeArea} edges={edges} testID={testID}>
      {content}
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (theme: Theme, background: ScreenBackground) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.surface[background],
    },
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
    },
  });

export default Screen;
