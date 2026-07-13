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

import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useTheme, type Theme } from '@theme';
import { AlertCircle, MapPin, Search } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '@components/atoms/Text';
import EmptyState from '@components/molecules/EmptyState';
import type { GeocodeResult } from '@entities/GeocodeResult';
import { useGeocodeQuery } from '@features/Session/hooks/useGeocodeQuery';
import { GeocodeError } from '@services/domain/geocode/IGeocodeService';
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
 * Mappe une erreur de géocodage vers une clé i18n de message dédiée.
 * Maps a geocoding error to a dedicated i18n message key.
 *
 * Distingue une erreur réseau/serveur d'une absence de résultat (bug QA P1).
 * Distinguishes a network/server error from an empty result set (QA P1 bug).
 *
 * @param error - Erreur remontée par useGeocodeQuery / Error surfaced by useGeocodeQuery
 * @returns Clé i18n (namespace create) / i18n key (create namespace)
 */
const geocodeErrorKey = (error: unknown): string => {
  if (error instanceof GeocodeError) {
    switch (error.code) {
      case 'network':
        return 'errors.geocode_network';
      case 'rate_limited':
        return 'errors.geocode_rate_limited';
      case 'server_error':
        return 'errors.geocode_server';
      default:
        return 'errors.unknown';
    }
  }
  return 'errors.unknown';
};

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
  // [FIXED P1] BottomSheetModal (portail) au lieu de BottomSheet pour éviter
  // que le sheet fermé s'affiche dans le ScrollView de l'écran (champ fantôme).
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  // [ADDED] TanStack Query pour l'autocomplete
  const { data: results, isLoading, error } = useGeocodeQuery({ query });

  /**
   * Ouvre le bottom sheet au focus de l'input adresse.
   * Opens the bottom sheet on address input focus.
   */
  const handleAddressFocus = useCallback(() => {
    sheetRef.current?.present();
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

  // [FIXED P0-3 / P1] Backdrop empêchant le contenu (et le texte) de transparaître
  // Backdrop preventing content/text from showing behind the sheet
  // [FIXED P1] Opacité augmentée (0.5 → 0.7) : l'EmptyState du sheet n'est plus
  // visuellement parasité par les textes de l'écran en arrière-plan.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.7} />
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
      sheetRef.current?.dismiss();
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
      // [FIXED P1] Message d'erreur réseau distinct de "aucun résultat" (ERR-001/003)
      // Network error message distinct from "no results" (ERR-001/003)
      return (
        <EmptyState
          icon={AlertCircle}
          title={t(geocodeErrorKey(error))}
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
      // [FIXED P1] BottomSheetFlatList : se redimensionne avec le sheet quand le
      // clavier s'ouvre, donc les résultats restent visibles au-dessus du clavier.
      <BottomSheetFlatList
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
        contentContainerStyle={styles.resultsListContent}
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
      {/* [FIXED P1] BottomSheetModal : présenté/dismissé via present()/dismiss(),
          rendu en overlay racine (plus de champ fantôme dans le ScrollView). */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        onDismiss={handleCloseSheet}
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
          {/* [FIXED P1] Corps en flex:1 — l'EmptyState/erreur occupe l'espace
              propre du sheet, sans superposition avec l'input ni le fond. */}
          <View style={styles.sheetBody}>{renderSheetContent()}</View>
        </BottomSheetView>
      </BottomSheetModal>
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
    // [FIXED P1] Corps du sheet (sous l'input) — occupe l'espace restant
    sheetBody: {
      flex: 1,
    },
    // [FIXED P1] Padding bas pour que le dernier résultat ne colle pas au clavier
    resultsListContent: {
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
