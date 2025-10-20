/**
 * Country to Currency Mapping
 * 
 * Maps ISO 3166-1 alpha-2 country codes to ISO 4217 currency codes
 * Used for automatic currency detection based on user's registration country
 * 
 * Covers ~60 major countries across all regions
 * Falls back to USD for unmapped countries
 */

export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Africa
  'ZA': 'ZAR', // South Africa - Rand
  'NG': 'NGN', // Nigeria - Naira
  'EG': 'EGP', // Egypt - Pound
  'KE': 'KES', // Kenya - Shilling
  'GH': 'GHS', // Ghana - Cedi
  'TZ': 'TZS', // Tanzania - Shilling
  'UG': 'UGX', // Uganda - Shilling
  'MA': 'MAD', // Morocco - Dirham
  'ET': 'ETB', // Ethiopia - Birr
  'DZ': 'DZD', // Algeria - Dinar
  
  // Americas
  'US': 'USD', // United States - Dollar
  'CA': 'CAD', // Canada - Dollar
  'BR': 'BRL', // Brazil - Real
  'MX': 'MXN', // Mexico - Peso
  'AR': 'ARS', // Argentina - Peso
  'CL': 'CLP', // Chile - Peso
  'CO': 'COP', // Colombia - Peso
  'PE': 'PEN', // Peru - Sol
  
  // Europe
  'GB': 'GBP', // United Kingdom - Pound
  'EU': 'EUR', // European Union
  'DE': 'EUR', // Germany - Euro
  'FR': 'EUR', // France - Euro
  'IT': 'EUR', // Italy - Euro
  'ES': 'EUR', // Spain - Euro
  'NL': 'EUR', // Netherlands - Euro
  'BE': 'EUR', // Belgium - Euro
  'AT': 'EUR', // Austria - Euro
  'PT': 'EUR', // Portugal - Euro
  'IE': 'EUR', // Ireland - Euro
  'GR': 'EUR', // Greece - Euro
  'PL': 'PLN', // Poland - Zloty
  'RO': 'RON', // Romania - Leu
  'CZ': 'CZK', // Czech Republic - Koruna
  'HU': 'HUF', // Hungary - Forint
  'SE': 'SEK', // Sweden - Krona
  'DK': 'DKK', // Denmark - Krone
  'NO': 'NOK', // Norway - Krone
  'CH': 'CHF', // Switzerland - Franc
  'TR': 'TRY', // Turkey - Lira
  'RU': 'RUB', // Russia - Ruble
  'UA': 'UAH', // Ukraine - Hryvnia
  
  // Asia
  'CN': 'CNY', // China - Yuan
  'IN': 'INR', // India - Rupee
  'JP': 'JPY', // Japan - Yen
  'KR': 'KRW', // South Korea - Won
  'ID': 'IDR', // Indonesia - Rupiah
  'TH': 'THB', // Thailand - Baht
  'MY': 'MYR', // Malaysia - Ringgit
  'SG': 'SGD', // Singapore - Dollar
  'PH': 'PHP', // Philippines - Peso
  'VN': 'VND', // Vietnam - Dong
  'BD': 'BDT', // Bangladesh - Taka
  'PK': 'PKR', // Pakistan - Rupee
  'LK': 'LKR', // Sri Lanka - Rupee
  'MM': 'MMK', // Myanmar - Kyat
  'KH': 'KHR', // Cambodia - Riel
  
  // Middle East
  'SA': 'SAR', // Saudi Arabia - Riyal
  'AE': 'AED', // UAE - Dirham
  'IL': 'ILS', // Israel - Shekel
  'QA': 'QAR', // Qatar - Riyal
  'KW': 'KWD', // Kuwait - Dinar
  'OM': 'OMR', // Oman - Rial
  'BH': 'BHD', // Bahrain - Dinar
  'JO': 'JOD', // Jordan - Dinar
  'LB': 'LBP', // Lebanon - Pound
  
  // Oceania
  'AU': 'AUD', // Australia - Dollar
  'NZ': 'NZD', // New Zealand - Dollar
};

/**
 * Get the primary currency for a given country code
 * 
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'KE', 'US')
 * @returns ISO 4217 currency code (e.g., 'KES', 'USD')
 * @default 'USD' - Returns USD for unmapped countries
 */
export function getCurrencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) {
    return 'USD';
  }
  
  const upperCode = countryCode.trim().toUpperCase();
  return COUNTRY_CURRENCY_MAP[upperCode] || 'USD';
}

/**
 * Check if a country has a currency mapping
 * 
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns true if country is in the mapping, false otherwise
 */
export function hasCountryCurrencyMapping(countryCode: string | null | undefined): boolean {
  if (!countryCode) {
    return false;
  }
  
  const upperCode = countryCode.trim().toUpperCase();
  return upperCode in COUNTRY_CURRENCY_MAP;
}

/**
 * Get a list of all supported currencies
 * 
 * @returns Array of unique currency codes
 */
export function getSupportedCurrencies(): string[] {
  return Array.from(new Set(Object.values(COUNTRY_CURRENCY_MAP))).sort();
}

/**
 * Get countries that use a specific currency
 * 
 * @param currencyCode - ISO 4217 currency code (e.g., 'EUR', 'USD')
 * @returns Array of country codes using that currency
 */
export function getCountriesForCurrency(currencyCode: string): string[] {
  return Object.entries(COUNTRY_CURRENCY_MAP)
    .filter(([_, currency]) => currency === currencyCode)
    .map(([country, _]) => country);
}
