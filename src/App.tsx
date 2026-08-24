/**
 * @file App.tsx
 * @description Point d'entrée de l'application Mivro.
 *              Mivro application entry point.
 *
 *              Bootstrap : getEncryptionKey() → initContainer() → render.
 *
 * @module App
 */

// [MODIFIED] i18n initialization — must be imported before any component using useTranslation
import '@/i18n';

// [MODIFIED] Added bootstrap with DI container + encryption key
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'; // [FIXED P1]
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query'; // [ADDED]
import { ThemeModeProvider, useTheme } from '@theme'; // [FIXED P0-6]
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // [ADDED]
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BiometricLockScreen from '@components/molecules/BiometricLockScreen'; // [ADDED] F8
import { AppErrorBoundary } from '@components/templates/AppErrorBoundary'; // [ADDED]
import { useBiometricLock } from '@features/Biometric/hooks/useBiometricLock'; // [ADDED] F8
import { linking } from '@navigations/linking'; // [ADDED] F5 — deep linking
import RootNavigator from '@navigations/RootNavigator';
import { getEncryptionKey } from '@services/infra/storage/getEncryptionKey';
import { getContainer, initContainer } from '@services/serviceContainer'; // [MODIFIED]
import { usePreferencesStore } from '@state/usePreferencesStore'; // [FIXED P0-6]

/**
 * Provider de thème connecté au store de préférences.
 * Theme provider connected to the preferences store.
 *
 * Lit themeMode depuis usePreferencesStore et le fournit
 * au ThemeModeContext pour que useTheme() le respecte.
 * Reads themeMode from usePreferencesStore and provides it
 * to ThemeModeContext so useTheme() respects it.
 *
 * @param children - Enfants à wrapper / Children to wrap
 * @returns Provider avec themeMode / Provider with themeMode
 */
// [FIXED P0-6] Theme provider reads from preferences store
const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  return <ThemeModeProvider value={themeMode}>{children}</ThemeModeProvider>;
};

/**
 * Verrou biométrique (F8) — overlay bloquant rendu au-dessus de toute l'app.
 * Biometric lock (F8) — blocking overlay rendered above the whole app.
 *
 * Décision d'archi : overlay (et non une route de navigation) car le verrou
 * doit bloquer TOUS les écrans/onglets quel que soit l'état de la navigation,
 * et survivre aux transitions AppState (re-lock en retour d'arrière-plan).
 * Architecture decision: overlay (not a navigation route) because the lock must
 * block ALL screens/tabs regardless of navigation state and survive AppState
 * transitions (re-lock on returning from background).
 *
 * @returns Arbre app + overlay verrou / App tree + lock overlay
 */
// [ADDED] F8 — Gate biométrique
const BiometricLockGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isLocked,
    supportedType,
    unlockError,
    showDisableEscape,
    unlock,
    disableLockAndContinue,
  } = useBiometricLock();

  return (
    <>
      {/* [ADDED] F8 — quand verrouillé, on exclut tout l'arbre sous-jacent de
          l'arbre d'accessibilité (TalkBack/VoiceOver) en plus de l'overlay :
          accessibilityViewIsModal est iOS-only, no-hide-descendants couvre Android. */}
      <View
        style={styles.appTree}
        importantForAccessibility={isLocked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={isLocked}
      >
        {children}
      </View>
      {isLocked ? (
        <BiometricLockScreen
          supportedType={supportedType}
          errorCode={unlockError}
          showDisableEscape={showDisableEscape}
          onUnlock={unlock}
          onDisableAndContinue={disableLockAndContinue}
          testID="biometric-lock-screen"
        />
      ) : null}
    </>
  );
};

/**
 * Contenu de l'app une fois le bootstrap terminé.
 * App content after bootstrap is complete.
 *
 * Séparé pour que useTheme() soit appelé SOUS le ThemeModeProvider.
 * Separated so useTheme() is called UNDER the ThemeModeProvider.
 *
 * @returns Arbre React principal / Main React tree
 */
// [FIXED P0-6] Separate component — useTheme reads from context
const AppContent: React.FC = () => {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
        {/* [ADDED] F8 — verrou biométrique : overlay bloquant au-dessus de tout.
            Le gate enveloppe l'arbre app pour pouvoir l'exclure de l'arbre a11y
            (no-hide-descendants) quand verrouillé. */}
        <BiometricLockGate>
          {/* [ADDED] ErrorBoundary global — capture les erreurs React non gérées */}
          <AppErrorBoundary>
            {/* [ADDED] QueryClientProvider — TanStack Query pour geocoding + futures queries */}
            <QueryClientProvider client={getContainer().queryClient}>
              {/* [FIXED P1] BottomSheetModalProvider — rend les sheets en overlay racine
                  (portail) plutôt que dans le flux d'un ScrollView (champ fantôme F1). */}
              <BottomSheetModalProvider>
                {/* [ADDED] F5 — linking : ouvre mivro://session/{id} sur l'écran JoinSession */}
                <NavigationContainer linking={linking}>
                  <RootNavigator />
                </NavigationContainer>
              </BottomSheetModalProvider>
            </QueryClientProvider>
          </AppErrorBoundary>
        </BiometricLockGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

/**
 * Composant racine de l'application Mivro.
 * Mivro root application component.
 *
 * @returns Composant App / App component
 */
const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const theme = useTheme(); // Default context ('system') — loading screen only

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const key = await getEncryptionKey();
        initContainer(key);
        setReady(true);
        console.log(
          `[INFO][App][bootstrap][?][${new Date().toISOString().slice(11, 19)}] ` +
            'App bootstrap complete',
        );
      } catch (error) {
        console.error(
          `[ERROR][App][bootstrap][?][${new Date().toISOString().slice(11, 19)}] ` +
            'Failed to bootstrap container',
          error,
        );
        // En production : afficher un écran d'erreur fatale.
        // In production: show a fatal error screen.
      }
    };
    bootstrap();
  }, []);

  // [ADDED] Loading screen pendant le bootstrap du container
  if (!ready) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.color.surface.primary }]}>
        <ActivityIndicator size="large" color={theme.color.text.brand} />
      </View>
    );
  }

  // [FIXED P0-6] AppThemeProvider wraps content so useTheme respects user preference
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
};

// [ADDED] Styles pour l'écran de chargement
const styles = StyleSheet.create({
  // [ADDED] GestureHandlerRootView must fill the screen
  gestureRoot: {
    flex: 1,
  },
  // [ADDED] F8 — conteneur de l'arbre app sous l'overlay (exclu de l'a11y quand verrouillé).
  appTree: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
