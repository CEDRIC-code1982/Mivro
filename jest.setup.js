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

// [ADDED] Mock @react-native-community/geolocation (native module unavailable in Jest)
// The lib exports { __esModule: true, default: { setRNConfiguration, getCurrentPosition, ... } }
// Babel's interopRequireDefault picks up .default when __esModule is true
jest.mock('@react-native-community/geolocation', () => {
  const mockGeolocation = {
    setRNConfiguration: jest.fn(),
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
    requestAuthorization: jest.fn(),
  };
  return { __esModule: true, default: mockGeolocation };
});

// [ADDED] Mock react-native-gesture-handler (native module unavailable in Jest)
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, style }) => React.createElement(View, { style }, children),
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    NativeViewGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((component) => component),
    Directions: {},
  };
});

// [ADDED] Mock @gorhom/bottom-sheet (native module unavailable in Jest)
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');
  // [FIXED P0-2/P0-3] Spread all props for testability + render backdrop
  const BottomSheet = React.forwardRef((props, ref) => {
    const { children, backdropComponent: BackdropComp, ...viewProps } = props;
    React.useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      close: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
    }));
    return React.createElement(
      View,
      viewProps,
      BackdropComp != null ? React.createElement(BackdropComp, { testID: 'mock-backdrop' }) : null,
      children,
    );
  });
  BottomSheet.displayName = 'BottomSheet';
  // [FIXED P1] BottomSheetModal — version portail (rend les enfants en continu pour les tests)
  const BottomSheetModal = React.forwardRef((props, ref) => {
    const { children, backdropComponent: BackdropComp, ...viewProps } = props;
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
      snapToIndex: jest.fn(),
      close: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
    }));
    return React.createElement(
      View,
      viewProps,
      BackdropComp != null ? React.createElement(BackdropComp, { testID: 'mock-backdrop' }) : null,
      children,
    );
  });
  BottomSheetModal.displayName = 'BottomSheetModal';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetModal,
    BottomSheetModalProvider: ({ children }) => React.createElement(View, null, children),
    BottomSheetView: ({ children, style, testID }) =>
      React.createElement(View, { style, testID }, children),
    BottomSheetTextInput: React.forwardRef((props, ref) =>
      React.createElement(TextInput, { ...props, ref }),
    ),
    // [FIXED P1] Rend réellement data/renderItem (comme un FlatList) pour les tests
    BottomSheetFlatList: ({ data, renderItem, keyExtractor, ...rest }) =>
      React.createElement(
        View,
        rest,
        (data || []).map((item, index) =>
          React.createElement(
            View,
            { key: keyExtractor ? keyExtractor(item, index) : index },
            renderItem({ item, index }),
          ),
        ),
      ),
    BottomSheetScrollView: View,
    BottomSheetBackdrop: View,
    BottomSheetHandle: View,
    useBottomSheet: () => ({ close: jest.fn(), expand: jest.fn(), snapToIndex: jest.fn() }),
    useBottomSheetModal: () => ({ dismiss: jest.fn(), dismissAll: jest.fn() }),
  };
});

// [ADDED] Mock react-native-maps (native module unavailable in Jest)
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }),
  );
  MockMapView.displayName = 'MockMapView';
  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props) => React.createElement(View, props),
    Circle: (props) => React.createElement(View, props),
    PROVIDER_GOOGLE: 'google',
  };
});

// [ADDED] F7 passe 2 — Mock react-native-image-picker (native module unavailable in Jest)
// Les tests d'adapter surchargent ces mocks via jest.mocked(...).mockResolvedValue(...).
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// [ADDED] F7 passe 2 — Mock @dr.pogodin/react-native-fs (native module unavailable in Jest)
// DocumentDirectoryPath est une constante ; les fonctions FS sont des jest.fn surchargeables.
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/Documents',
  copyFile: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// [ADDED] F4 — Mock @react-native-firebase/app (native module unavailable in Jest)
jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
  getApps: jest.fn(() => [{ name: '[DEFAULT]' }]),
  initializeApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

// [ADDED] F4 — Mock @react-native-firebase/database (API modulaire v25 — native module unavailable in Jest)
// Expose les exports modulaires utilisés par FirebaseRealtimeService :
// getDatabase, ref, onValue, onDisconnect, update, remove, serverTimestamp, get.
// Les tests d'adapter surchargent ces mocks via jest.mocked(...).mockImplementation(...).
jest.mock('@react-native-firebase/database', () => {
  // serverTimestamp() retourne un sentinel reconnaissable (le natif renvoie un placeholder).
  const SERVER_TIMESTAMP_SENTINEL = { '.sv': 'timestamp' };
  return {
    __esModule: true,
    getDatabase: jest.fn(() => ({ __mockDatabase: true })),
    ref: jest.fn((_db, path) => ({ __mockRef: true, path })),
    onValue: jest.fn(() => jest.fn()),
    onDisconnect: jest.fn(() => ({
      update: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    })),
    update: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({ val: () => null, exists: () => false }),
    serverTimestamp: jest.fn(() => SERVER_TIMESTAMP_SENTINEL),
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
