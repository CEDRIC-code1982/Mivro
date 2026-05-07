/**
 * @file ProfileScreen.tsx
 * @description Écran Profil — preuve de vie des stores Zustand.
 *              Profile screen — Zustand stores proof of life.
 *
 *              Affiche l'état auth + préférences et permet :
 *              - Connexion en tant qu'invité
 *              - Déconnexion
 *              - Cycle du thème (system → light → dark → system)
 *
 * @module presentation/screens/ProfileScreen
 */

// [MODIFIED] Retrait des démos Geocoding + GPS (déplacées dans CreateSessionScreen)
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme, type Theme } from '@core/theme';
import { Screen, Text } from '@presentation/components/atoms';
import {
  useAuthUser,
  useIsAuthenticated,
  useIsGuest,
  useAuthActions,
} from '@presentation/hooks/useAuth';
import { usePreferencesStore, type ThemeMode } from '@presentation/stores/usePreferencesStore';

// [ADDED] Ordre de cycle du thème / Theme cycle order
const THEME_CYCLE: readonly ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Retourne le ThemeMode suivant dans le cycle.
 * Returns the next ThemeMode in the cycle.
 *
 * @param current - Mode actuel / Current mode
 * @returns Mode suivant / Next mode
 */
const nextThemeMode = (current: ThemeMode): ThemeMode => {
  const idx = THEME_CYCLE.indexOf(current);
  const nextIdx = (idx + 1) % THEME_CYCLE.length;
  // idx est toujours valide car current vient du store typé
  // idx is always valid since current comes from the typed store
  return THEME_CYCLE[nextIdx] ?? 'system';
};

const ProfileScreen: React.FC = () => {
  const { t } = useTranslation('profile');
  const theme = useTheme();
  const styles = buildStyles(theme);

  // [ADDED] Sélecteurs auth
  const user = useAuthUser();
  const isAuthenticated = useIsAuthenticated();
  const isGuest = useIsGuest();
  const { signInAsGuest, signOut } = useAuthActions();

  // [ADDED] Sélecteurs préférences
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  // [ADDED] Handler cycle thème
  const handleCycleTheme = useCallback(() => {
    setThemeMode(nextThemeMode(themeMode));
  }, [themeMode, setThemeMode]);

  // [ADDED] Handler sign in guest
  const handleSignInGuest = useCallback(() => {
    signInAsGuest();
  }, [signInAsGuest]);

  // [ADDED] Handler sign out
  const handleSignOut = useCallback(() => {
    signOut();
  }, [signOut]);

  // [ADDED] Label localisé du thème courant
  const themeModeLabel = t(`themeLabels.${themeMode}`);

  return (
    <Screen background="primary">
      <ScrollView contentContainerStyle={styles.container}>
        {/* [MODIFIED] Titre */}
        <Text variant="h1" weight="bold" accessibilityRole="header">
          {t('title')}
        </Text>

        {/* [ADDED] Statut auth */}
        {isAuthenticated && user ? (
          <View
            style={styles.userInfo}
            accessibilityRole="text"
            accessibilityLabel={t('signedInAs', { name: user.displayName })}
          >
            <Text variant="bodyLg" weight="semibold">
              {t('signedInAs', { name: user.displayName })}
            </Text>
            {isGuest ? (
              <View style={styles.badge}>
                <Text variant="caption" weight="medium" color="onBrand">
                  {t('guestBadge')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text variant="body" color="secondary">
            {t('notSignedIn')}
          </Text>
        )}

        {/* [ADDED] Thème courant */}
        <Text
          variant="body"
          color="secondary"
          accessibilityRole="text"
          accessibilityLabel={t('currentTheme', { mode: themeModeLabel })}
        >
          {t('currentTheme', { mode: themeModeLabel })}
        </Text>

        {/* [ADDED] Actions */}
        <View style={styles.actions}>
          {!isAuthenticated ? (
            <Pressable
              style={({ pressed }) => [
                styles.buttonPrimary,
                pressed ? styles.buttonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.signInGuest')}
              accessibilityHint={t('hints.signInGuest')}
              onPress={handleSignInGuest}
            >
              <Text variant="body" weight="semibold" color="onBrand">
                {t('actions.signInGuest')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.buttonDanger,
                pressed ? styles.buttonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.signOut')}
              accessibilityHint={t('hints.signOut')}
              onPress={handleSignOut}
            >
              <Text variant="body" weight="semibold" color="onBrand">
                {t('actions.signOut')}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.buttonSecondary,
              pressed ? styles.buttonPressed : undefined,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('actions.cycleTheme')}
            accessibilityHint={t('hints.cycleTheme')}
            onPress={handleCycleTheme}
          >
            <Text variant="body" weight="semibold">
              {t('actions.cycleTheme')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

// [MODIFIED] Styles via tokens — retrait des styles démo (geocodeSection, geocodeInput, etc.)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
    },
    userInfo: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    badge: {
      backgroundColor: theme.color.interactive.accent.default,
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
    },
    actions: {
      width: '100%',
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    buttonPrimary: {
      backgroundColor: theme.color.interactive.brand.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDanger: {
      backgroundColor: theme.color.interactive.danger.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonSecondary: {
      backgroundColor: theme.color.interactive.neutral.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: 0.8,
    },
  });

export default ProfileScreen;
