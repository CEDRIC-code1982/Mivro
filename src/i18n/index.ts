// [ADDED] i18n configuration — i18next + react-i18next + react-native-localize
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import commonEn from './locales/en/common.json';
import commonFr from './locales/fr/common.json';

// [ADDED] Namespace definitions per CLAUDE.md
const resources = {
  fr: {
    common: commonFr,
  },
  en: {
    common: commonEn,
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
  ns: ['common', 'auth', 'map', 'poi', 'profile', 'realtime'],
  defaultNS: 'common',
  interpolation: {
    // [ADDED] React already escapes output
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
