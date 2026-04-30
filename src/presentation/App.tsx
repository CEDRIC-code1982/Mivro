/**
 * @file App.tsx
 * @description Point d'entrée de l'application MidPoint.
 *              MidPoint application entry point.
 *
 * @module presentation/App
 */

// [MODIFIED] i18n initialization — must be imported before any component using useTranslation
import '@/i18n';

// [MODIFIED] Replaced RN template with navigation stack
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from '@presentation/navigation/RootNavigator';

/**
 * Composant racine de l'application MidPoint.
 * MidPoint root application component.
 *
 * @returns Composant App / App component
 */
const App: React.FC = () => {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
