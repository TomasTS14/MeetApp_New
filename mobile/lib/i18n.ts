import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import es from '@/locales/es.json';

export const supportedLanguages = ['en', 'es'] as const;
export type Language = (typeof supportedLanguages)[number];

// English is the primary language; Spanish is used when the device is set to Spanish.
// The language chosen in Settings overrides this once signed in (lib/settings.tsx).
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'es' ? 'es' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
