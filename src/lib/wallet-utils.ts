/**
 * Determine optimal decimal places for display (2 or 4)
 * Returns 4 if there are significant digits in the 3rd or 4th decimal place
 * Returns 2 otherwise for cleaner display
 */
export const getOptimalDecimals = (amount: number): number => {
  if (amount === 0) return 2; // Always show 2 decimals for zero
  
  const fixed4 = amount.toFixed(4);
  const lastTwoDigits = fixed4.slice(-2);
  
  // If last two digits are "00", we only need 2 decimals
  return lastTwoDigits === '00' ? 2 : 4;
};

/**
 * Format currency amount in USD (legacy function for backward compatibility)
 * For new code, use CurrencyDisplay component instead
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format currency amount with conversion
 * @param amountUSD - Amount in USD to convert
 * @param currency - Target currency code (ISO 4217)
 * @param exchangeRate - Exchange rate from USD to target currency
 * @returns Formatted currency string
 */
export const formatCurrencyConverted = (
  amountUSD: number,
  currency: string,
  exchangeRate: number
): string => {
  const convertedAmount = amountUSD * exchangeRate;
  
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
  } catch (error) {
    // Fallback if currency is not supported
    console.error(`Error formatting currency ${currency}:`, error);
    return `${currency} ${convertedAmount.toFixed(2)}`;
  }
};

export const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    task_earning: 'Task Earning',
    referral_commission: 'Referral Commission',
    plan_upgrade: 'Plan Upgrade',
    transfer: 'Admin Deduction',
    adjustment: 'Balance Adjustment',
  };
  return labels[type] || type;
};

export const getTransactionStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    completed: 'text-green-600',
    pending: 'text-yellow-600',
    failed: 'text-red-600',
    cancelled: 'text-gray-600',
  };
  return colors[status] || 'text-gray-600';
};

export const getTransactionTypeColor = (type: string): string => {
  if (['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(type)) {
    return 'text-green-600';
  }
  return 'text-red-600';
};
