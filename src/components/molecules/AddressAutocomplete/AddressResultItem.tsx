/**
 * @file AddressResultItem.tsx
 * @description Item de résultat de recherche d'adresse pour la liste autocomplete.
 *              Address search result item for the autocomplete list.
 *
 * @example
 * ```tsx
 * <AddressResultItem
 *   result={geocodeResult}
 *   onPress={() => handleSelect(geocodeResult)}
 * />
 * ```
 *
 * @module presentation/components/molecules/AddressAutocomplete/AddressResultItem
 */

// [ADDED] AddressResultItem — item de la liste autocomplete

import { useTheme, type Theme } from '@theme';
import { MapPin } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/atoms/Text';
import type { GeocodeResult } from '@entities/GeocodeResult';

/**
 * Props du composant AddressResultItem.
 * AddressResultItem component props.
 *
 * @param result - Résultat de geocode / Geocode result
 * @param onPress - Callback au tap / Tap callback
 * @param testID - ID de test / Test ID
 */
export interface AddressResultItemProps {
  /** Résultat de geocode / Geocode result */
  result: GeocodeResult;
  /** Callback au tap / Tap callback */
  onPress: () => void;
  /** ID de test / Test ID */
  testID?: string;
}

/**
 * Item d'un résultat d'adresse dans la liste autocomplete.
 * Address result item in the autocomplete list.
 *
 * @param props - {@link AddressResultItemProps}
 * @returns Composant AddressResultItem / AddressResultItem component
 */
const AddressResultItem: React.FC<AddressResultItemProps> = ({ result, onPress, testID }) => {
  const theme = useTheme();
  const styles = buildStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : undefined]}
      accessibilityRole="button"
      accessibilityLabel={result.displayName}
      testID={testID}
    >
      <View style={styles.iconContainer}>
        <MapPin size={theme.typography.fontSize.bodyLg} color={theme.color.text.tertiary} />
      </View>
      <Text variant="body" numberOfLines={2} style={styles.text}>
        {result.displayName}
      </Text>
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

// [ADDED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.touchTarget.large,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    pressed: {
      backgroundColor: theme.color.surface.secondary,
    },
    iconContainer: {
      width: theme.spacing.xl,
      alignItems: 'center',
    },
    text: {
      flex: 1,
    },
  });

export default AddressResultItem;
