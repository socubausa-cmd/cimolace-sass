import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';

export const LANG_STORAGE_KEY = 'med_app_lang';

const stored =
  typeof window !== 'undefined'
    ? window.localStorage.getItem(LANG_STORAGE_KEY)
    : null;

const initialLng = stored === 'en' || stored === 'fr' ? stored : 'fr';

void i18n.use(initReactI18next).init({
  resources: {
    fr: { common: fr.common, twin: fr.twin },
    en: { common: en.common, twin: en.twin },
  },
  lng: initialLng,
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['common', 'twin'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(lng: 'fr' | 'en') {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* noop */
  }
  return i18n.changeLanguage(lng);
}

export default i18n;
