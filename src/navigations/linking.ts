/**
 * @file linking.ts
 * @description React Navigation deep linking configuration (F5).
 *
 *              Scheme `mivro://` (no universal links for the MVP, see CLAUDE.md).
 *              Mapping: `mivro://session/{sessionId}` → `JoinSession` screen.
 *
 *              ⚠️ Native config required (on top of this file):
 *              - iOS: `CFBundleURLTypes` (scheme `mivro`) in Info.plist
 *              - Android: `<intent-filter>` (scheme `mivro`) in AndroidManifest
 *
 * @module navigations/linking
 */

// [ADDED] F5 — deep linking configuration
import type { LinkingOptions } from '@react-navigation/native';
import { Linking } from 'react-native';
import type { RootStackParamList } from './types';

/** App scheme (see the iOS/Android native config). */
export const APP_SCHEME = 'mivro';

/**
 * URL prefixes recognized by deep linking.
 */
export const LINKING_PREFIXES = [`${APP_SCHEME}://`];

/**
 * Longest wait, in milliseconds, for the URL that launched the app.
 *
 * React Navigation's default `getInitialURL` gives up after 150 ms and then
 * opens the default screen: on a cold start in Debug on an iOS device, the
 * native `Linking` module answers later than that, so the launch link was lost
 * (JOURNAL J-066). Past this delay the app starts without a link rather than
 * staying on a blank screen if the native call never answers.
 */
export const INITIAL_URL_TIMEOUT_MS = 3000;

/**
 * Reads the URL that launched the app, waiting at most `INITIAL_URL_TIMEOUT_MS`.
 *
 * Replaces React Navigation's default, whose 150 ms race loses cold-start
 * links (J-066). A failing native call resolves to `null`: the app then opens
 * its default screen instead of crashing.
 *
 * @returns The launch URL, or `null` when there is none, it fails or it is too late
 */
export const getInitialURL = (): Promise<string | null> =>
  new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), INITIAL_URL_TIMEOUT_MS);
    const settle = (url: string | null) => {
      clearTimeout(timer);
      resolve(url);
    };
    Linking.getInitialURL().then(settle, () => settle(null));
  });

/**
 * Linking options for the NavigationContainer.
 *
 * The `session/:sessionId` path maps to the `JoinSession` screen of the Root
 * Stack; the `sessionId` param is extracted from the URL and typed.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: LINKING_PREFIXES,
  // [FIXED] J-066 — cold-start link lost to React Navigation's 150 ms timeout
  getInitialURL,
  config: {
    screens: {
      // mivro://session/{sessionId} → join screen
      JoinSession: 'session/:sessionId',
      // Tabs (root fallback)
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
