/**
 * @file LiveParticipantsList.tsx
 * @description Molecule LiveParticipantsList — vue liste textuelle alternative
 *              à la carte temps réel (A11Y-006).
 *              LiveParticipantsList molecule — textual list alternative to the
 *              real-time map (A11Y-006).
 *
 *              Pour chaque participant live : nom, statut online/offline et
 *              distance au point de rencontre. Conçue pour les lecteurs d'écran
 *              (la carte n'est pas explorable au doigt).
 *              For each live participant: name, online/offline status and
 *              distance to the meeting point. Built for screen readers.
 *
 *              États / States : empty (aucun participant live) géré ici (ERR-003).
 *
 * @module presentation/components/molecules/LiveParticipantsList
 */

// [ADDED] F4 — Molecule LiveParticipantsList (vue liste a11y)
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { Coordinates } from '@core/entities/Location';
import type { RealtimeParticipant } from '@core/entities/RealtimeParticipant';
import { useTheme, type Theme } from '@core/theme';
import { getDistanceLabel } from '@core/utils/format';
import { distanceBetween } from '@core/utils/geo';
import { Text } from '@presentation/components/atoms';

/**
 * Props du composant LiveParticipantsList.
 * LiveParticipantsList component props.
 *
 * @param liveParticipants - Participants live à afficher / Live participants to display
 * @param midpoint - Point de rencontre (pour calcul de distance) / Meeting point
 * @param resolveName - Résout l'id participant en nom affichable / Resolves a participant id to a display name
 * @param currentParticipantId - Id du participant courant (affiché « Toi ») / Current participant id (shown as "You")
 * @param testID - ID de test / Test ID
 */
export interface LiveParticipantsListProps {
  readonly liveParticipants: readonly RealtimeParticipant[];
  readonly midpoint: Coordinates;
  /** Résout un participantId en nom affichable / Resolves a participantId to a display name */
  readonly resolveName?: (participantId: string) => string | undefined;
  /** Id du participant courant (affiché comme « Toi ») / Current participant id */
  readonly currentParticipantId?: string;
  readonly testID?: string;
}

/**
 * Molecule liste textuelle des participants en direct (alternative a11y).
 * Live participants textual list molecule (a11y alternative).
 *
 * @param props - {@link LiveParticipantsListProps}
 * @returns Composant LiveParticipantsList / LiveParticipantsList component
 */
const LiveParticipantsList: React.FC<LiveParticipantsListProps> = ({
  liveParticipants,
  midpoint,
  resolveName,
  currentParticipantId,
  testID,
}) => {
  const { t } = useTranslation('realtime');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // ─── État empty (ERR-003) ────────────────────────────────────
  if (liveParticipants.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={testID ? `${testID}-empty` : undefined}>
        <Text variant="small" color="secondary" accessibilityRole="text">
          {t('list.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {liveParticipants.map((live) => {
        const isCurrent = live.participantId === currentParticipantId;
        const name = isCurrent
          ? t('list.you')
          : resolveName?.(live.participantId) ?? live.participantId;
        const statusLabel = live.isOnline ? t('status.online') : t('status.offline');
        const distanceLabel = getDistanceLabel(
          distanceBetween({ latitude: live.latitude, longitude: live.longitude }, midpoint),
        );

        return (
          <View
            key={live.participantId}
            style={styles.row}
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('accessibility.participantStatus', {
              name,
              status: statusLabel,
              distance: distanceLabel,
            })}
            testID={testID ? `${testID}-item-${live.participantId}` : undefined}
          >
            <View
              style={[
                styles.statusDot,
                live.isOnline ? styles.statusDotOnline : styles.statusDotOffline,
              ]}
            />
            <View style={styles.textContainer}>
              <Text variant="body" weight="semibold" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="small" color="secondary">
                {statusLabel} · {t('list.distanceFromMidpoint', { distance: distanceLabel })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Design tokens only (DS-001, DS-002)
// ═══════════════════════════════════════════════════════════════

const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    emptyContainer: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touchTarget.min,
      backgroundColor: theme.color.surface.secondary,
      borderRadius: theme.radius.md,
    },
    statusDot: {
      width: theme.spacing.md,
      height: theme.spacing.md,
      borderRadius: theme.radius.full,
    },
    statusDotOnline: {
      backgroundColor: theme.color.text.success,
    },
    statusDotOffline: {
      backgroundColor: theme.color.text.tertiary,
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });

export default LiveParticipantsList;
