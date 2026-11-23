/**
 * @file App.tsx
 * @description Mivro application entry point.
 *
 *              Bootstrap: getEncryptionKey() → initContainer() → render.
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
 * Theme provider connected to the preferences store.
 *
 * Reads themeMode from usePreferencesStore and provides it
 * to ThemeModeContext so useTheme() respects it.
 *
 * @param children - Children to wrap
 * @returns Provider with themeMode
 */
// [FIXED P0-6] Theme provider reads from preferences store
const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  return <ThemeModeProvider value={themeMode}>{children}</ThemeModeProvider>;
};

/**
 * Full-screen loading view: theme background and a centered spinner.
 *
 * Shown while the container bootstraps, and by NavigationContainer while it reads the
 * launch link.
 *
 * @returns Loading view
 */
// [ADDED] J-066 — shared by the bootstrap screen and the NavigationContainer fallback
const LoadingScreen: React.FC = () => {
  const theme = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.color.surface.primary }]}>
      <ActivityIndicator size="large" color={theme.color.text.brand} />
    </View>
  );
};

/**
 * Biometric lock (F8) — blocking overlay rendered above the whole app.
 *
 * Architecture decision: overlay (not a navigation route) because the lock must
 * block ALL screens/tabs regardless of navigation state and survive AppState
 * transitions (re-lock on returning from background).
 *
 * @returns App tree + lock overlay
 */
// [ADDED] F8 — Biometric gate
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
      {/* [ADDED] F8 — when locked, the whole underlying tree is removed from the
          accessibility tree (TalkBack/VoiceOver) on top of the overlay:
          accessibilityViewIsModal is iOS-only, no-hide-descendants covers Android. */}
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
 * App content after bootstrap is complete.
 *
 * Separated so useTheme() is called UNDER the ThemeModeProvider.
 *
 * @returns Main React tree
 */
// [FIXED P0-6] Separate component — useTheme reads from context
const AppContent: React.FC = () => {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
        {/* [ADDED] F8 — biometric lock: blocking overlay above everything.
            The gate wraps the app tree so it can remove it from the a11y tree
            (no-hide-descendants) when locked. */}
        <BiometricLockGate>
          {/* [ADDED] Global ErrorBoundary — catches unhandled React errors */}
          <AppErrorBoundary>
            {/* [ADDED] QueryClientProvider — TanStack Query for geocoding + future queries */}
            <QueryClientProvider client={getContainer().queryClient}>
              {/* [FIXED P1] BottomSheetModalProvider — renders sheets as a root overlay
                  (portal) rather than inside a ScrollView's flow (F1 ghost field). */}
              <BottomSheetModalProvider>
                {/* [ADDED] F5 — linking: opens mivro://session/{id} on the JoinSession screen.
                    [FIXED] J-066 — the container renders its fallback while it waits for the
                    launch link (up to INITIAL_URL_TIMEOUT_MS), not a blank screen. */}
                <NavigationContainer linking={linking} fallback={<LoadingScreen />}>
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
 * Mivro root application component.
 *
 * @returns App component
 */
const App: React.FC = () => {
  const [ready, setReady] = useState(false);

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
        // In production: show a fatal error screen.
      }
    };
    bootstrap();
  }, []);

  // [ADDED] Loading screen while the container bootstraps.
  // Outside AppThemeProvider: useTheme() reads the default context ('system').
  if (!ready) {
    return <LoadingScreen />;
  }

  // [FIXED P0-6] AppThemeProvider wraps content so useTheme respects user preference
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
};

// [ADDED] Root and loading screen styles
const styles = StyleSheet.create({
  // [ADDED] GestureHandlerRootView must fill the screen
  gestureRoot: {
    flex: 1,
  },
  // [ADDED] F8 — container of the app tree under the overlay (hidden from a11y when locked).
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
