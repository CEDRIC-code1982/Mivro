/**
 * @file MapScreen.tsx
 * @description F2 Screen — Map display of the calculated midpoint.
 *
 *              Shows the computed session with participant markers, the midpoint and the zone
 *              circle. Offers an alternative list view for accessibility (A11Y-006), and the
 *              real-time tracking errors under the summary.
 *
 * @module features/Session/screens/MapScreen/MapScreen
 */

// [MODIFIED] Full refactor — F2 interactive map screen
import { useNavigation } from '@react-navigation/native'; // [ADDED]
import { useTheme, type Theme } from '@theme';
import { MapPin, Star } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react'; // [MODIFIED] F4 — useEffect/useMemo
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@components/atoms';
import EmptyState from '@components/molecules/EmptyState';
import LiveParticipantsList from '@components/molecules/LiveParticipantsList'; // [ADDED] F4
import ParticipantCard from '@components/molecules/ParticipantCard';
import RealtimeConsentModal from '@components/molecules/RealtimeConsentModal'; // [ADDED] F4
import SessionMapView from '@components/molecules/SessionMapView';
import { useAuthUser } from '@features/Profile/hooks/useAuth'; // [ADDED] F4
import { useRealtimeTracking } from '@features/Sharing/hooks/useRealtimeTracking'; // [ADDED] F4
import { useSessionShare } from '@features/Sharing/hooks/useSessionShare'; // [ADDED] F5
import { useSharedSessionSync } from '@features/Sharing/hooks/useSharedSessionSync'; // [ADDED] F5
import { useRealtimeStore } from '@state/useRealtimeStore'; // [ADDED] F4
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore'; // [ADDED] F5

/**
 * Map Screen F2 — displays the calculated midpoint on an interactive map.
 *
 * @returns Composant MapScreen / MapScreen component
 */
const MapScreen: React.FC = () => {
  const { t } = useTranslation('map');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = buildStyles(theme, insets.bottom);

  const session = useSessionStore((s) => s.session);
  const navigation = useNavigation(); // [ADDED]

  // [REMOVED] POI logic demo — usePOIQuery now lives in POIScreen

  // [ADDED] State of the "List view" modal (A11Y-006)
  const [isListVisible, setIsListVisible] = useState(false);

  // ─── F4 — Real time (hooks called unconditionally) ──────
  const currentUser = useAuthUser();
  const { start, stop } = useRealtimeTracking();
  // [ADDED] F5 — collaborative sharing (deep link + native share sheet)
  const { share: shareSession, isBusy: isSharing } = useSessionShare();

  // [ADDED] F5 — LIVE sync: while the session is shared, subscribe to the roster and to the
  // midpoint recomputed live (the hook unsubscribes on unmount). Inert if the session is not
  // shared.
  useSharedSessionSync();

  const handleShareSession = useCallback(() => {
    // [MAJEUR 3 — ERR-003] The failure can NO LONGER be swallowed: wait for the result (link or
    // null) and the error code, and surface feedback to the user.
    shareSession((link) => t('share:shareSheet.message', { link }))
      .then((link) => {
        if (link !== null) {
          // Success: confirm the link is ready (the native share sheet has already opened).
          // Existing i18n key share:toast.shared.
          Alert.alert(t('share:toast.shared'));
          return;
        }
        // Failure: read the mapped code from the store (up to date when the callback runs, unlike
        // an errorCode captured in the closure) → i18n message share:errors.{code}.
        const code = useSharedSessionStore.getState().errorCode ?? 'unknown';
        Alert.alert(
          t('share:errors.title'),
          t(`share:errors.${code}`, { defaultValue: t('share:errors.unknown') }),
        );
      })
      .catch(() => {
        // Defensive safety: shareSession does not normally reject.
        Alert.alert(t('share:errors.title'), t('share:errors.unknown'));
      });
  }, [shareSession, t]);
  // [FIXED] Zustand v5 (useSyncExternalStore + Object.is): a selector returning
  // Object.values(...) creates a NEW array reference on every render → snapshot always
  // "different" → infinite render loop ("Maximum update depth exceeded"). Select the map (stable
  // reference, replaced wholesale by setParticipants), then derive the array with useMemo.
  const participantsMap = useRealtimeStore((s) => s.participants);
  const liveParticipants = useMemo(() => Object.values(participantsMap), [participantsMap]);
  const isTracking = useRealtimeStore((s) => s.sessionId !== null);
  const hasSharingConsent = useRealtimeStore((s) => s.hasSharingConsent);
  const setSharingConsent = useRealtimeStore((s) => s.setSharingConsent);

  // [FIXED] "Erreurs du temps réel affichées sur la carte": the tracking hook set its errors in
  // the store, but no screen showed them (ERR-003). Read from the status, not from the tracked
  // session: a refused start (shared session that has ended) resets the session to null before
  // setting the `closed` error. An error without a code falls back to `unknown`, like an unknown
  // code through `defaultValue`.
  // [FIXED] "Erreur de suivi effacée par le prochain instantané": a failure to share my position
  // (GPS, publishing) is kept apart from the connection status and comes first, since the
  // next snapshot of the others sets `connected` while my position is still not published.
  const realtimeErrorCode = useRealtimeStore(
    (s) => s.trackingErrorCode ?? (s.status === 'error' ? s.errorCode ?? 'unknown' : null),
  );
  const realtimeErrorMessage =
    realtimeErrorCode === null
      ? null
      : t(`realtime:errors.${realtimeErrorCode}`, { defaultValue: t('realtime:errors.unknown') });

  // [ADDED] VoiceOver ignores `accessibilityLiveRegion` (Android only): the message is announced
  // on iOS each time it appears or changes. Android reads it through the live region, so it is
  // not announced twice there.
  useEffect(() => {
    if (realtimeErrorMessage !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(realtimeErrorMessage);
    }
  }, [realtimeErrorMessage]);

  // [ADDED] F4 — GDPR consent modal (location sharing)
  const [isConsentVisible, setIsConsentVisible] = useState(false);

  // [ADDED] F4 — participant id → name resolution (from the local session)
  const resolveName = useMemo(() => {
    const byId = new Map(session?.participants.map((p) => [p.id, p.displayName]) ?? []);
    return (participantId: string): string | undefined => byId.get(participantId);
  }, [session?.participants]);

  // [ADDED] F4 — starts/stops SHARING with a separate consent (GDPR).
  // [FIXED] The toggle drives ACTIVE sharing (hasSharingConsent), not tracking as a whole: "Stop
  // sharing" cuts the broadcast of my position (and therefore the GPS watch, through the hook's
  // effect) while STILL seeing the others.
  const handleToggleSharing = useCallback(() => {
    if (hasSharingConsent) {
      // Sharing stopped: my position is no longer published (the GPS watch is stopped by the
      // effect reacting to consent); the subscription stays active to keep seeing the others
      // (view-only mode).
      setSharingConsent(false);
      return;
    }
    // No consent yet → ask before any sharing (GDPR).
    setIsConsentVisible(true);
  }, [hasSharingConsent, setSharingConsent]);

  const handleAcceptConsent = useCallback(() => {
    setIsConsentVisible(false);
    if (session == null || currentUser == null) return;
    // IMPORTANT order: start() calls startTracking(), which RESETS the store (including
    // hasSharingConsent=false). Consent is therefore set AFTER, so that it is not overwritten;
    // the hook's effect then starts the watch.
    start(session.id, currentUser.id);
    setSharingConsent(true);
  }, [session, currentUser, setSharingConsent, start]);

  const handleDeclineConsent = useCallback(() => {
    setIsConsentVisible(false);
    setSharingConsent(false);
    // Sharing refused: subscribe anyway to SEE the others. No GPS watch is started while
    // hasSharingConsent stays false (battery optimization) — only the subscription to the
    // others' positions runs.
    if (session != null && currentUser != null) {
      start(session.id, currentUser.id);
    }
  }, [session, currentUser, setSharingConsent, start]);

  // [ADDED] F4 — tracking stopped when the screen unmounts (GDPR: leaveSession)
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const openList = useCallback(() => {
    setIsListVisible(true);
    console.log(
      `[INFO][MapScreen][openList][?][${new Date().toISOString().slice(11, 19)}] ` +
        'List view opened (a11y alternative)',
    );
  }, []);

  const closeList = useCallback(() => {
    setIsListVisible(false);
  }, []);

  // ─── Case 1: no session ────────────────────────────────────
  if (!session) {
    return (
      <View style={styles.emptyContainer} testID="map-screen-empty">
        <EmptyState
          icon={MapPin}
          title={t('noSession.title')}
          description={t('noSession.description')}
          testID="map-empty-no-session"
        />
      </View>
    );
  }

  // ─── Case 2: session not computed yet ──────────────────────
  if (session.status !== 'computed' || !session.midpoint || !session.midpointRadius) {
    return (
      <View style={styles.emptyContainer} testID="map-screen-not-computed">
        <EmptyState
          icon={MapPin}
          title={t('notComputed.title')}
          description={t('notComputed.description')}
          testID="map-empty-not-computed"
        />
      </View>
    );
  }

  // ─── Case 3: computed session — interactive map ───────────
  // [ADDED] Masked coordinates for the summary (GDPR)
  const maskedLat = `${session.midpoint.latitude.toFixed(2)}**`;
  const maskedLng = `${session.midpoint.longitude.toFixed(2)}**`;
  const radiusKm = (session.midpointRadius / 1000).toFixed(1);

  return (
    <View style={styles.root} testID="map-screen">
      {/* [ADDED] Full-screen interactive map */}
      <SessionMapView
        participants={session.participants}
        midpoint={session.midpoint}
        radius={session.midpointRadius}
        liveParticipants={liveParticipants}
        accessibilityLabel={
          isTracking
            ? t('realtime:accessibility.liveMapLabel', {
                participantCount: liveParticipants.length,
              })
            : t('accessibility.mapLabel', {
                participantCount: session.participants.length,
              })
        }
        testID="map-session"
      />

      {/* [ADDED] Footer overlay — summary + actions */}
      <View style={styles.footer} testID="map-footer">
        <View style={styles.footerCard}>
          <Text variant="bodyLg" weight="bold">
            {t('summary.title')}
          </Text>
          <Text variant="small" color="secondary">
            {t('summary.coordinates', { lat: maskedLat, lng: maskedLng })}
          </Text>
          <Text variant="small" color="secondary">
            {t('summary.radius', { km: radiusKm })}
          </Text>

          {/* [ADDED] Real-time tracking error (ERR-003), read by TalkBack through the live region */}
          {realtimeErrorMessage !== null && (
            <Text
              variant="small"
              color="error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              testID="map-realtime-error"
            >
              {realtimeErrorMessage}
            </Text>
          )}

          {/* [ADDED] Action buttons */}
          <View style={styles.actionsRow}>
            {/* List view — required for a11y (A11Y-006) */}
            <Pressable
              onPress={openList}
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.viewList')}
              accessibilityHint={t('accessibility.viewListHint')}
              testID="map-btn-list"
            >
              <Text variant="small" weight="semibold" color="brand">
                {t('actions.viewList')}
              </Text>
            </Pressable>

            {/* [MODIFIED] See POIs — navigates to POIScreen */}
            <Pressable
              onPress={() => navigation.navigate('POI')}
              style={({ pressed }) => [
                styles.actionButton,
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.viewPOI')}
              testID="map-btn-poi"
            >
              <Text variant="small" weight="semibold" color="onBrand">
                {t('actions.viewPOI')}
              </Text>
            </Pressable>

            {/* [ADDED] F5 — share the session (deep link + native share sheet) */}
            <Pressable
              onPress={handleShareSession}
              disabled={isSharing}
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('share:actions.share')}
              accessibilityHint={t('share:actions.shareHint')}
              accessibilityState={{ disabled: isSharing, busy: isSharing }}
              testID="map-btn-share-session"
            >
              <Text variant="small" weight="semibold" color="brand">
                {t('share:actions.share')}
              </Text>
            </Pressable>

            {/* [ADDED] F4 — share / stop sharing my position (GDPR).
                [FIXED] Label/state based on hasSharingConsent (ACTIVE sharing), not on
                isTracking (which also covers view-only mode). */}
            <Pressable
              onPress={handleToggleSharing}
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                hasSharingConsent
                  ? t('realtime:actions.stopSharing')
                  : t('realtime:actions.startSharing')
              }
              testID="map-btn-share"
            >
              <Text variant="small" weight="semibold" color="brand">
                {hasSharingConsent
                  ? t('realtime:actions.stopSharing')
                  : t('realtime:actions.startSharing')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* [ADDED] F4 — explicit, SEPARATE GDPR consent to sharing */}
      <RealtimeConsentModal
        visible={isConsentVisible}
        onAccept={handleAcceptConsent}
        onDecline={handleDeclineConsent}
        testID="map-consent-modal"
      />

      {/* [ADDED] List view modal — a11y alternative to the map (A11Y-006) */}
      <Modal
        visible={isListVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeList}
        testID="map-list-modal"
      >
        <View style={styles.modalContainer}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text variant="h3" weight="bold">
              {t('list.title')}
            </Text>
            <Pressable
              onPress={closeList}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel={t('list.close')}
              testID="map-list-close"
            >
              <Text variant="body" weight="semibold" color="brand">
                {t('list.close')}
              </Text>
            </Pressable>
          </View>

          {/* List content */}
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalListContent}>
            {/* [ADDED] Distinct midpoint card */}
            <View style={styles.midpointCard} testID="map-list-midpoint">
              <View style={styles.midpointIconRow}>
                <Star
                  size={theme.spacing.xl}
                  color={theme.color.text.brand}
                  fill={theme.color.text.brand}
                />
                <Text variant="body" weight="bold">
                  {t('list.midpoint')}
                </Text>
              </View>
              <Text variant="small" color="secondary">
                {t('summary.coordinates', { lat: maskedLat, lng: maskedLng })}
              </Text>
              <Text variant="small" color="secondary">
                {t('summary.radius', { km: radiusKm })}
              </Text>
            </View>

            {/* [ADDED] F4 — real-time section: a11y list view of live positions */}
            {isTracking && (
              <View style={styles.liveSection} testID="map-list-live">
                <Text variant="body" weight="bold">
                  {t('realtime:list.title')}
                </Text>
                {!hasSharingConsent && (
                  <Text variant="caption" color="tertiary">
                    {t('realtime:consent.note')}
                  </Text>
                )}
                <LiveParticipantsList
                  liveParticipants={liveParticipants}
                  midpoint={session.midpoint}
                  resolveName={resolveName}
                  {...(currentUser?.id != null && { currentParticipantId: currentUser.id })}
                  testID="map-live-list"
                />
              </View>
            )}

            {/* [ADDED] Participants list */}
            {session.participants.map((participant) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                testID={`map-list-participant-${participant.id}`}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

// [MODIFIED] Build styles from theme tokens
const buildStyles = (theme: Theme, bottomInset: number) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.color.surface.primary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.surface.primary,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: bottomInset + theme.spacing.md,
    },
    footerCard: {
      backgroundColor: theme.color.surface.primary,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
      ...theme.elevation.lg,
    },
    // [FIXED P1] Buttons stacked vertically: the long label "Voir les lieux à proximité" no
    // longer overflows and the layout holds at Dynamic Type 200%.
    actionsRow: {
      flexDirection: 'column',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    actionButton: {
      alignSelf: 'stretch',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.color.interactive.brand.default,
    },
    primaryButtonPressed: {
      backgroundColor: theme.color.interactive.brand.pressed,
    },
    secondaryButton: {
      backgroundColor: theme.color.surface.secondary,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.color.interactive.neutral.pressed,
    },
    // [REMOVED] disabledButton — POI button now active (F3)
    // ─── List view modal ──────────────────────────────────────
    modalContainer: {
      flex: 1,
      backgroundColor: theme.color.surface.primary,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalCloseButton: {
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    modalContent: {
      flex: 1,
    },
    modalListContent: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    midpointCard: {
      backgroundColor: theme.color.surface.secondary,
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.color.text.brand,
      marginBottom: theme.spacing.sm,
    },
    midpointIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    // [ADDED] F4 — real-time section in the list view modal
    liveSection: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
  });

export default MapScreen;
