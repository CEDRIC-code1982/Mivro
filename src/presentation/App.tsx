/**
 * @file App.tsx
 * @description Point d'entrée de l'application Mivro.
 *              Mivro application entry point.
 *
 *              Bootstrap : getEncryptionKey() → initContainer() → render.
 *
 * @module presentation/App
 */

// [MODIFIED] i18n initialization — must be imported before any component using useTranslation
import '@/i18n';

// [MODIFIED] Added bootstrap with DI container + encryption key
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'; // [FIXED P1]
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query'; // [ADDED]
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // [ADDED]
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getContainer, initContainer } from '@/di/container'; // [MODIFIED]
import { ThemeModeProvider, useTheme } from '@core/theme'; // [FIXED P0-6]
import { getEncryptionKey } from '@infrastructure/storage/getEncryptionKey';
import { AppErrorBoundary } from '@presentation/components/templates/AppErrorBoundary'; // [ADDED]
import RootNavigator from '@presentation/navigation/RootNavigator';
import { usePreferencesStore } from '@presentation/stores/usePreferencesStore'; // [FIXED P0-6]

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
        {/* [ADDED] ErrorBoundary global — capture les erreurs React non gérées */}
        <AppErrorBoundary>
          {/* [ADDED] QueryClientProvider — TanStack Query pour geocoding + futures queries */}
          <QueryClientProvider client={getContainer().queryClient}>
            {/* [FIXED P1] BottomSheetModalProvider — rend les sheets en overlay racine
                (portail) plutôt que dans le flux d'un ScrollView (champ fantôme F1). */}
            <BottomSheetModalProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </BottomSheetModalProvider>
          </QueryClientProvider>
        </AppErrorBoundary>
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
        <ActivityIndicator size="large" color={theme.color.interactive.brand.default} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
