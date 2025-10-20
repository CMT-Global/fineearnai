import { useCurrency } from '@/contexts/CurrencyContext';

/**
 * Currency Conversion Hook
 * 
 * Provides easy access to currency conversion utilities
 * Usage:
 * ```tsx
 * const { convertAmount, userCurrency, exchangeRate } = useCurrencyConversion();
 * const converted = convertAmount(100); // Converts 100 USD to user's currency
 * ```
 */

interface ConvertedAmount {
  amount: number;
  currency: string;
}

export const useCurrencyConversion = () => {
  const {
    userCurrency,
    exchangeRate,
    isLoading,
    error,
    lastUpdated,
    refreshRate,
    updateUserCurrency,
  } = useCurrency();

  /**
   * Convert USD amount to user's preferred currency
   * @param amountUSD - Amount in USD to convert
   * @returns Converted amount and currency code
   */
  const convertAmount = (amountUSD: number): ConvertedAmount => {
    if (!amountUSD || isNaN(amountUSD)) {
      return { amount: 0, currency: userCurrency };
    }

    const convertedAmount = amountUSD * exchangeRate;
    
    return {
      amount: convertedAmount,
      currency: userCurrency,
    };
  };

  /**
   * Format amount as currency string
   * @param amountUSD - Amount in USD to convert and format
   * @param options - Intl.NumberFormat options
   * @returns Formatted currency string
   */
  const formatAmount = (
    amountUSD: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    const { amount, currency } = convertAmount(amountUSD);

    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options,
      }).format(amount);
    } catch (error) {
      // Fallback if currency is not supported
      console.error(`Error formatting currency ${currency}:`, error);
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  return {
    // Conversion utilities
    convertAmount,
    formatAmount,
    
    // Currency state
    userCurrency,
    exchangeRate,
    isLoading,
    error,
    lastUpdated,
    
    // Actions
    refreshRate,
    updateUserCurrency,
  };
};
