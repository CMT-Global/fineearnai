/**
 * Plan utilities. Plan data must come from the database (membership_plans);
 * do not hardcode plan names, benefits, or tiers by string here.
 */

/** Plan-like shape for helpers (from membership_plans row or profile + plan lookup) */
export interface PlanLike {
  name?: string;
  account_type?: string;
  price?: number;
}

/**
 * Returns true if the plan is the default/free tier (source of truth: account_type from DB).
 * Use this instead of comparing plan name to 'Trainee' or 'free'.
 */
export const isFreeTierPlan = (plan: PlanLike | null | undefined): boolean => {
  if (plan == null) return false;
  return String(plan.account_type || '').toLowerCase().trim() === 'free';
};

/**
 * Returns the default (free tier) plan from a list of plans from the DB.
 * Plans are typically ordered by price ascending; free tier has account_type === 'free'.
 */
export const getDefaultPlan = <T extends PlanLike>(plans: T[] | null | undefined): T | undefined => {
  if (!plans?.length) return undefined;
  return plans.find((p) => isFreeTierPlan(p));
};

/**
 * Returns the highest-tier (by price) plan from a list. Useful for "top plan" comparisons.
 */
export const getHighestTierPlan = <T extends { price?: number }>(plans: T[] | null | undefined): T | undefined => {
  if (!plans?.length) return undefined;
  return [...plans].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
};

export const formatBillingPeriod = (days: number): string => {
  if (days === 1) return "day";
  if (days === 7) return "week";
  if (days === 30) return "month";
  if (days === 365) return "year";
  return `${days} days`;
};

/**
 * Returns the plan's features from the database (membership_plans.features).
 * Pass the plan object from your API/query (e.g. from useMembershipPlans).
 * Do not pass a plan name string; plan data must come from DB.
 */
export const getPlanBenefits = (plan: { features?: unknown } | null | undefined): string[] => {
  if (plan == null) return [];
  if (typeof plan === 'string') {
    if (import.meta.env?.DEV) {
      console.warn('[plan-utils] getPlanBenefits(planName) is deprecated. Pass the plan object from DB (e.g. membership_plans row) instead.');
    }
    return [];
  }
  const f = plan.features;
  if (f == null) return [];
  if (Array.isArray(f)) {
    return f.filter((item): item is string => typeof item === 'string');
  }
  if (typeof f === 'object' && !Array.isArray(f)) {
    return Object.values(f).filter((item): item is string => typeof item === 'string');
  }
  return [];
};

/**
 * Compare two plans by tier. Prefer plans from DB (ordered by price asc): tier = index.
 * Fallback: use account_type order (free=0, personal=1, business=2, group=3) when plans array is not provided.
 */
export const comparePlans = (
  currentPlan: string,
  targetPlan: string,
  plansOrderedByPrice?: Array<{ name: string; account_type?: string; price?: number }> | null
): {
  isUpgrade: boolean;
  isDowngrade: boolean;
  tierDifference: number;
} => {
  if (plansOrderedByPrice?.length) {
    const currentIdx = plansOrderedByPrice.findIndex((p) => p.name === currentPlan);
    const targetIdx = plansOrderedByPrice.findIndex((p) => p.name === targetPlan);
    const currentTier = currentIdx >= 0 ? currentIdx : 0;
    const targetTier = targetIdx >= 0 ? targetIdx : 0;
    const difference = targetTier - currentTier;
    return {
      isUpgrade: difference > 0,
      isDowngrade: difference < 0,
      tierDifference: Math.abs(difference),
    };
  }
  // Fallback when no DB plans: use account_type or common plan name -> tier (avoid hardcoding; prefer passing plans)
  const accountTypeTiers: Record<string, number> = {
    free: 0,
    personal: 1,
    business: 2,
    group: 3,
  };
  const nameLower = (s: string) => (s ?? '').toLowerCase().trim();
  const getTier = (name: string) => accountTypeTiers[nameLower(name)] ?? 0;
  const currentTier = getTier(currentPlan);
  const targetTier = getTier(targetPlan);
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
