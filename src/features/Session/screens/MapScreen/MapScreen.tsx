/**
 * @file MapScreen.tsx
 * @description Écran F2 — Affichage carte du midpoint calculé.
 *              F2 Screen — Map display of the calculated midpoint.
 *
 *              Affiche la session computed avec markers participants,
 *              midpoint et cercle de zone. Propose une vue liste
 *              alternative pour l'accessibilité (A11Y-006).
 *
 * @module features/Session/screens/MapScreen/MapScreen
 */

// [MODIFIED] Refactor complet — écran F2 carte interactive
import { useNavigation } from '@react-navigation/native'; // [ADDED]
import { useTheme, type Theme } from '@theme';
import { MapPin, Star } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react'; // [MODIFIED] F4 — useEffect/useMemo
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
 * Écran Carte F2 — affiche le midpoint calculé sur une carte interactive.
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

  // [REMOVED] Démo logique POI — usePOIQuery maintenant dans POIScreen

  // [ADDED] État pour la modal "Vue liste" (A11Y-006)
  const [isListVisible, setIsListVisible] = useState(false);

  // ─── F4 — Temps réel (hooks appelés inconditionnellement) ──────
  const currentUser = useAuthUser();
  const { start, stop } = useRealtimeTracking();
  // [ADDED] F5 — partage collaboratif (deep link + share sheet native)
  const { share: shareSession, isBusy: isSharing } = useSessionShare();

  // [ADDED] F5 — synchro LIVE : tant que la session est partagée, on s'abonne au
  // roster + midpoint recalculé en direct (désabonnement au démontage géré par
  // le hook). Inerte si la session n'est pas partagée.
  useSharedSessionSync();

  const handleShareSession = useCallback(() => {
    // [MAJEUR 3 — ERR-003] On NE peut PLUS avaler l'échec : on attend le retour
    // (lien ou null) + le code d'erreur, et on surface un retour utilisateur.
    shareSession((link) => t('share:shareSheet.message', { link }))
      .then((link) => {
        if (link !== null) {
          // Succès : confirme que le lien est prêt (la share sheet native s'est
          // déjà ouverte). Clé i18n existante share:toast.shared.
          Alert.alert(t('share:toast.shared'));
          return;
        }
        // Échec : on lit le code mappé depuis le store (source à jour au moment
        // du callback, contrairement à un errorCode capturé dans la closure) →
        // message i18n share:errors.{code}.
        const code = useSharedSessionStore.getState().errorCode ?? 'unknown';
        Alert.alert(
          t('share:errors.title'),
          t(`share:errors.${code}`, { defaultValue: t('share:errors.unknown') }),
        );
      })
      .catch(() => {
        // Sécurité défensive : shareSession ne rejette pas normalement.
        Alert.alert(t('share:errors.title'), t('share:errors.unknown'));
      });
  }, [shareSession, t]);
  // [FIXED] Zustand v5 (useSyncExternalStore + Object.is) : un sélecteur qui
  // renvoie Object.values(...) crée une NOUVELLE référence de tableau à chaque
  // rendu → snapshot toujours « différent » → boucle de rendu infinie
  // (« Maximum update depth exceeded »). On sélectionne la map (référence
  // stable, remplacée en bloc par setParticipants) puis on dérive le tableau
  // via useMemo. / Select the stable map reference, then derive the array.
  const participantsMap = useRealtimeStore((s) => s.participants);
  const liveParticipants = useMemo(() => Object.values(participantsMap), [participantsMap]);
  const isTracking = useRealtimeStore((s) => s.sessionId !== null);
  const hasSharingConsent = useRealtimeStore((s) => s.hasSharingConsent);
  const setSharingConsent = useRealtimeStore((s) => s.setSharingConsent);

  // [ADDED] F4 — modal de consentement RGPD (partage de position)
  const [isConsentVisible, setIsConsentVisible] = useState(false);

  // [ADDED] F4 — résolution id participant → nom (depuis la session locale)
  const resolveName = useMemo(() => {
    const byId = new Map(session?.participants.map((p) => [p.id, p.displayName]) ?? []);
    return (participantId: string): string | undefined => byId.get(participantId);
  }, [session?.participants]);

  // [ADDED] F4 — démarre/arrête le PARTAGE avec consentement séparé (RGPD).
  // [FIXED] Le toggle pilote le partage ACTIF (hasSharingConsent), pas le suivi
  // global : « Arrêter le partage » coupe la diffusion de ma position (et donc
  // le watch GPS via l'effet du hook) tout en CONTINUANT de voir les autres.
  const handleToggleSharing = useCallback(() => {
    if (hasSharingConsent) {
      // Arrêt du partage : ma position cesse d'être publiée (le watch GPS est
      // stoppé par l'effet réagissant au consentement) ; l'abonnement reste
      // actif pour continuer à voir les autres (mode voir-seulement).
      setSharingConsent(false);
      return;
    }
    // Pas encore de consentement → demander avant tout partage (RGPD).
    setIsConsentVisible(true);
  }, [hasSharingConsent, setSharingConsent]);

  const handleAcceptConsent = useCallback(() => {
    setIsConsentVisible(false);
    if (session == null || currentUser == null) return;
    // Ordre IMPORTANT : start() appelle startTracking() qui RÉINITIALISE le
    // store (dont hasSharingConsent=false). On pose donc le consentement APRÈS
    // pour qu'il ne soit pas écrasé ; l'effet du hook démarre alors le watch.
    start(session.id, currentUser.id);
    setSharingConsent(true);
  }, [session, currentUser, setSharingConsent, start]);

  const handleDeclineConsent = useCallback(() => {
    setIsConsentVisible(false);
    setSharingConsent(false);
    // Refus de partager : on s'abonne quand même pour VOIR les autres.
    // Aucun watch GPS n'est démarré tant que hasSharingConsent reste false
    // (opti batterie) — seul l'abonnement aux positions des autres tourne.
    if (session != null && currentUser != null) {
      start(session.id, currentUser.id);
    }
  }, [session, currentUser, setSharingConsent, start]);

  // [ADDED] F4 — arrêt du suivi au démontage de l'écran (RGPD : leaveSession)
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

  // ─── Cas 1 : Pas de session ────────────────────────────────
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

  // ─── Cas 2 : Session pas encore computed ───────────────────
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

  // ─── Cas 3 : Session computed — carte interactive ─────────
  // [ADDED] Coordonnées masquées pour le résumé (RGPD)
  const maskedLat = `${session.midpoint.latitude.toFixed(2)}**`;
  const maskedLng = `${session.midpoint.longitude.toFixed(2)}**`;
  const radiusKm = (session.midpointRadius / 1000).toFixed(1);

  return (
    <View style={styles.root} testID="map-screen">
      {/* [ADDED] Carte interactive plein écran */}
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

      {/* [ADDED] Footer overlay — résumé + actions */}
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

          {/* [ADDED] Boutons actions */}
          <View style={styles.actionsRow}>
            {/* Vue liste — obligatoire a11y (A11Y-006) */}
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

            {/* [MODIFIED] Voir POI — navigue vers POIScreen */}
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

            {/* [ADDED] F5 — partager la session (deep link + share sheet native) */}
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

            {/* [ADDED] F4 — partager / arrêter de partager ma position (RGPD).
                [FIXED] Libellé/état basés sur hasSharingConsent (partage ACTIF)
                et non isTracking (qui couvre aussi la visualisation seule). */}
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

      {/* [ADDED] F4 — consentement RGPD explicite et SÉPARÉ au partage */}
      <RealtimeConsentModal
        visible={isConsentVisible}
        onAccept={handleAcceptConsent}
        onDecline={handleDeclineConsent}
        testID="map-consent-modal"
      />

      {/* [ADDED] Modal Vue Liste — alternative a11y à la carte (A11Y-006) */}
      <Modal
        visible={isListVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeList}
        testID="map-list-modal"
      >
        <View style={styles.modalContainer}>
          {/* Header modal */}
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

          {/* Contenu liste */}
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalListContent}>
            {/* [ADDED] Card midpoint distincte */}
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

            {/* [ADDED] F4 — section temps réel : vue liste a11y des positions live */}
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

            {/* [ADDED] Liste des participants */}
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
    // [FIXED P1] Boutons empilés verticalement : le libellé long « Voir les
    // lieux à proximité » ne déborde plus et le layout tient en Dynamic Type 200%.
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
    // [REMOVED] disabledButton — bouton POI maintenant actif (F3)
    // ─── Modal Vue Liste ──────────────────────────────────────
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
    // [ADDED] F4 — section temps réel dans la modal vue liste
    liveSection: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
  });

export default MapScreen;
