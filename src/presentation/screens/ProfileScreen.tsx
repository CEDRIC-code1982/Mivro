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

// [MODIFIED] Remplacement du placeholder par intégration stores
import React, { useCallback, useState } from 'react'; // [MODIFIED]
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'; // [MODIFIED]
import { getContainer } from '@/di/container'; // [ADDED]
import type { Location } from '@core/entities/Location'; // [ADDED]
import type { GeolocationErrorCode } from '@core/ports/IGeolocationService'; // [ADDED]
import { GeolocationError } from '@core/ports/IGeolocationService'; // [ADDED]
import { useTheme, type Theme } from '@core/theme';
import { Screen, Text } from '@presentation/components/atoms';
import {
  useAuthUser,
  useIsAuthenticated,
  useIsGuest,
  useAuthActions,
} from '@presentation/hooks/useAuth';
import { useGeocodeQuery } from '@presentation/hooks/useGeocodeQuery'; // [ADDED]
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

  // [TEMP] Démo Geocoding — sera retirée en Phase F1
  const [geocodeInput, setGeocodeInput] = useState('');
  const {
    data: geocodeResults,
    isLoading: geocodeLoading,
    error: geocodeError,
  } = useGeocodeQuery({
    query: geocodeInput,
    options: { language: 'fr' },
  });

  // [TEMP] Démo GPS — sera retirée en Phase F1
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<Location | null>(null);
  const [gpsError, setGpsError] = useState<GeolocationErrorCode | null>(null);

  const handleTestGPS = useCallback(async () => {
    setGpsLoading(true);
    setGpsLocation(null);
    setGpsError(null);
    try {
      const { getCurrentLocationUseCase } = getContainer();
      const location = await getCurrentLocationUseCase.execute({ language: 'fr' });
      setGpsLocation(location);
    } catch (error) {
      if (error instanceof GeolocationError) {
        setGpsError(error.code);
      } else {
        setGpsError('unknown');
      }
    } finally {
      setGpsLoading(false);
    }
  }, []);

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

        {/* [TEMP] Démo Geocoding — sera retirée en Phase F1 */}
        <View style={styles.geocodeSection}>
          <Text variant="h2" weight="semibold">
            {t('geocodeDemo.title')}
          </Text>
          <TextInput
            style={styles.geocodeInput}
            value={geocodeInput}
            onChangeText={setGeocodeInput}
            placeholder={t('geocodeDemo.placeholder')}
            placeholderTextColor={theme.color.text.tertiary}
            accessibilityLabel={t('geocodeDemo.placeholder')}
            accessibilityHint={t('geocodeDemo.placeholder')}
          />
          {geocodeLoading ? (
            <View style={styles.geocodeStatus}>
              <ActivityIndicator size="small" color={theme.color.interactive.brand.default} />
              <Text variant="body" color="secondary">
                {t('geocodeDemo.loading')}
              </Text>
            </View>
          ) : null}
          {geocodeError ? (
            <Text variant="body" color="error">
              {t('geocodeDemo.error', { message: geocodeError.message })}
            </Text>
          ) : null}
          {geocodeResults && geocodeResults.length === 0 && geocodeInput.trim().length >= 3 ? (
            <Text variant="body" color="secondary">
              {t('geocodeDemo.noResults')}
            </Text>
          ) : null}
          {geocodeResults && geocodeResults.length > 0 ? (
            <View style={styles.geocodeResults}>
              <Text variant="caption" color="secondary">
                {t('geocodeDemo.results', { count: geocodeResults.length })}
              </Text>
              {geocodeResults.map((result) => (
                <View key={result.externalId} style={styles.geocodeResultItem}>
                  <Text variant="body">{result.displayName}</Text>
                  <Text variant="caption" color="tertiary">
                    {result.coordinates.latitude.toFixed(4)},{' '}
                    {result.coordinates.longitude.toFixed(4)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* [TEMP] Démo GPS — sera retirée en Phase F1 UI */}
        <View style={styles.geocodeSection}>
          <Text variant="h2" weight="semibold">
            {t('gpsDemo.title')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.buttonPrimary,
              pressed ? styles.buttonPressed : undefined,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('gpsDemo.button')}
            onPress={handleTestGPS}
            disabled={gpsLoading}
          >
            <Text variant="body" weight="semibold" color="onBrand">
              {t('gpsDemo.button')}
            </Text>
          </Pressable>
          {gpsLoading ? (
            <View style={styles.geocodeStatus}>
              <ActivityIndicator size="small" color={theme.color.interactive.brand.default} />
              <Text variant="body" color="secondary">
                {t('gpsDemo.loading')}
              </Text>
            </View>
          ) : null}
          {gpsError ? (
            <Text variant="body" color="error">
              {t(`gpsDemo.errors.${gpsError}`)}
            </Text>
          ) : null}
          {gpsLocation ? (
            <View style={styles.geocodeResultItem}>
              <Text variant="body" weight="semibold">
                {t('gpsDemo.success')}
              </Text>
              <Text variant="body">
                {t('gpsDemo.address', { address: gpsLocation.formattedAddress })}
              </Text>
              <Text variant="caption" color="tertiary">
                {t('gpsDemo.coords', {
                  lat: `${gpsLocation.coordinates.latitude.toFixed(2)}**`,
                  lon: `${gpsLocation.coordinates.longitude.toFixed(2)}**`,
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
};

// [MODIFIED] Styles via tokens — zéro magic number (DS-001)
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
    // [TEMP] Styles Geocoding démo — sera retiré en Phase F1
    geocodeSection: {
      width: '100%',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    geocodeInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touchTarget.min,
      color: theme.color.text.primary,
      fontSize: theme.typography.fontSize.body,
    },
    geocodeStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    geocodeResults: {
      gap: theme.spacing.xs,
    },
    geocodeResultItem: {
      backgroundColor: theme.color.surface.secondary,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      gap: theme.spacing.xxs,
    },
  });

export default ProfileScreen;
