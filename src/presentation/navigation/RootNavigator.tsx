/**
 * @file RootNavigator.tsx
 * @description Root Stack Navigator — point d'entrée de la navigation.
 *              Root Stack Navigator — navigation entry point.
 *
 * @module presentation/navigation/RootNavigator
 */

// [ADDED] Root Stack Navigator avec Native Stack
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import JoinSessionScreen from '@presentation/screens/JoinSessionScreen'; // [ADDED] F5
import POIScreen from '@presentation/screens/POIScreen'; // [ADDED]
import BottomTabsNavigator from './BottomTabsNavigator';
import type { RootStackParamList } from './types';

// [ADDED] Typed native stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator — enveloppe la navigation de l'app.
 * Root Navigator — wraps the app navigation.
 *
 * @remarks Ajoutera SessionDetail, Settings, etc. en phases suivantes.
 * @returns Composant RootNavigator / RootNavigator component
 */
const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={BottomTabsNavigator} />
      {/* [ADDED] Écran POI F3 */}
      <Stack.Screen name="POI" component={POIScreen} />
      {/* [ADDED] F5 — écran de jointure (deep link mivro://session/:sessionId) */}
      <Stack.Screen name="JoinSession" component={JoinSessionScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
