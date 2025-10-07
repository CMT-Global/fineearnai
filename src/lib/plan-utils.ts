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
