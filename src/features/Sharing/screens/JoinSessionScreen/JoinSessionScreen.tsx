/**
 * @file JoinSessionScreen.tsx
 * @description Écran F5 — jointure d'une session partagée via deep link.
 *              F5 Screen — joining a shared session via deep link.
 *
 *              Ouvert par `mivro://session/{sessionId}` (linking React Navigation).
 *              Déclenche `JoinSessionUseCase` (ajout du membre + recalcul du
 *              midpoint), gère les états loading / error / success (ERR-003) :
 *              - lien expiré / introuvable / fermé → message i18n + réessayer
 *              - succès → bascule en mode partagé et propose d'ouvrir la carte
 *
 *              États loading/error/success, a11y (A11Y-003), tokens theme (DS).
 *
 * @module features/Sharing/screens/JoinSessionScreen/JoinSessionScreen
 */

// [ADDED] F5 — Écran de jointure de session partagée
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme, type Theme } from '@theme';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@components/atoms';
import { useSessionShare } from '@features/Sharing/hooks/useSessionShare';
import type { RootStackParamList } from '@navigations/types';

/** État interne de l'écran de jointure / Join screen internal state */
type JoinPhase = 'loading' | 'success' | 'error';

/**
 * Écran de jointure d'une session partagée (deep link F5).
 * Shared session join screen (F5 deep link).
 *
 * @returns Composant JoinSessionScreen / JoinSessionScreen component
 */
const JoinSessionScreen: React.FC = () => {
  const { t } = useTranslation('share');
  const theme = useTheme();
  const styles = buildStyles(theme);

  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'JoinSession'>>();
  const sessionId = route.params?.sessionId ?? '';

  const { join, errorCode } = useSessionShare();
  const [phase, setPhase] = useState<JoinPhase>('loading');

  const runJoin = useCallback(async () => {
    setPhase('loading');
    if (sessionId.length === 0) {
      setPhase('error');
      return;
    }
    const ok = await join(sessionId);
    setPhase(ok ? 'success' : 'error');
  }, [join, sessionId]);

  // Lance la jointure à l'ouverture (et à chaque changement de sessionId).
  // runJoin gère ses propres erreurs (setPhase('error')) et ne rejette jamais ;
  // le .catch est une sécurité défensive (ne devrait pas se déclencher).
  useEffect(() => {
    runJoin().catch(() => setPhase('error'));
  }, [runJoin]);

  const handleOpenMap = useCallback(() => {
    // Remplace l'écran de jointure par les onglets (carte) — pas de retour ici.
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Map' } }] });
  }, [navigation]);

  const handleCancel = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Create' } }] });
  }, [navigation]);

  // ─── Loading ───────────────────────────────────────────────
  if (phase === 'loading') {
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
        onPress={runJoin}
        style={({ pressed }) => [
          styles.button,
          styles.primaryButton,
          pressed ? styles.primaryButtonPressed : undefined,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('join.retry')}
        testID="join-btn-retry"
      >
        <Text variant="body" weight="semibold" color="onBrand">
          {t('join.retry')}
        </Text>
      </Pressable>
      <Pressable
        onPress={handleCancel}
        style={styles.linkButton}
        accessibilityRole="button"
        accessibilityLabel={t('join.cancel')}
        testID="join-btn-cancel"
      >
        <Text variant="body" weight="semibold" color="brand">
          {t('join.cancel')}
        </Text>
      </Pressable>
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
