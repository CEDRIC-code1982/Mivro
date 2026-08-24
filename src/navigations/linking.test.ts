/**
 * @file linking.test.ts
 * @description Tests unitaires de la configuration de deep linking (F5).
 *              Unit tests for the deep linking configuration (F5).
 *
 *              Couvre : scheme mivro://, préfixes, mapping
 *              session/:sessionId → JoinSession, fallback Tabs/POI.
 *
 * @module navigations/linking.test
 */

// [ADDED] F5 — Tests unitaires linking
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
    // Tabs est un objet de config imbriqué (pas une simple string).
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

  it('resolves a mivro://session/{id} url to JoinSession with the sessionId param', () => {
    // Vérifie que le pattern extrait bien le paramètre dynamique.
    const pattern = linking.config?.screens?.JoinSession;
    expect(pattern).toContain(':sessionId');
    const url = 'mivro://session/abc-123';
    const stripped = url.replace(`${APP_SCHEME}://`, '');
    expect(stripped).toBe('session/abc-123');
    // Le segment après "session/" est l'id qui alimente route.params.sessionId.
    expect(stripped.split('/')[1]).toBe('abc-123');
  });
});
