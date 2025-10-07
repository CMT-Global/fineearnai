export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    task_earning: 'Task Earning',
    referral_commission: 'Referral Commission',
    plan_upgrade: 'Plan Upgrade',
    transfer: 'Transfer',
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
