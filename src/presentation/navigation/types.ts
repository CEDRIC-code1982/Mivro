/**
 * @file types.ts
 * @description Types de navigation — typage fort des routes React Navigation.
 *              Navigation types — strongly typed React Navigation routes.
 *
 * @module presentation/navigation/types
 */

// [ADDED] Typage fort des routes de navigation
import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Paramètres des routes du Bottom Tabs Navigator.
 * Bottom Tabs Navigator route params.
 */
export type BottomTabsParamList = {
  Map: undefined;
  Sessions: undefined;
  Create: undefined;
  Profile: undefined;
};

/**
 * Paramètres des routes du Root Stack Navigator.
 * Root Stack Navigator route params.
 *
 * @remarks Ajoutera SessionDetail, Settings, etc. en phases suivantes.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<BottomTabsParamList>;
  POI: undefined; // [ADDED] écran POI F3
};

// [ADDED] Déclaration globale pour le typage automatique de useNavigation()
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
