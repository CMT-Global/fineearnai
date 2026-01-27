import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getOptimalDecimals } from '@/lib/wallet-utils';

/**
 * Currency Display Component
 * 
 * Universal component for displaying converted monetary amounts
 * Features:
 * - Automatic conversion from USD to user's preferred currency
 * - Loading skeleton during initialization
 * - Tooltip showing original USD amount
 * - Proper localized formatting
 * - Graceful error handling
 */

interface CurrencyDisplayProps {
  /** Amount in USD (required) */
  amountUSD: number;
  /** Show currency symbol (default: true) */
  showSymbol?: boolean;
  /** Show thousand separators (default: true) */
  showSeparator?: boolean;
  /** Show loading skeleton during initialization (default: true) */
  showLoadingState?: boolean;
  /** Custom class name */
  className?: string;
  /** Number of decimal places (default: auto-detect based on value) */
  decimals?: number;
  /** Show tooltip with original USD amount (default: true) */
  showTooltip?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amountUSD,
  showSymbol = true,
  showSeparator = true,
  showLoadingState = true,
  className,
  decimals, // Optional - will auto-detect if not provided
  showTooltip = true,
}) => {
  const { t } = useTranslation();
  const { convertAmount, userCurrency, isLoading, error } = useCurrencyConversion();

  // Show loading skeleton during initialization
  if (isLoading && showLoadingState) {
    return <Skeleton className={cn("h-5 w-20 inline-block", className)} />;
  }

  // Convert amount
  const { amount: convertedAmount, currency } = convertAmount(amountUSD);
  
  // Auto-determine optimal decimals if not explicitly provided
  const optimalDecimals = decimals ?? getOptimalDecimals(convertedAmount);

  // Format the converted amount
  const formatCurrency = (value: number, currencyCode: string, decimalPlaces?: number): string => {
    const effectiveDecimals = decimalPlaces ?? optimalDecimals;
    
    try {
      const options: Intl.NumberFormatOptions = {
        style: showSymbol ? 'currency' : 'decimal',
        minimumFractionDigits: effectiveDecimals,
        maximumFractionDigits: effectiveDecimals,
        useGrouping: showSeparator,
      };
      
      // Only add currency property if showing symbol
      if (showSymbol) {
        options.currency = currencyCode;
      }
      
      return new Intl.NumberFormat(undefined, options).format(value);
    } catch (formatError) {
      // Fallback formatting if currency is not supported
      console.error(`Error formatting currency ${currencyCode}:`, formatError);
      const formattedValue = value.toFixed(effectiveDecimals);
      return showSymbol ? `${currencyCode} ${formattedValue}` : formattedValue;
    }
  };

  const formattedAmount = formatCurrency(convertedAmount, currency);

  // Format original USD amount for tooltip (also with smart decimals)
  const usdDecimals = decimals ?? getOptimalDecimals(amountUSD);
  const formattedUSD = formatCurrency(amountUSD, 'USD', usdDecimals);

  // If there's an error and currency is not USD, show fallback
  if (error && currency !== 'USD') {
    const fallbackAmount = formatCurrency(amountUSD, 'USD');
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("text-muted-foreground", className)}>
              {fallbackAmount}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t("currency.conversionUnavailable")}</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Don't show tooltip if currency is USD or tooltip is disabled
  if (!showTooltip || currency === 'USD') {
    return <span className={className}>{formattedAmount}</span>;
  }

  // Show with tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{formattedAmount}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{t("currency.originalAmount", { amount: formattedUSD })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
