/**
 * @file AddressAutocomplete.tsx
 * @description Molecule AddressAutocomplete — saisie d'adresse avec recherche
 *              autocomplete via bottom sheet et bouton GPS.
 *              AddressAutocomplete molecule — address input with autocomplete
 *              search via bottom sheet and GPS button.
 *
 * @example
 * ```tsx
 * <AddressAutocomplete
 *   onSelectResult={(result) => addByGeocode(result)}
 *   onUseGps={() => addByGps()}
 *   isAddingByGps={isAddingByGps}
 *   isFull={isFull}
 * />
 * ```
 *
 * @module presentation/components/molecules/AddressAutocomplete
 */

// [MODIFIED] Molecule AddressAutocomplete — Phase 6 (bottom sheet ajouté)

import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { AlertCircle, MapPin, Search } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import { useTheme, type Theme } from '@core/theme';
import Text from '@presentation/components/atoms/Text';
import EmptyState from '@presentation/components/molecules/EmptyState';
import { useGeocodeQuery } from '@presentation/hooks/useGeocodeQuery';
import AddressResultItem from './AddressResultItem';

/**
 * Props du composant AddressAutocomplete.
 * AddressAutocomplete component props.
 *
 * @param onSelectResult - Callback quand un résultat est sélectionné / Callback on result selection
 * @param onUseGps - Callback quand le bouton GPS est pressé / Callback on GPS button press
 * @param isAddingByGps - Loading state GPS / GPS loading state
 * @param isFull - Session pleine (5 participants) / Session full (5 participants)
 * @param testID - ID de test / Test ID
 */
export interface AddressAutocompleteProps {
  /** Callback quand un résultat est sélectionné / Callback on result selection */
  onSelectResult: (result: GeocodeResult, displayName?: string) => void;
  /** Callback quand le bouton GPS est pressé / Callback on GPS button press */
  onUseGps: (displayName?: string) => void;
  /** Loading state GPS / GPS loading state */
  isAddingByGps?: boolean;
  /** Session pleine (5 participants) / Session full (5 participants) */
  isFull?: boolean;
  /** ID de test / Test ID */
  testID?: string;
}

/** Longueur minimum de la query pour déclencher la recherche */
const MIN_QUERY_LENGTH = 3;

/**
 * Molecule AddressAutocomplete du Design System Mivro.
 * Mivro Design System AddressAutocomplete molecule.
 *
 * Input adresse + input nom + bouton GPS + bottom sheet autocomplete.
 *
 * @param props - {@link AddressAutocompleteProps}
 * @returns Composant AddressAutocomplete / AddressAutocomplete component
 */
const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onSelectResult,
  onUseGps,
  isAddingByGps = false,
  isFull = false,
  testID,
}) => {
  const { t } = useTranslation('create');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // [ADDED] État local
  const [query, setQuery] = useState('');
  const [pendingDisplayName, setPendingDisplayName] = useState('');

  // [ADDED] Bottom sheet ref + snap points
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  // [ADDED] TanStack Query pour l'autocomplete
  const { data: results, isLoading, error } = useGeocodeQuery({ query });

  /**
   * Ouvre le bottom sheet au focus de l'input adresse.
   * Opens the bottom sheet on address input focus.
   */
  const handleAddressFocus = useCallback(() => {
    sheetRef.current?.snapToIndex(0);
    console.log(
      `[INFO][AddressAutocomplete][onFocus][?][${new Date().toISOString().slice(11, 19)}] ` +
        'Bottom sheet opened',
    );
  }, []);

  /**
   * Ferme le bottom sheet.
   * Closes the bottom sheet.
   */
  const handleCloseSheet = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  // [FIXED P0-3] Backdrop empêchant le contenu de transparaître
  // Backdrop preventing content from showing behind the sheet
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
    ),
    [],
  );

  /**
   * Gère la sélection d'un résultat.
   * Handles result selection.
   *
   * @param result - Résultat sélectionné / Selected result
   */
  const handleSelectResult = useCallback(
    (result: GeocodeResult) => {
      onSelectResult(result, pendingDisplayName || undefined);
      sheetRef.current?.close();
      setQuery('');
      Keyboard.dismiss();
      console.log(
        `[INFO][AddressAutocomplete][selectResult][?][${new Date().toISOString().slice(11, 19)}] ` +
          'Result selected, sheet closed',
      );
    },
    [onSelectResult, pendingDisplayName],
  );

  /**
   * Gère le clic sur le bouton GPS.
   * Handles GPS button press.
   */
  const handleUseGps = useCallback(() => {
    onUseGps(pendingDisplayName || undefined);
  }, [onUseGps, pendingDisplayName]);

  /**
   * Rendu du contenu conditionnel du bottom sheet.
   * Renders the conditional bottom sheet content.
   */
  const renderSheetContent = () => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return (
        <EmptyState
          icon={Search}
          title={t('autocomplete.minLength')}
          {...(testID != null && { testID: `${testID}-min-length` })}
        />
      );
    }

    if (isLoading) {
      return (
        <View
          style={styles.loadingContainer}
          {...(testID != null && { testID: `${testID}-loading` })}
        >
          <ActivityIndicator size="large" color={theme.color.interactive.brand.default} />
          <Text variant="small" color="secondary">
            {t('autocomplete.loading')}
          </Text>
        </View>
      );
    }

    if (error != null) {
      return (
        <EmptyState
          icon={AlertCircle}
          title={t('autocomplete.noResults')}
          description={t('autocomplete.noResultsHint')}
          {...(testID != null && { testID: `${testID}-error` })}
        />
      );
    }

    if (results == null || results.length === 0) {
      return (
        <EmptyState
          icon={Search}
          title={t('autocomplete.noResults')}
          description={t('autocomplete.noResultsHint')}
          {...(testID != null && { testID: `${testID}-empty` })}
        />
      );
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.externalId}
        renderItem={({ item }) => (
          <AddressResultItem
            result={item}
            onPress={() => handleSelectResult(item)}
            {...(testID != null && { testID: `${testID}-result-${item.externalId}` })}
          />
        )}
        keyboardShouldPersistTaps="handled"
        {...(testID != null && { testID: `${testID}-results-list` })}
      />
    );
  };

  const isDisabled = isFull;

  return (
    <>
      <View style={styles.container} testID={testID}>
        {/* [ADDED] Input nom (optionnel) */}
        <View style={styles.inputWrapper}>
          <TextInput
            value={pendingDisplayName}
            onChangeText={setPendingDisplayName}
            placeholder={t('autocomplete.namePlaceholder')}
            placeholderTextColor={theme.color.text.tertiary}
            style={[styles.textInput, isDisabled ? styles.inputDisabled : undefined]}
            editable={!isDisabled}
            accessibilityLabel={t('autocomplete.nameLabel')}
            accessibilityHint={t('autocomplete.nameHint')}
            testID={testID ? `${testID}-name-input` : undefined}
          />
        </View>

        {/* [MODIFIED] Input adresse — au focus, ouvre le bottom sheet */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputWithIcon}>
            <Search size={theme.typography.fontSize.body} color={theme.color.text.tertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={handleAddressFocus}
              placeholder={t('autocomplete.addressPlaceholder')}
              placeholderTextColor={theme.color.text.tertiary}
              style={[styles.textInputFlex, isDisabled ? styles.inputDisabled : undefined]}
              editable={!isDisabled}
              accessibilityLabel={t('autocomplete.addressLabel')}
              accessibilityHint={t('autocomplete.addressHint')}
              testID={testID ? `${testID}-address-input` : undefined}
            />
          </View>
        </View>

        {/* [ADDED] Bouton "Ma position" */}
        <Pressable
          onPress={handleUseGps}
          disabled={isDisabled || isAddingByGps}
          style={({ pressed }) => [
            styles.gpsButton,
            pressed ? styles.gpsButtonPressed : undefined,
            isDisabled ? styles.gpsButtonDisabled : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('autocomplete.useGps')}
          accessibilityHint={t('autocomplete.useGpsHint')}
          accessibilityState={{ disabled: isDisabled || isAddingByGps }}
          testID={testID ? `${testID}-gps-button` : undefined}
        >
          {isAddingByGps ? (
            <ActivityIndicator size="small" color={theme.color.interactive.brand.default} />
          ) : (
            <MapPin
              size={theme.typography.fontSize.bodyLg}
              color={theme.color.interactive.brand.default}
            />
          )}
          <Text variant="body" weight="semibold" color={isDisabled ? 'tertiary' : 'brand'}>
            {t('autocomplete.useGps')}
          </Text>
        </Pressable>
      </View>

      {/* [ADDED] Bottom Sheet — autocomplete résultats */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        onClose={handleCloseSheet}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        {...(testID != null && { testID: `${testID}-bottom-sheet` })}
      >
        <BottomSheetView style={styles.sheetContent}>
          {/* [ADDED] Input dans le sheet pour continuer la saisie */}
          <View
            style={styles.sheetInputWrapper}
            {...(testID != null && { testID: `${testID}-sheet` })}
          >
            <Search size={theme.typography.fontSize.body} color={theme.color.text.tertiary} />
            <BottomSheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('autocomplete.addressPlaceholder')}
              placeholderTextColor={theme.color.text.tertiary}
              style={styles.sheetTextInput}
              autoFocus
              accessibilityLabel={t('autocomplete.addressLabel')}
              {...(testID != null && { testID: `${testID}-sheet-input` })}
            />
          </View>

          {/* [ADDED] Contenu conditionnel */}
          {renderSheetContent()}
        </BottomSheetView>
      </BottomSheet>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

// [MODIFIED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    inputWrapper: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface.primary,
    },
    inputWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    textInput: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      fontFamily: theme.typography.fontFamily.sans,
      fontSize: theme.typography.fontSize.body,
      color: theme.color.text.primary,
      minHeight: theme.touchTarget.min,
    },
    textInputFlex: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingRight: theme.spacing.md,
      fontFamily: theme.typography.fontFamily.sans,
      fontSize: theme.typography.fontSize.body,
      color: theme.color.text.primary,
      minHeight: theme.touchTarget.min,
    },
    inputDisabled: {
      opacity: 0.5,
    },
    gpsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.color.interactive.brand.default,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
    },
    gpsButtonPressed: {
      backgroundColor: theme.color.surface.secondary,
    },
    gpsButtonDisabled: {
      borderColor: theme.color.border.subtle,
      opacity: 0.5,
    },
    // [ADDED] Bottom sheet styles
    sheetBackground: {
      backgroundColor: theme.color.surface.primary,
    },
    sheetHandle: {
      backgroundColor: theme.color.border.default,
    },
    sheetContent: {
      flex: 1,
      paddingBottom: theme.spacing.lg,
    },
    sheetInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      paddingLeft: theme.spacing.md,
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface.secondary,
    },
    sheetTextInput: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingRight: theme.spacing.md,
      fontFamily: theme.typography.fontFamily.sans,
      fontSize: theme.typography.fontSize.body,
      color: theme.color.text.primary,
      minHeight: theme.touchTarget.min,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
  });

export default AddressAutocomplete;
