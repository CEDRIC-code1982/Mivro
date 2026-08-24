/**
 * @file linking.ts
 * @description Configuration du deep linking React Navigation (F5).
 *              React Navigation deep linking configuration (F5).
 *
 *              Scheme `mivro://` (pas d'universal links pour le MVP, cf. CLAUDE.md).
 *              Mapping : `mivro://session/{sessionId}` → écran `JoinSession`.
 *              Scheme `mivro://` (no universal links for the MVP). Mapping:
 *              `mivro://session/{sessionId}` → `JoinSession` screen.
 *
 *              ⚠️ Config native requise (à fournir en plus de ce fichier) :
 *              - iOS : `CFBundleURLTypes` (scheme `mivro`) dans Info.plist
 *              - Android : `<intent-filter>` (scheme `mivro`) dans AndroidManifest
 *
 * @module navigations/linking
 */

// [ADDED] F5 — Configuration deep linking
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Scheme de l'app (cf. config native iOS/Android) / App scheme */
export const APP_SCHEME = 'mivro';

/**
 * Préfixes d'URL reconnus par le deep linking.
 * URL prefixes recognized by deep linking.
 */
export const LINKING_PREFIXES = [`${APP_SCHEME}://`];

/**
 * Options de linking pour le NavigationContainer.
 * Linking options for the NavigationContainer.
 *
 * Le chemin `session/:sessionId` est mappé sur l'écran `JoinSession` du Root
 * Stack ; le paramètre `sessionId` est extrait de l'URL et typé.
 * The `session/:sessionId` path maps to the `JoinSession` screen of the Root
 * Stack; the `sessionId` param is extracted from the URL and typed.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: LINKING_PREFIXES,
  config: {
    screens: {
      // mivro://session/{sessionId} → écran de jointure
      JoinSession: 'session/:sessionId',
      // Onglets (fallback racine) / Tabs (root fallback)
      Tabs: {
        screens: {
          Map: 'map',
          Sessions: 'sessions',
          Create: 'create',
          Profile: 'profile',
        },
      },
      POI: 'poi',
    },
  },
};
