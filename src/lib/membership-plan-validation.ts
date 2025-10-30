/**
 * Comprehensive validation rules for membership plans
 * Single source of truth for all plan validation logic
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface MembershipPlanData {
  name?: string;
  display_name?: string;
  account_type?: string;
  price?: number;
  daily_task_limit?: number;
  task_skip_limit_per_day?: number;
  earning_per_task?: number;
  task_commission_rate?: number;
  deposit_commission_rate?: number;
  max_active_referrals?: number;
  min_withdrawal?: number;
  min_daily_withdrawal?: number;
  max_daily_withdrawal?: number;
  billing_period_days?: number;
  free_plan_expiry_days?: number | null;
}

/**
 * Account type options for dropdown selection
 */
export const ACCOUNT_TYPES = [
  { value: 'free', label: 'Free Account' },
  { value: 'personal', label: 'Personal Account' },
  { value: 'business', label: 'Business Account' },
  { value: 'group', label: 'Group Account' }
] as const;

/**
 * Field constraints for all numeric inputs
 * Ensures consistent validation across the application
 */
export const FIELD_CONSTRAINTS = {
  price: { 
    min: 0, 
    max: 10000, 
    step: 0.01,
    label: 'Price',
    help: 'Plan subscription price in USD'
  },
  daily_task_limit: { 
    min: 0, 
    max: 1000, 
    step: 1,
    label: 'Daily Task Limit',
    help: 'Maximum tasks users can complete per day'
  },
  task_skip_limit_per_day: { 
    min: 0, 
    max: 100, 
    step: 1,
    label: 'Daily Skip Limit',
    help: 'Maximum tasks users can skip per day'
  },
  earning_per_task: { 
    min: 0, 
    max: 100, 
    step: 0.01,
    label: 'Earning Per Task',
    help: 'Amount earned per completed task in USD'
  },
  task_commission_rate: { 
    min: 0, 
    max: 100, 
    step: 0.01,
    label: 'Task Commission Rate (%)',
    help: 'Percentage of referral task earnings paid as commission (0-100)'
  },
  deposit_commission_rate: { 
    min: 0, 
    max: 100, 
    step: 0.01,
    label: 'Deposit Commission Rate (%)',
    help: 'Percentage of referral deposits paid as commission (0-100)'
  },
  max_active_referrals: { 
    min: 0, 
    max: 999999, 
    step: 1,
    label: 'Max Active Referrals',
    help: 'Maximum number of active referrals allowed'
  },
  min_withdrawal: { 
    min: 0, 
    max: 10000, 
    step: 0.01,
    label: 'Minimum Withdrawal',
    help: 'Minimum amount users can withdraw in USD'
  },
  min_daily_withdrawal: { 
    min: 0, 
    max: 10000, 
    step: 0.01,
    label: 'Min Daily Withdrawal',
    help: 'Minimum daily withdrawal amount in USD'
  },
  max_daily_withdrawal: { 
    min: 0, 
    max: 100000, 
    step: 0.01,
    label: 'Max Daily Withdrawal',
    help: 'Maximum daily withdrawal amount in USD'
  },
  billing_period_days: { 
    min: 1, 
    max: 365, 
    step: 1,
    label: 'Billing Period (days)',
    help: 'Number of days in billing cycle'
  },
  free_plan_expiry_days: { 
    min: 0, 
    max: 365, 
    step: 1,
    label: 'Free Plan Expiry Days',
    help: 'Number of days before free plan expires (leave empty for lifetime access)'
  }
} as const;

/**
 * Comprehensive validation function for membership plans
 * Returns detailed error messages for any validation failures
 */
export function validateMembershipPlan(planData: MembershipPlanData): ValidationResult {
  const errors: string[] = [];

  // ========== Required Fields ==========
  if (!planData.name || planData.name.trim().length === 0) {
    errors.push("Plan name is required");
  }

  if (!planData.display_name || planData.display_name.trim().length === 0) {
    errors.push("Display name is required");
  }

  if (!planData.account_type || planData.account_type.trim().length === 0) {
    errors.push("Account type is required");
  }

  // ========== Account Type Validation ==========
  const validAccountTypes = ACCOUNT_TYPES.map(t => t.value);
  if (planData.account_type && !validAccountTypes.includes(planData.account_type as any)) {
    errors.push(`Account type must be one of: ${validAccountTypes.join(', ')}`);
  }

  // ========== Price Validation ==========
  if (planData.price !== undefined) {
    if (planData.price < FIELD_CONSTRAINTS.price.min) {
      errors.push(`Price cannot be less than ${FIELD_CONSTRAINTS.price.min}`);
    }
    if (planData.price > FIELD_CONSTRAINTS.price.max) {
      errors.push(`Price cannot exceed ${FIELD_CONSTRAINTS.price.max}`);
    }
  }

  // ========== Task Limits Validation ==========
  if (planData.daily_task_limit !== undefined) {
    if (planData.daily_task_limit < FIELD_CONSTRAINTS.daily_task_limit.min || 
        planData.daily_task_limit > FIELD_CONSTRAINTS.daily_task_limit.max) {
      errors.push(`Daily task limit must be between ${FIELD_CONSTRAINTS.daily_task_limit.min} and ${FIELD_CONSTRAINTS.daily_task_limit.max}`);
    }
  }

  if (planData.task_skip_limit_per_day !== undefined) {
    if (planData.task_skip_limit_per_day < FIELD_CONSTRAINTS.task_skip_limit_per_day.min || 
        planData.task_skip_limit_per_day > FIELD_CONSTRAINTS.task_skip_limit_per_day.max) {
      errors.push(`Task skip limit must be between ${FIELD_CONSTRAINTS.task_skip_limit_per_day.min} and ${FIELD_CONSTRAINTS.task_skip_limit_per_day.max}`);
    }
  }

  // ========== Earning Validation ==========
  if (planData.earning_per_task !== undefined) {
    if (planData.earning_per_task < FIELD_CONSTRAINTS.earning_per_task.min) {
      errors.push(`Earning per task cannot be negative`);
    }
    if (planData.earning_per_task > FIELD_CONSTRAINTS.earning_per_task.max) {
      errors.push(`Earning per task cannot exceed ${FIELD_CONSTRAINTS.earning_per_task.max}`);
    }
  }

  // ========== Commission Rates Validation (0-100%) ==========
  if (planData.task_commission_rate !== undefined) {
    if (planData.task_commission_rate < FIELD_CONSTRAINTS.task_commission_rate.min || 
        planData.task_commission_rate > FIELD_CONSTRAINTS.task_commission_rate.max) {
      errors.push(`Task commission rate must be between ${FIELD_CONSTRAINTS.task_commission_rate.min} and ${FIELD_CONSTRAINTS.task_commission_rate.max}%`);
    }
  }

  if (planData.deposit_commission_rate !== undefined) {
    if (planData.deposit_commission_rate < FIELD_CONSTRAINTS.deposit_commission_rate.min || 
        planData.deposit_commission_rate > FIELD_CONSTRAINTS.deposit_commission_rate.max) {
      errors.push(`Deposit commission rate must be between ${FIELD_CONSTRAINTS.deposit_commission_rate.min} and ${FIELD_CONSTRAINTS.deposit_commission_rate.max}%`);
    }
  }

  // ========== Withdrawal Logic Validation ==========
  if (planData.min_withdrawal !== undefined && planData.max_daily_withdrawal !== undefined) {
    if (planData.min_withdrawal > planData.max_daily_withdrawal) {
      errors.push("Minimum withdrawal cannot exceed maximum daily withdrawal");
    }
  }

  if (planData.min_daily_withdrawal !== undefined && planData.max_daily_withdrawal !== undefined) {
    if (planData.min_daily_withdrawal > planData.max_daily_withdrawal) {
      errors.push("Minimum daily withdrawal cannot exceed maximum daily withdrawal");
    }
  }

  if (planData.min_withdrawal !== undefined) {
    if (planData.min_withdrawal < FIELD_CONSTRAINTS.min_withdrawal.min || 
        planData.min_withdrawal > FIELD_CONSTRAINTS.min_withdrawal.max) {
      errors.push(`Minimum withdrawal must be between ${FIELD_CONSTRAINTS.min_withdrawal.min} and ${FIELD_CONSTRAINTS.min_withdrawal.max}`);
    }
  }

  if (planData.min_daily_withdrawal !== undefined) {
    if (planData.min_daily_withdrawal < FIELD_CONSTRAINTS.min_daily_withdrawal.min || 
        planData.min_daily_withdrawal > FIELD_CONSTRAINTS.min_daily_withdrawal.max) {
      errors.push(`Min daily withdrawal must be between ${FIELD_CONSTRAINTS.min_daily_withdrawal.min} and ${FIELD_CONSTRAINTS.min_daily_withdrawal.max}`);
    }
  }

  if (planData.max_daily_withdrawal !== undefined) {
    if (planData.max_daily_withdrawal < FIELD_CONSTRAINTS.max_daily_withdrawal.min || 
        planData.max_daily_withdrawal > FIELD_CONSTRAINTS.max_daily_withdrawal.max) {
      errors.push(`Max daily withdrawal must be between ${FIELD_CONSTRAINTS.max_daily_withdrawal.min} and ${FIELD_CONSTRAINTS.max_daily_withdrawal.max}`);
    }
  }

  // ========== Referrals Validation ==========
  if (planData.max_active_referrals !== undefined) {
    if (planData.max_active_referrals < FIELD_CONSTRAINTS.max_active_referrals.min || 
        planData.max_active_referrals > FIELD_CONSTRAINTS.max_active_referrals.max) {
      errors.push(`Max active referrals must be between ${FIELD_CONSTRAINTS.max_active_referrals.min} and ${FIELD_CONSTRAINTS.max_active_referrals.max}`);
    }
  }

  // ========== Billing Period Validation ==========
  if (planData.billing_period_days !== undefined) {
    if (planData.billing_period_days < FIELD_CONSTRAINTS.billing_period_days.min || 
        planData.billing_period_days > FIELD_CONSTRAINTS.billing_period_days.max) {
      errors.push(`Billing period must be between ${FIELD_CONSTRAINTS.billing_period_days.min} and ${FIELD_CONSTRAINTS.billing_period_days.max} days`);
    }
  }

  // ========== Free Plan Expiry Validation ==========
  if (planData.free_plan_expiry_days !== undefined && planData.free_plan_expiry_days !== null) {
    if (planData.free_plan_expiry_days < FIELD_CONSTRAINTS.free_plan_expiry_days.min || 
        planData.free_plan_expiry_days > FIELD_CONSTRAINTS.free_plan_expiry_days.max) {
      errors.push(`Free plan expiry days must be between ${FIELD_CONSTRAINTS.free_plan_expiry_days.min} and ${FIELD_CONSTRAINTS.free_plan_expiry_days.max} days`);
    }
  }

  // ========== Business Logic Rules ==========
  if (planData.account_type === 'free' && planData.price && planData.price > 0) {
    errors.push("Free account type cannot have a price greater than 0");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to get account type label from value
 */
export function getAccountTypeLabel(value: string): string {
  const accountType = ACCOUNT_TYPES.find(t => t.value === value);
  return accountType ? accountType.label : value;
}
