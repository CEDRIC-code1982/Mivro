/**
 * @file Text.tsx
 * @description Atome Text — composant typographique du Design System.
 *              Text atom — Design System typographic component.
 *
 *              Mappe les variants, weights et couleurs sur les tokens du thème.
 *              Maps variants, weights and colors to theme tokens.
 *
 *              Supporte Dynamic Type via `allowFontScaling` (A11Y-004).
 *              Supports Dynamic Type via `allowFontScaling` (A11Y-004).
 *
 * @example
 * ```tsx
 * // FR: Titre principal en gras, couleur brand
 * // EN: Bold main title, brand color
 * <Text variant="h1" weight="bold" color="brand">
 *   {t('title')}
 * </Text>
 *
 * // FR: Corps de texte secondaire centré
 * // EN: Centered secondary body text
 * <Text variant="body" color="secondary" align="center">
 *   {t('description')}
 * </Text>
 * ```
 *
 * @module presentation/components/atoms/Text
 */

import { useTheme, type Theme } from '@theme';
import React from 'react';
import {
  Text as RNText,
  StyleSheet,
  type AccessibilityRole,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

// [ADDED] Variant type — maps to theme.typography.fontSize keys
type TextVariant = 'caption' | 'small' | 'body' | 'bodyLg' | 'h4' | 'h3' | 'h2' | 'h1' | 'display';

// [ADDED] Weight type — maps to theme.typography.fontWeight keys
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

// [ADDED] Semantic color type — maps to theme.color.text keys
type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'brand'
  | 'error'
  | 'success'
  | 'warning'
  | 'onBrand';

// [ADDED] Text alignment type
type TextAlign = 'left' | 'center' | 'right';

/**
 * Props du composant Text.
 * Text component props.
 *
 * @param children - Contenu textuel / Text content
 * @param variant - Variante typographique / Typographic variant (default: 'body')
 * @param weight - Graisse de la police / Font weight (default: 'regular')
 * @param color - Couleur sémantique / Semantic color (default: 'primary')
 * @param align - Alignement du texte / Text alignment (default: 'left')
 * @param numberOfLines - Nombre max de lignes / Max number of lines
 * @param accessibilityRole - Rôle a11y / Accessibility role
 * @param style - Style override additionnel / Additional style override
 */
export interface TextProps extends Omit<RNTextProps, 'style'> {
  children: React.ReactNode;
  variant?: TextVariant;
  weight?: TextWeight;
  color?: TextColor;
  align?: TextAlign;
  numberOfLines?: number;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<TextStyle>;
}

// ═══════════════════════════════════════════════════════════════
// LINE HEIGHT MAPPING
// ═══════════════════════════════════════════════════════════════

// [ADDED] Maps variant to appropriate line height multiplier
// Titres → tight (1.2), corps → normal (1.4), caption/small → relaxed (1.6)
const variantLineHeightMap: Record<TextVariant, 'tight' | 'normal' | 'relaxed'> = {
  display: 'tight',
  h1: 'tight',
  h2: 'tight',
  h3: 'tight',
  h4: 'tight',
  bodyLg: 'normal',
  body: 'normal',
  small: 'relaxed',
  caption: 'relaxed',
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

/**
 * Atome Text du Design System Mivro.
 * Mivro Design System Text atom.
 *
 * Mappe les variants, weights et couleurs sur les tokens du thème actif.
 * Maps variants, weights and colors to the active theme tokens.
 *
 * @param props - {@link TextProps}
 * @returns Composant Text stylé / Styled Text component
 */
const Text: React.FC<TextProps> = ({
  children,
  variant = 'body',
  weight = 'regular',
  color = 'primary',
  align = 'left',
  style,
  ...rest
}) => {
  const theme = useTheme();
  const styles = buildStyles(theme, variant, weight, color, align);

  return (
    // [ADDED] allowFontScaling=true pour Dynamic Type (A11Y-004)
    <RNText allowFontScaling={true} style={[styles.text, style]} {...rest}>
      {children}
    </RNText>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (
  theme: Theme,
  variant: TextVariant,
  weight: TextWeight,
  color: TextColor,
  align: TextAlign,
) =>
  StyleSheet.create({
    text: {
      fontFamily: theme.typography.fontFamily.sans,
      fontSize: theme.typography.fontSize[variant],
      fontWeight: theme.typography.fontWeight[weight],
      lineHeight:
        theme.typography.fontSize[variant] *
        theme.typography.lineHeight[variantLineHeightMap[variant]],
      letterSpacing: theme.typography.letterSpacing.normal,
      color: theme.color.text[color],
      textAlign: align,
    },
  });

export default Text;
