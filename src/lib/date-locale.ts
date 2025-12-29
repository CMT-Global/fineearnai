/**
 * Date-fns Locale Utility
 * 
 * Maps user language preferences to date-fns locales for proper date formatting
 */

import { SupportedLanguage } from './country-language-map';
import { enUS, es, fr, de, it } from 'date-fns/locale';
import { Locale } from 'date-fns';

/**
 * Maps supported languages to date-fns locales
 */
const LOCALE_MAP: Record<SupportedLanguage, Locale> = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  it: it,
};

/**
 * Gets the date-fns locale for a given language code
 * 
 * @param language - User's preferred language code
 * @returns date-fns Locale object
 */
export function getDateLocale(language: SupportedLanguage = 'en'): Locale {
  return LOCALE_MAP[language] || enUS;
}

/**
 * Gets the date-fns locale from the current i18n language
 * This is a convenience function that can be used with useTranslation hook
 * 
 * @param i18nLanguage - Language from i18n instance (e.g., from useTranslation().i18n.language)
 * @returns date-fns Locale object
 */
export function getDateLocaleFromI18n(i18nLanguage: string): Locale {
  const lang = i18nLanguage.split('-')[0] as SupportedLanguage; // Handle 'en-US' -> 'en'
  return getDateLocale(lang);
}

