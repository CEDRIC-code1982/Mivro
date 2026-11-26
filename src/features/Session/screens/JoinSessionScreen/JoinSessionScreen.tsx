/**
 * @file JoinSessionScreen.tsx
 * @description F5 Screen — joining a shared session via deep link.
 *
 *              Opened by `mivro://session/{sessionId}` (React Navigation linking).
 *              [MODIFIED] "Jonction d'un invité sans profil ni session": the screen first asks
 *              for the guest's start point (GPS or address search through the shared
 *              `AddressAutocomplete` molecule, wired to `useJoinStartPoint`), shows it with
 *              "Join" / "Change", then triggers `JoinSessionUseCase` (member added + midpoint
 *              recomputed). It handles the loading / error / success states (ERR-003):
 *              - locating (GPS) → inline status on the choice view + spinner on the GPS button
 *              - geocoding in progress / no result / geocoding network error → handled inside
 *                the AddressAutocomplete bottom sheet
 *              - joining → loading view
 *              - GPS refused / unavailable / timeout → message on the choice view, the GPS button
 *                and the address search stay available to try again
 *              - expired / not found / closed link → i18n message + retry + cancel
 *              - success → switches to shared mode and offers to open the map
 *
 *              No empty state: the screen always has content to show (the start point choice,
 *              or the join outcome). There is no list or remote data that could come back empty.
 *
 *              Loading/error/success states, a11y (A11Y-003), theme tokens (DS).
 *
 * @module features/Session/screens/JoinSessionScreen/JoinSessionScreen
 */

// [ADDED] F5 — Shared session join screen
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme, type Theme } from '@theme';
import { AlertTriangle, CheckCircle2, MapPin } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@components/atoms';
import AddressAutocomplete from '@features/Session/components/AddressAutocomplete'; // [ADDED]
import { useJoinStartPoint } from '@features/Session/hooks/useJoinStartPoint'; // [ADDED]
import { useSessionShare } from '@features/Sharing/hooks/useSessionShare';
import type { RootStackParamList } from '@navigations/types';

/**
 * Internal state of the join screen.
 *
 * [MODIFIED] `choose` replaces the join started on open: the guest picks a start point first.
 * `joining` is the former `loading`.
 */
type JoinPhase = 'choose' | 'joining' | 'success' | 'error';

/**
 * Shared session join screen (F5 deep link).
 *
 * @returns JoinSessionScreen component
 */
const JoinSessionScreen: React.FC = () => {
  const { t } = useTranslation('share');
  const theme = useTheme();
  const styles = buildStyles(theme);

  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'JoinSession'>>();
  const sessionId = route.params?.sessionId ?? '';

  const { join, errorCode } = useSessionShare();
  // [ADDED] Start point chosen before joining (GPS or address)
  const {
    startLocation,
    isLocating,
    gpsErrorCode,
    addressUnresolved,
    locateByGps,
    selectAddress,
    clearStartLocation,
  } = useJoinStartPoint();
  // [MODIFIED] A link without a session id cannot be joined: straight to the error view, without
  // asking for a start point first.
  const [phase, setPhase] = useState<JoinPhase>(sessionId.length === 0 ? 'error' : 'choose');

  const runJoin = useCallback(async () => {
    if (sessionId.length === 0) {
      setPhase('error');
      return;
    }
    if (startLocation === null) {
      // Defensive: "Join" is only offered once a start point is chosen.
      setPhase('choose');
      return;
    }
    setPhase('joining');
    const ok = await join(sessionId, startLocation);
    setPhase(ok ? 'success' : 'error');
  }, [join, sessionId, startLocation]);

  // runJoin handles its own errors (setPhase('error')) and never rejects; the .catch is a
  // defensive safety net (should not trigger).
  const handleJoin = useCallback(() => {
    runJoin().catch(() => setPhase('error'));
  }, [runJoin]);

  // locateByGps never rejects (a failure sets gpsErrorCode); the .catch is a defensive safety net.
  const handleUseLocation = useCallback(() => {
    locateByGps().catch(() => undefined);
  }, [locateByGps]);

  const gpsErrorMessage = gpsErrorCode === null ? null : t(`startPointErrors.${gpsErrorCode}`);

  // VoiceOver ignores `accessibilityLiveRegion` (Android only): announce the GPS failure on iOS
  // each time it appears or changes, like MapScreen does for the real-time errors.
  useEffect(() => {
    if (gpsErrorMessage !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(gpsErrorMessage);
    }
  }, [gpsErrorMessage]);

  // [ADDED] Same for the locating status: announced on iOS when the GPS request starts.
  useEffect(() => {
    if (isLocating && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t('join.locatingTitle'));
    }
  }, [isLocating, t]);

  // [ADDED] Same for the offline notice: announced on iOS when the raw-coordinates point is shown.
  useEffect(() => {
    if (addressUnresolved && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t('join.gpsAddressUnresolved'));
    }
  }, [addressUnresolved, t]);

  const handleOpenMap = useCallback(() => {
    // Replace the join screen with the tabs (map) — no way back here.
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Map' } }] });
  }, [navigation]);

  const handleCancel = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Create' } }] });
  }, [navigation]);

  /**
   * Renders the "Cancel" link button, shared by the choice and error views.
   *
   * @returns Cancel button
   */
  const renderCancel = () => (
    <Pressable
      onPress={handleCancel}
      style={styles.linkButton}
      accessibilityRole="button"
      accessibilityLabel={t('join.cancel')}
      accessibilityHint={t('join.cancelHint')}
      testID="join-btn-cancel"
    >
      <Text variant="body" weight="semibold" color="brand">
        {t('join.cancel')}
      </Text>
    </Pressable>
  );

  // ─── Loading (joining) ─────────────────────────────────────
  // [MODIFIED] Locating is no longer a full-screen view: it stays on the choice view (inline
  // status + AddressAutocomplete's GPS button spinner), so the address search is not unmounted.
  if (phase === 'joining') {
    return (
      <View style={styles.root} testID="join-screen-loading">
        <ActivityIndicator
          size="large"
          color={theme.color.text.brand}
          accessibilityRole="progressbar"
          accessibilityLabel={t('join.loadingAccessibilityLabel')}
        />
        <Text variant="h3" weight="bold" style={styles.title}>
          {t('join.loadingTitle')}
        </Text>
        <Text variant="body" color="secondary" style={styles.description}>
          {t('join.loadingDescription')}
        </Text>
      </View>
    );
  }

  // ─── Start point chosen: confirm or change ─────────────────
  if (phase === 'choose' && startLocation !== null) {
    return (
      <View style={styles.root} testID="join-screen-confirm">
        <MapPin
          size={theme.spacing.xxl}
          color={theme.color.text.brand}
          accessibilityElementsHidden
        />
        <Text variant="h3" weight="bold" style={styles.title}>
          {t('join.selectedTitle')}
        </Text>
        <View style={styles.addressCard}>
          <Text variant="body" style={styles.description} testID="join-start-address">
            {startLocation.formattedAddress}
          </Text>
        </View>
        {/* [ADDED] Offline GPS: the address above is raw coordinates — non-blocking notice with the same
            style as CreateSessionScreen, but its own share key (the create one says the point is
            already added, which is not true before "Rejoindre"). */}
        {addressUnresolved && (
          <View style={styles.noticeCard} testID="join-gps-notice">
            <Text variant="small" color="secondary" accessibilityLiveRegion="polite">
              {t('join.gpsAddressUnresolved')}
            </Text>
          </View>
        )}
        <Pressable
          onPress={handleJoin}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed ? styles.primaryButtonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('join.confirm')}
          accessibilityHint={t('join.confirmHint')}
          testID="join-btn-confirm"
        >
          <Text variant="body" weight="semibold" color="onBrand">
            {t('join.confirm')}
          </Text>
        </Pressable>
        <Pressable
          onPress={clearStartLocation}
          style={styles.linkButton}
          accessibilityRole="button"
          accessibilityLabel={t('join.change')}
          accessibilityHint={t('join.changeHint')}
          testID="join-btn-change"
        >
          <Text variant="body" weight="semibold" color="brand">
            {t('join.change')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Start point choice ────────────────────────────────────
  if (phase === 'choose') {
    return (
      <View style={styles.root} testID="join-screen-choose">
        <Text variant="h3" weight="bold" style={styles.title}>
          {t('join.startPointTitle')}
        </Text>
        <Text variant="body" color="secondary" style={styles.description}>
          {t('join.startPointDescription')}
        </Text>
        {gpsErrorMessage !== null && (
          <Text
            variant="body"
            color="error"
            style={styles.description}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="join-gps-error"
          >
            {gpsErrorMessage}
          </Text>
        )}
        {isLocating && (
          <Text
            variant="body"
            color="secondary"
            style={styles.description}
            accessibilityLiveRegion="polite"
            testID="join-locating-status"
          >
            {t('join.locatingTitle')}
          </Text>
        )}
        {/* [MODIFIED] Same address search + GPS button as session creation, without the
            "Name" field (the participant's name comes from the profile). Its bottom sheet
            covers the geocoding loading / no result / network error states (ERR-003). */}
        <View style={styles.autocomplete}>
          <AddressAutocomplete
            showNameField={false}
            onSelectResult={selectAddress}
            onUseGps={handleUseLocation}
            isAddingByGps={isLocating}
            testID="join-address"
          />
        </View>
        {renderCancel()}
      </View>
    );
  }

  // ─── Success ───────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <View style={styles.root} testID="join-screen-success">
        <CheckCircle2
          size={theme.spacing.xxl}
          color={theme.color.text.brand}
          accessibilityElementsHidden
        />
        <Text variant="h3" weight="bold" style={styles.title}>
          {t('join.successTitle')}
        </Text>
        <Text variant="body" color="secondary" style={styles.description}>
          {t('join.successDescription')}
        </Text>
        <Pressable
          onPress={handleOpenMap}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed ? styles.primaryButtonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('join.openMap')}
          testID="join-btn-open-map"
        >
          <Text variant="body" weight="semibold" color="onBrand">
            {t('join.openMap')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Error ─────────────────────────────────────────────────
  const errorMessage = t(`errors.${errorCode ?? 'unknown'}`, { defaultValue: t('errors.unknown') });

  return (
    <View style={styles.root} testID="join-screen-error">
      <AlertTriangle
        size={theme.spacing.xxl}
        color={theme.color.text.error}
        accessibilityElementsHidden
      />
      <Text variant="h3" weight="bold" style={styles.title}>
        {t('errors.title')}
      </Text>
      <Text variant="body" color="secondary" style={styles.description}>
        {errorMessage}
      </Text>
      <Pressable
        onPress={handleJoin}
        style={({ pressed }) => [
          styles.button,
          styles.primaryButton,
          pressed ? styles.primaryButtonPressed : undefined,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('join.retry')}
        accessibilityHint={t('join.retryHint')}
        testID="join-btn-retry"
      >
        <Text variant="body" weight="semibold" color="onBrand">
          {t('join.retry')}
        </Text>
      </Pressable>
      {renderCancel()}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      backgroundColor: theme.color.surface.primary,
    },
    title: {
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    description: {
      textAlign: 'center',
    },
    // [ADDED] Chosen start point, on a card surface
    addressCard: {
      alignSelf: 'stretch',
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: theme.borderWidth.hairline,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.secondary,
    },
    button: {
      alignSelf: 'stretch',
      minHeight: theme.touchTarget.min,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    // [ADDED] Non-blocking notice — neutral info style (not an error), same as CreateSessionScreen
    noticeCard: {
      alignSelf: 'stretch',
      padding: theme.spacing.md,
      backgroundColor: theme.color.surface.secondary,
      borderRadius: theme.radius.md,
      borderWidth: theme.borderWidth.hairline,
      borderColor: theme.color.border.default,
    },
    // [ADDED] Address search spans the screen width (root centers its children)
    autocomplete: {
      alignSelf: 'stretch',
    },
    primaryButton: {
      backgroundColor: theme.color.interactive.brand.default,
    },
    primaryButtonPressed: {
      backgroundColor: theme.color.interactive.brand.pressed,
    },
    linkButton: {
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
    },
  });

export default JoinSessionScreen;
