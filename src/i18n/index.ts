// [ADDED] i18n configuration — i18next + react-i18next + react-native-localize
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import commonEn from './locales/en/common.json';
import createEn from './locales/en/create.json';
import mapEn from './locales/en/map.json';
import navigationEn from './locales/en/navigation.json';
import poiEn from './locales/en/poi.json'; // [ADDED]
import profileEn from './locales/en/profile.json';
import sessionsEn from './locales/en/sessions.json';
import commonFr from './locales/fr/common.json';
import createFr from './locales/fr/create.json';
import mapFr from './locales/fr/map.json';
import navigationFr from './locales/fr/navigation.json';
import poiFr from './locales/fr/poi.json'; // [ADDED]
import profileFr from './locales/fr/profile.json';
import sessionsFr from './locales/fr/sessions.json';

// [MODIFIED] Namespace definitions per CLAUDE.md — added navigation, map, sessions, create, profile
const resources = {
  fr: {
    common: commonFr,
    create: createFr,
    map: mapFr,
    navigation: navigationFr,
    poi: poiFr, // [ADDED]
    profile: profileFr,
    sessions: sessionsFr,
  },
  en: {
    common: commonEn,
    create: createEn,
    map: mapEn,
    navigation: navigationEn,
    poi: poiEn, // [ADDED]
    profile: profileEn,
    sessions: sessionsEn,
  },
} as const;

// [ADDED] Detect system language via react-native-localize
const getDeviceLanguage = (): string => {
  const locales = getLocales();
  const deviceLang = locales[0]?.languageCode ?? 'fr';
  // [ADDED] Only support fr/en, fallback to fr
  return deviceLang === 'en' ? 'en' : 'fr';
};

/**
 * Initializes i18next with react-i18next integration.
 *
 * @remarks
 * - Fallback language: fr
 * - Namespaces: common, auth, map, poi, profile, realtime
 * - Default namespace: common
 * - Language detection via react-native-localize
 */
i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'fr',
  // [MODIFIED] Added navigation, sessions, create namespaces
  ns: ['common', 'auth', 'create', 'map', 'navigation', 'poi', 'profile', 'realtime', 'sessions'],
  defaultNS: 'common',
  interpolation: {
    // [ADDED] React already escapes output
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
