/**
 * @file CreateSessionScreen.tsx
 * @description Écran F1 — Saisie des points de départ.
 *              F1 Screen — Starting points input.
 *
 *              Orchestrateur uniquement : toute la logique est dans
 *              useCreateSessionFlow. Le screen ne fait que mapper
 *              les données sur les composants UI.
 *              Orchestrator only: all logic lives in useCreateSessionFlow.
 *              The screen only maps data to UI components.
 *
 * @module presentation/screens/CreateSessionScreen
 */

// [MODIFIED] Refactor complet — écran F1 fonctionnel + navigation F2
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'; // [ADDED]
import { useNavigation } from '@react-navigation/native'; // [ADDED]
import { MapPin } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Participant } from '@core/entities/MidpointSession';
import { useTheme, type Theme } from '@core/theme';
import { Screen, Text } from '@presentation/components/atoms';
import AddressAutocomplete from '@presentation/components/molecules/AddressAutocomplete';
import EmptyState from '@presentation/components/molecules/EmptyState';
import ParticipantCard from '@presentation/components/molecules/ParticipantCard';
import { useCreateSessionFlow } from '@presentation/hooks/useCreateSessionFlow';
import { useMidpointCalculation } from '@presentation/hooks/useMidpointCalculation';
import type { BottomTabsParamList } from '@presentation/navigation/types'; // [ADDED]

/**
 * Écran de création de session (F1).
 * Session creation screen (F1).
 *
 * @returns Composant CreateSessionScreen / CreateSessionScreen component
 */
const CreateSessionScreen: React.FC = () => {
  const { t } = useTranslation('create');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // [ADDED] Hook d'orchestration — toute la logique métier
  const {
    participants,
    participantsCount,
    isFull,
    canContinue,
    remainingMin,
    isAddingByGps,
    gpsError,
    addByGeocode,
    addByGps,
    removeParticipant,
  } = useCreateSessionFlow();

  // [ADDED] Navigation + calcul midpoint
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabsParamList>>();
  const { calculate: calculateMidpoint, error: midpointError } = useMidpointCalculation();

  /**
   * Gère le clic sur "Continuer" — calcule le midpoint et navigue vers Map.
   * Handles "Continue" press — calculates midpoint and navigates to Map.
   */
  const handleContinue = useCallback(() => {
    const result = calculateMidpoint();

    if (result) {
      // [ADDED] Navigation vers Map après calcul réussi
      navigation.navigate('Map');
      console.log(
        `[INFO][CreateSessionScreen][handleContinue][?][${new Date()
          .toISOString()
          .slice(11, 19)}] ` +
          `Midpoint calculated, navigating to Map | ${result.participantsCount} participants`,
      );
    }
  }, [calculateMidpoint, navigation]);

  /**
   * Rendu du compteur de participants.
   * Renders the participant counter.
   */
  const renderCounter = () => (
    <View style={styles.counterContainer} testID="create-counter">
      <Text variant="body" weight="semibold">
        {t('counter.current', { count: participantsCount })}
      </Text>
      <Text variant="small" color="tertiary">
        {canContinue ? t('counter.complete') : t('counter.remaining', { count: remainingMin })}
      </Text>
    </View>
  );

  /**
   * Rendu de l'erreur GPS.
   * Renders the GPS error card.
   */
  const renderGpsError = () => {
    if (gpsError == null) return null;

    const errorKey = gpsError.code === 'unknown' ? 'unknown' : gpsError.code;

    return (
      <View style={styles.errorCard} testID="create-gps-error">
        <Text variant="small" color="error">
          {t(`errors.${errorKey}`)}
        </Text>
      </View>
    );
  };

  return (
    <Screen background="primary" scrollable testID="create-screen">
      {/* [ADDED] Header */}
      <View style={styles.header}>
        <Text variant="h2" weight="bold" accessibilityRole="header">
          {t('title')}
        </Text>
        <Text variant="body" color="secondary">
          {t('subtitle')}
        </Text>
      </View>

      {/* [ADDED] Compteur */}
      {renderCounter()}

      {/* [ADDED] Autocomplete (adresse + GPS) */}
      <AddressAutocomplete
        onSelectResult={addByGeocode}
        onUseGps={addByGps}
        isAddingByGps={isAddingByGps}
        isFull={isFull}
        testID="create-autocomplete"
      />

      {/* [ADDED] Erreur GPS */}
      {renderGpsError()}

      {/* [FIXED P0-4] Liste des participants — View+map au lieu de FlatList */}
      <View style={styles.listSection}>
        {participantsCount === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t('list.empty.title')}
            description={t('list.empty.description')}
            testID="create-empty-state"
          />
        ) : (
          <View style={styles.listContent} testID="create-participants-list">
            {(participants as Participant[]).map((item) => (
              <ParticipantCard
                key={item.id}
                participant={item}
                onRemove={() => removeParticipant(item.id)}
                testID={`create-participant-${item.id}`}
              />
            ))}
          </View>
        )}
      </View>

      {/* [ADDED] Erreur midpoint si calcul échoue */}
      {midpointError != null && (
        <View style={styles.errorCard} testID="midpoint-error">
          <Text variant="small" color="error">
            {midpointError.code === 'unknown'
              ? t('midpointErrors.unknown', { message: midpointError.message })
              : t(`midpointErrors.${midpointError.code}`)}
          </Text>
        </View>
      )}

      {/* [ADDED] Footer — Bouton Continuer */}
      <View style={styles.footer}>
        {!canContinue && (
          <Text variant="small" color="tertiary" align="center">
            {t('actions.continueDisabled')}
          </Text>
        )}
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.continueButton,
            canContinue ? styles.continueButtonEnabled : styles.continueButtonDisabled,
            pressed && canContinue ? styles.continueButtonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('actions.continue')}
          accessibilityState={{ disabled: !canContinue }}
          testID="create-continue-button"
        >
          <Text variant="body" weight="semibold" color={canContinue ? 'onBrand' : 'tertiary'}>
            {t('actions.continue')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

// [MODIFIED] Build styles from theme tokens — no magic numbers (DS-001)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    counterContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    listSection: {
      marginTop: theme.spacing.lg,
    },
    listContent: {
      gap: theme.spacing.sm,
    },
    errorCard: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.color.feedback.errorBg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.color.interactive.danger.default,
    },
    footer: {
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    continueButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueButtonEnabled: {
      backgroundColor: theme.color.interactive.brand.default,
    },
    continueButtonDisabled: {
      backgroundColor: theme.color.surface.secondary,
    },
    continueButtonPressed: {
      backgroundColor: theme.color.interactive.brand.pressed,
    },
  });

export default CreateSessionScreen;
