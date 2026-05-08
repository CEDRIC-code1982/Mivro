/**
 * @file MapScreen.tsx
 * @description Écran F2 — Affichage carte du midpoint calculé.
 *              F2 Screen — Map display of the calculated midpoint.
 *
 *              Affiche la session computed avec markers participants,
 *              midpoint et cercle de zone. Propose une vue liste
 *              alternative pour l'accessibilité (A11Y-006).
 *
 * @module presentation/screens/MapScreen
 */

// [MODIFIED] Refactor complet — écran F2 carte interactive
import { MapPin, Star } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '@core/theme';
import { Text } from '@presentation/components/atoms';
import EmptyState from '@presentation/components/molecules/EmptyState';
import ParticipantCard from '@presentation/components/molecules/ParticipantCard';
import SessionMapView from '@presentation/components/molecules/SessionMapView';
import { useSessionStore } from '@presentation/stores/useSessionStore';

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

  // [ADDED] État pour la modal "Vue liste" (A11Y-006)
  const [isListVisible, setIsListVisible] = useState(false);

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
              accessibilityHint={t('list.title')}
              testID="map-btn-list"
            >
              <Text variant="small" weight="semibold" color="brand">
                {t('actions.viewList')}
              </Text>
            </Pressable>

            {/* [TODO F3] Voir POI — inactif pour l'instant */}
            <Pressable
              disabled
              style={[styles.actionButton, styles.primaryButton, styles.disabledButton]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.viewPOI')}
              accessibilityState={{ disabled: true }}
              testID="map-btn-poi"
            >
              <Text variant="small" weight="semibold" color="tertiary">
                {t('actions.viewPOI')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

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
                  color={theme.color.interactive.brand.default}
                  fill={theme.color.interactive.brand.default}
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
    actionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    actionButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.color.interactive.brand.default,
    },
    secondaryButton: {
      backgroundColor: theme.color.surface.secondary,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.color.interactive.neutral.pressed,
    },
    disabledButton: {
      backgroundColor: theme.color.interactive.brand.disabled,
    },
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
      borderColor: theme.color.interactive.brand.default,
      marginBottom: theme.spacing.sm,
    },
    midpointIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
  });

export default MapScreen;
