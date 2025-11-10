/**
 * Display Strategy (2-Decimal Display, 4-Decimal Storage):
 * 
 * DISPLAY (Frontend):
 * - Always show 2 decimals for clean, professional look
 * - Users see: "KES 13,852.63" instead of "KES 13,852.6290"
 * 
 * STORAGE (Database):
 * - Always store 4 decimals for precision
 * - Commissions like 5% of $0.2583 = $0.0129 are accurate
 * - Rounding only happens at display time, never in calculations
 * 
 * WHY?
 * - User Experience: Clean numbers build trust
 * - Accuracy: Math operations use full precision
 * - Scalability: No rounding errors accumulate over millions of transactions
 */
export const getOptimalDecimals = (amount: number): number => {
  // Force 2 decimals for all user-facing displays
  return 2;
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
    voucher_purchase: 'Voucher Code Purchase',
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
  if (['voucher_purchase', 'withdrawal', 'plan_upgrade', 'transfer'].includes(type)) {
    return 'text-red-600';
  }
  return 'text-red-600';
};
