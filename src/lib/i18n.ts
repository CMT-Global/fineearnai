/**
 * i18next Configuration
 * 
 * Sets up internationalization for the application
 * Supports: English, Spanish, French, German, Italian
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../locales/en/translation.json';
import esTranslations from '../locales/es/translation.json';
import frTranslations from '../locales/fr/translation.json';
import deTranslations from '../locales/de/translation.json';
import itTranslations from '../locales/it/translation.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  es: {
    translation: esTranslations,
  },
  fr: {
    translation: frTranslations,
  },
  de: {
    translation: deTranslations,
  },
  it: {
    translation: itTranslations,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'it'],
    
    // Detection options
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator'],
      
      // Keys to look language up in
      lookupLocalStorage: 'i18nextLng',
      
      // Cache user language
      caches: ['localStorage'],
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // React options
    react: {
      useSuspense: false, // Avoid suspense for better UX
    },
    
    // Debug mode (only in development)
    debug: !import.meta.env.PROD,
  });

export default i18n;
