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
    </Stack.Navigator>
  );
};

export default RootNavigator;
