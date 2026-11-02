/**
 * @file linking.test.ts
 * @description Unit tests for the deep linking configuration (F5).
 *
 *              Covers: the mivro:// scheme, prefixes, the
 *              session/:sessionId → JoinSession mapping, the Tabs/POI fallback, and the
 *              real React Navigation path parser run on this configuration (no mock).
 *
 * @module navigations/linking.test
 */

// [ADDED] F5 — linking unit tests
import { getStateFromPath } from '@react-navigation/native';
import { APP_SCHEME, LINKING_PREFIXES, linking } from '@navigations/linking';

describe('linking configuration', () => {
  it('uses the mivro app scheme', () => {
    expect(APP_SCHEME).toBe('mivro');
  });

  it('registers the mivro:// prefix', () => {
    expect(LINKING_PREFIXES).toEqual(['mivro://']);
    expect(linking.prefixes).toEqual(['mivro://']);
  });

  it('maps session/:sessionId to the JoinSession screen', () => {
    const screens = linking.config?.screens ?? {};
    expect(screens.JoinSession).toBe('session/:sessionId');
  });

  it('maps the four tabs under the Tabs navigator', () => {
    const screens = linking.config?.screens ?? {};
    const tabs = screens.Tabs;
    // Tabs is a nested config object, not a plain string.
    expect(typeof tabs).toBe('object');
    const tabScreens =
      typeof tabs === 'object' && tabs !== null && 'screens' in tabs ? tabs.screens : undefined;
    expect(tabScreens).toEqual({
      Map: 'map',
      Sessions: 'sessions',
      Create: 'create',
      Profile: 'profile',
    });
  });

  it('maps the POI screen', () => {
    const screens = linking.config?.screens ?? {};
    expect(screens.POI).toBe('poi');
  });
});

// The real parser of @react-navigation/native, run on this configuration: the tests above
// only read the config object, so a React Navigation upgrade that changes how paths are
// parsed would go unnoticed (review of J-040 lot 5, 2026-11-02).
describe('linking resolved by React Navigation', () => {
  const resolve = (path: string) => getStateFromPath(path, linking.config);

  it('resolves session/{id} to JoinSession with the sessionId param', () => {
    const state = resolve('session/abc-123');
    expect(state?.routes[0]).toMatchObject({
      name: 'JoinSession',
      params: { sessionId: 'abc-123' },
    });
  });

  it('decodes a percent-encoded sessionId', () => {
    const state = resolve('session/a%20b');
    expect(state?.routes[0]).toMatchObject({
      name: 'JoinSession',
      params: { sessionId: 'a b' },
    });
  });

  it('resolves map to the Map tab inside Tabs', () => {
    const state = resolve('map');
    expect(state?.routes[0]?.name).toBe('Tabs');
    expect(state?.routes[0]?.state?.routes[0]?.name).toBe('Map');
  });

  it('does not throw on a malformed percent sequence', () => {
    // A crafted mivro://session/abc% link must not crash the app: the parser gives up
    // (undefined, i.e. the initial state) instead of passing a raw id to JoinSession.
    expect(() => resolve('session/abc%')).not.toThrow();
    expect(resolve('session/abc%')).toBeUndefined();
  });
});
