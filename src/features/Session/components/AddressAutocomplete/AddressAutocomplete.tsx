/**
 * @file AddressAutocomplete.tsx
 * @description AddressAutocomplete molecule — address input with autocomplete
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
 * @module features/Session/components/AddressAutocomplete/AddressAutocomplete
 */

// [MODIFIED] AddressAutocomplete molecule — Phase 6 (bottom sheet added)
// [MODIFIED] F5 — optional name field (`showNameField`), hidden on the join screen

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
 * AddressAutocomplete component props.
 *
 * @param onSelectResult - Callback on result selection
 * @param onUseGps - Callback on GPS button press
 * @param isAddingByGps - GPS loading state
 * @param isFull - Session full (5 participants)
 * @param showNameField - Whether the optional "Name" input is rendered (default true)
 * @param testID - Test ID
 */
export interface AddressAutocompleteProps {
  /** Callback on result selection */
  onSelectResult: (result: GeocodeResult, displayName?: string) => void;
  /** Callback on GPS button press */
  onUseGps: (displayName?: string) => void;
  /** GPS loading state */
  isAddingByGps?: boolean;
  /** Session full (5 participants) */
  isFull?: boolean;
  /**
   * Whether the optional "Name" input is rendered above the address input.
   * Defaults to `true` (session creation names each participant). Set it to
   * `false` when the caller has no use for a display name — e.g. the join
   * screen, where the participant's name comes from the user profile. When
   * hidden, `onSelectResult` and `onUseGps` always receive `undefined` as
   * `displayName`.
   */
  showNameField?: boolean;
  /** Test ID */
  testID?: string;
}

/** Minimum query length that triggers the search */
const MIN_QUERY_LENGTH = 3;

/**
 * Maps a geocoding error to a dedicated i18n message key.
 *
 * Distinguishes a network/server error from an empty result set (QA P1 bug).
 *
 * @param error - Error surfaced by useGeocodeQuery
 * @returns i18n key (create namespace)
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
 * Mivro Design System AddressAutocomplete molecule.
 *
 * Address input + optional name input + GPS button + autocomplete bottom sheet.
 *
 * @param props - {@link AddressAutocompleteProps}
 * @returns AddressAutocomplete component
 */
const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onSelectResult,
  onUseGps,
  isAddingByGps = false,
  isFull = false,
  showNameField = true,
  testID,
}) => {
  const { t } = useTranslation('create');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // [ADDED] Local state
  const [query, setQuery] = useState('');
  const [pendingDisplayName, setPendingDisplayName] = useState('');

  // [ADDED] Bottom sheet ref + snap points
  // [FIXED P1] BottomSheetModal (portal) instead of BottomSheet, so that the
  // closed sheet is not rendered inside the screen's ScrollView (ghost field).
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  // [ADDED] TanStack Query for the autocomplete
  const { data: results, isLoading, error } = useGeocodeQuery({ query });

  // [ADDED] F5 — a hidden name field never forwards a display name
  const displayName = showNameField && pendingDisplayName ? pendingDisplayName : undefined;

  /**
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
   * Closes the bottom sheet.
   */
  const handleCloseSheet = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  // [FIXED P0-3 / P1] Backdrop preventing content/text from showing behind the sheet
  // [FIXED P1] Opacity raised (0.5 → 0.7): the sheet's EmptyState is no longer
  // visually cluttered by the texts of the screen in the background.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.7} />
    ),
    [],
  );

  /**
   * Handles result selection.
   *
   * @param result - Selected result
   */
  const handleSelectResult = useCallback(
    (result: GeocodeResult) => {
      onSelectResult(result, displayName);
      sheetRef.current?.dismiss();
      setQuery('');
      Keyboard.dismiss();
      console.log(
        `[INFO][AddressAutocomplete][selectResult][?][${new Date().toISOString().slice(11, 19)}] ` +
          'Result selected, sheet closed',
      );
    },
    [onSelectResult, displayName],
  );

  /**
   * Handles GPS button press.
   */
  const handleUseGps = useCallback(() => {
    onUseGps(displayName);
  }, [onUseGps, displayName]);

  /**
   * Renders the conditional bottom sheet content.
   *
   * @returns The bottom sheet content
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
          <ActivityIndicator size="large" color={theme.color.text.brand} />
          <Text variant="small" color="secondary">
            {t('autocomplete.loading')}
          </Text>
        </View>
      );
    }

    if (error != null) {
      // [FIXED P1] Network error message distinct from "no results" (ERR-001/003)
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
      // [FIXED P1] BottomSheetFlatList: resizes with the sheet when the keyboard
      // opens, so the results stay visible above the keyboard.
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
        {/* [ADDED] Name input (optional) */}
        {/* [MODIFIED] F5 — rendered only when showNameField is true */}
        {showNameField ? (
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
        ) : null}

        {/* [MODIFIED] Address input — opens the bottom sheet on focus */}
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

        {/* [ADDED] "My location" button */}
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
            <ActivityIndicator size="small" color={theme.color.text.brand} />
          ) : (
            <MapPin size={theme.typography.fontSize.bodyLg} color={theme.color.text.brand} />
          )}
          <Text variant="body" weight="semibold" color={isDisabled ? 'tertiary' : 'brand'}>
            {t('autocomplete.useGps')}
          </Text>
        </Pressable>
      </View>

      {/* [ADDED] Bottom Sheet — autocomplete results */}
      {/* [FIXED P1] BottomSheetModal: presented/dismissed via present()/dismiss(),
          rendered as a root overlay (no more ghost field in the ScrollView). */}
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
          {/* [ADDED] Input inside the sheet to keep typing */}
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

          {/* [ADDED] Conditional content */}
          {/* [FIXED P1] Body with flex:1 — the EmptyState/error takes the sheet's
              own space, without overlapping the input or the background. */}
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
      borderColor: theme.color.text.brand,
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
    // [FIXED P1] Sheet body (below the input) — takes the remaining space
    sheetBody: {
      flex: 1,
    },
    // [FIXED P1] Bottom padding so the last result does not stick to the keyboard
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
