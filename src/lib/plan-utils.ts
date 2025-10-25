export const formatBillingPeriod = (days: number): string => {
  if (days === 1) return "day";
  if (days === 7) return "week";
  if (days === 30) return "month";
  if (days === 365) return "year";
  return `${days} days`;
};

export const getPlanBenefits = (planName: string): string[] => {
  const benefits: Record<string, string[]> = {
    free: [
      "Basic task access",
      "Limited daily tasks",
      "Community support",
    ],
    personal: [
      "Increased task limits",
      "Higher earnings per task",
      "Task skip allowance",
      "Referral commissions",
      "Priority support",
    ],
    business: [
      "Maximum task limits",
      "Premium earnings rate",
      "Unlimited task skips",
      "Higher referral rates",
      "Premium support",
      "Advanced analytics",
    ],
    group: [
      "Enterprise task limits",
      "Top-tier earnings",
      "Unlimited everything",
      "Maximum commission rates",
      "Dedicated account manager",
      "Custom features",
      "API access",
    ],
  };

  return benefits[planName] || [];
};

export const comparePlans = (currentPlan: string, targetPlan: string): {
  isUpgrade: boolean;
  isDowngrade: boolean;
  tierDifference: number;
} => {
  const planTiers: Record<string, number> = {
    free: 0,
    personal: 1,
    business: 2,
    group: 3,
  };

  const currentTier = planTiers[currentPlan] || 0;
  const targetTier = planTiers[targetPlan] || 0;
  const difference = targetTier - currentTier;

  return {
    isUpgrade: difference > 0,
    isDowngrade: difference < 0,
    tierDifference: Math.abs(difference),
  };
};

export interface EarningPotential {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  sixMonthly: number;
  annually: number;
}

export const calculateEarningPotential = (plan: {
  daily_task_limit: number;
  earning_per_task: number;
}): EarningPotential => {
  const daily = plan.daily_task_limit * plan.earning_per_task;
  return {
    daily,
    weekly: daily * 7,
    monthly: daily * 30,
    quarterly: daily * 90,
    sixMonthly: daily * 180,
    annually: daily * 365,
  };
};

export interface ProrationDetails {
  credit: number;
  newCost: number;
  savings: number;
  daysRemaining: number;
  dailyRate: number;
  originalPrice: number;
}

export const calculateProration = (
  currentPlan: {
    price: number;
    billing_period_days: number;
  },
  currentPlanStartDate: string | Date,
  newPlan: {
    price: number;
  }
): ProrationDetails => {
  const startDate = new Date(currentPlanStartDate);
  const now = new Date();
  
  // Calculate days used and remaining
  const daysUsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, currentPlan.billing_period_days - daysUsed);
  
  // Calculate daily rate and credit
  const dailyRate = currentPlan.price / currentPlan.billing_period_days;
  const credit = dailyRate * daysRemaining;
  
  // Calculate new cost after credit
  const newCost = Math.max(0, newPlan.price - credit);
  const savings = credit;
  
  return {
    credit,
    newCost,
    savings,
    daysRemaining,
    dailyRate,
    originalPrice: newPlan.price,
  };
};

export const formatBillingPeriodFromValue = (value: number, unit: string): string => {
  if (value === 1) {
    return unit === "day" ? "daily" : unit === "week" ? "weekly" : unit === "month" ? "monthly" : unit === "year" ? "yearly" : `1 ${unit}`;
  }
  return `${value} ${unit}${value > 1 ? "s" : ""}`;
};

export const isPlanExpiringSoon = (expiresAt: string | Date | null, daysThreshold: number = 7): boolean => {
  if (!expiresAt) return false;
  
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 && diffDays <= daysThreshold;
};

export const isPlanExpired = (expiresAt: string | Date | null): boolean => {
  if (!expiresAt) return false;
  
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  
  return now > expiryDate;
};

export const getDaysUntilExpiry = (expiresAt: string | Date | null): number | null => {
  if (!expiresAt) return null;
  
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};
