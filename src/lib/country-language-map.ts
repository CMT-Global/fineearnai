/**
 * Country to Language Mapping
 * 
 * Maps country codes (ISO 3166-1 alpha-2) to language codes (ISO 639-1)
 * Used for automatic language detection based on user's IP geolocation
 */

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'it'];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
};

/**
 * Maps country codes to language codes
 * 
 * English: US, GB, AU, CA, NZ, IE, and other English-speaking countries
 * Spanish: ES, MX, AR, CO, CL, PE, VE, EC, GT, CU, BO, DO, HN, PY, SV, NI, CR, PA, UY
 * French: FR, BE (French regions), CH (French regions), CA (Quebec), LU
 * German: DE, AT, CH (German regions), LI, LU
 * Italian: IT, CH (Italian regions), SM, VA
 * 
 * Default fallback: English (en)
 */
const COUNTRY_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  // English-speaking countries
  US: 'en', // United States
  GB: 'en', // United Kingdom
  AU: 'en', // Australia
  CA: 'en', // Canada (English regions)
  NZ: 'en', // New Zealand
  IE: 'en', // Ireland
  ZA: 'en', // South Africa
  SG: 'en', // Singapore
  MY: 'en', // Malaysia
  PH: 'en', // Philippines
  IN: 'en', // India
  PK: 'en', // Pakistan
  BD: 'en', // Bangladesh
  LK: 'en', // Sri Lanka
  NG: 'en', // Nigeria
  KE: 'en', // Kenya
  GH: 'en', // Ghana
  TZ: 'en', // Tanzania
  UG: 'en', // Uganda
  ZW: 'en', // Zimbabwe
  JM: 'en', // Jamaica
  TT: 'en', // Trinidad and Tobago
  BB: 'en', // Barbados
  BS: 'en', // Bahamas
  BZ: 'en', // Belize
  GY: 'en', // Guyana
  
  // Spanish-speaking countries
  ES: 'es', // Spain
  MX: 'es', // Mexico
  AR: 'es', // Argentina
  CO: 'es', // Colombia
  CL: 'es', // Chile
  PE: 'es', // Peru
  VE: 'es', // Venezuela
  EC: 'es', // Ecuador
  GT: 'es', // Guatemala
  CU: 'es', // Cuba
  BO: 'es', // Bolivia
  DO: 'es', // Dominican Republic
  HN: 'es', // Honduras
  PY: 'es', // Paraguay
  SV: 'es', // El Salvador
  NI: 'es', // Nicaragua
  CR: 'es', // Costa Rica
  PA: 'es', // Panama
  UY: 'es', // Uruguay
  PR: 'es', // Puerto Rico
  
  // French-speaking countries/regions
  FR: 'fr', // France
  BE: 'fr', // Belgium (French regions)
  CH: 'fr', // Switzerland (French regions - Romandy)
  LU: 'fr', // Luxembourg
  MC: 'fr', // Monaco
  AD: 'fr', // Andorra
  // French-speaking African countries
  CD: 'fr', // Democratic Republic of Congo
  CG: 'fr', // Republic of Congo
  CI: 'fr', // Ivory Coast
  SN: 'fr', // Senegal
  CM: 'fr', // Cameroon
  MG: 'fr', // Madagascar
  ML: 'fr', // Mali
  BF: 'fr', // Burkina Faso
  NE: 'fr', // Niger
  TD: 'fr', // Chad
  GA: 'fr', // Gabon
  GN: 'fr', // Guinea
  BJ: 'fr', // Benin
  TG: 'fr', // Togo
  CF: 'fr', // Central African Republic
  RW: 'fr', // Rwanda
  BI: 'fr', // Burundi
  DJ: 'fr', // Djibouti
  KM: 'fr', // Comoros
  HT: 'fr', // Haiti
  
  // German-speaking countries/regions
  DE: 'de', // Germany
  AT: 'de', // Austria
  LI: 'de', // Liechtenstein
  // Note: CH (Switzerland) has multiple languages, but we'll default to German for German regions
  
  // Italian-speaking countries/regions
  IT: 'it', // Italy
  SM: 'it', // San Marino
  VA: 'it', // Vatican City
  // Note: CH (Switzerland) has Italian regions (Ticino)
};

/**
 * Maps a country code to a language code
 * 
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "US", "ES", "FR")
 * @returns Language code (ISO 639-1) or "en" as default fallback
 */
export function getLanguageFromCountry(countryCode: string | null | undefined): SupportedLanguage {
  if (!countryCode) {
    return 'en'; // Default fallback
  }
  
  const upperCountryCode = countryCode.toUpperCase();
  return COUNTRY_LANGUAGE_MAP[upperCountryCode] || 'en';
}

/**
 * Checks if a language code is supported
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * Gets the display name for a language code
 */
export function getLanguageName(lang: SupportedLanguage): string {
  return LANGUAGE_NAMES[lang] || 'English';
}

/**
 * Gets the flag emoji for a language code
 */
export function getLanguageFlag(lang: SupportedLanguage): string {
  return LANGUAGE_FLAGS[lang] || '🇬🇧';
}
