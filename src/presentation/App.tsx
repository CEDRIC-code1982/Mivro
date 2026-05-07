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
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initContainer } from '@/di/container';
import { useTheme } from '@core/theme';
import { getEncryptionKey } from '@infrastructure/storage/getEncryptionKey';
import { AppErrorBoundary } from '@presentation/components/templates/AppErrorBoundary'; // [ADDED]
import RootNavigator from '@presentation/navigation/RootNavigator';

/**
 * Composant racine de l'application Mivro.
 * Mivro root application component.
 *
 * @returns Composant App / App component
 */
const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';
  const theme = useTheme();

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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {/* [ADDED] ErrorBoundary global — capture les erreurs React non gérées */}
      <AppErrorBoundary>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
};

// [ADDED] Styles pour l'écran de chargement
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
