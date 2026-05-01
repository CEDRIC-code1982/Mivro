// [ADDED] Jest setup — RNTL matchers
require('@testing-library/jest-native/extend-expect');

// [ADDED] Mock react-native-safe-area-context (native module unavailable in Jest)
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children, testID, edges, style }) =>
      React.createElement(View, { testID, edges, style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
  };
});

// [MODIFIED] Mock react-native-mmkv (native module unavailable in Jest)
// Expose both MMKV constructor (used by container.ts) and createMMKV
jest.mock('react-native-mmkv', () => {
  const createMockMMKV = () => {
    const store = new Map();
    return {
      getString: jest.fn((key) => store.get(key)),
      set: jest.fn((key, value) => store.set(key, value)),
      delete: jest.fn((key) => store.delete(key)),
      clearAll: jest.fn(() => store.clear()),
      getAllKeys: jest.fn(() => [...store.keys()]),
    };
  };
  return {
    MMKV: jest.fn(() => createMockMMKV()),
    createMMKV: jest.fn(() => createMockMMKV()),
  };
});

// [ADDED] Mock react-native-keychain (native module unavailable in Jest)
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue(true),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK: 'AfterFirstUnlock',
    WHEN_UNLOCKED: 'WhenUnlocked',
    ALWAYS: 'Always',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WhenPasscodeSetThisDeviceOnly',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
}));

// [ADDED] Mock react-native-config (native module unavailable in Jest)
jest.mock('react-native-config', () => ({
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: 'test',
  SENTRY_RELEASE: '',
}));

// [ADDED] Mock @sentry/react-native (native module unavailable in Jest)
jest.mock('@sentry/react-native', () => {
  const createMockScope = () => ({
    setLevel: jest.fn(),
    setTags: jest.fn(),
    setExtras: jest.fn(),
    setTag: jest.fn(),
    setExtra: jest.fn(),
    setUser: jest.fn(),
  });

  return {
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    addBreadcrumb: jest.fn(),
    flush: jest.fn().mockResolvedValue(true),
    wrap: jest.fn((component) => component),
    withScope: jest.fn((callback) => callback(createMockScope())),
    Scope: jest.fn(() => createMockScope()),
  };
});

// [ADDED] Mock react-native-localize (native module unavailable in Jest)
jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'fr', countryCode: 'FR', languageTag: 'fr-FR', isRTL: false }],
  getNumberFormatSettings: () => ({ decimalSeparator: ',', groupingSeparator: ' ' }),
  getCalendar: () => 'gregorian',
  getCountry: () => 'FR',
  getCurrencies: () => ['EUR'],
  getTemperatureUnit: () => 'celsius',
  getTimeZone: () => 'Europe/Paris',
  uses24HourClock: () => true,
  usesMetricSystem: () => true,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));
