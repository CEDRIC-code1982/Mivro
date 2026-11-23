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
import { Linking } from 'react-native';
import {
  APP_SCHEME,
  INITIAL_URL_TIMEOUT_MS,
  LINKING_PREFIXES,
  getInitialURL,
  linking,
} from '@navigations/linking';

// Past React Navigation's default 150 ms race, which lost cold-start links (J-066).
const SLOW_NATIVE_ANSWER_MS = 500;
const LAUNCH_URL = 'mivro://session/abc-123';

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

  it('replaces the default getInitialURL of React Navigation', () => {
    expect(linking.getInitialURL).toBe(getInitialURL);
  });
});

// Cold-start link: React Navigation's default gave up after 150 ms, so a native answer
// arriving later (Debug build on an iOS device) opened the default tab instead of
// JoinSession (J-066).
describe('getInitialURL', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const answerAfter = (delayMs: number, url: string | null) =>
    jest.spyOn(Linking, 'getInitialURL').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(url), delayMs);
        }),
    );

  it('returns a launch URL that the native module answers after 150 ms', async () => {
    answerAfter(SLOW_NATIVE_ANSWER_MS, LAUNCH_URL);
    const result = getInitialURL();
    jest.advanceTimersByTime(SLOW_NATIVE_ANSWER_MS);
    await expect(result).resolves.toBe(LAUNCH_URL);
    // The timeout timer is cleared once the native module has answered.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns null when the app was not launched by a link', async () => {
    answerAfter(0, null);
    const result = getInitialURL();
    jest.advanceTimersByTime(0);
    await expect(result).resolves.toBeNull();
  });

  it('returns null when the native call fails', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockRejectedValue(new Error('native failure'));
    await expect(getInitialURL()).resolves.toBeNull();
  });

  it('returns null when the native module never answers within the timeout', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockImplementation(() => new Promise(() => undefined));
    const result = getInitialURL();
    jest.advanceTimersByTime(INITIAL_URL_TIMEOUT_MS);
    await expect(result).resolves.toBeNull();
  });

  it('waits longer than the 150 ms of React Navigation', () => {
    expect(INITIAL_URL_TIMEOUT_MS).toBeGreaterThan(SLOW_NATIVE_ANSWER_MS);
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
