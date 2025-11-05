/**
 * Master list of ALL available email variables across the platform
 * Used in both EmailTemplates and BulkEmail components
 */

export interface EmailVariable {
  name: string;
  description: string;
}

export interface EmailVariableCategory {
  [category: string]: EmailVariable[];
}

export const ALL_AVAILABLE_VARIABLES: EmailVariableCategory = {
  "User Information": [
    { name: "username", description: "User's username" },
    { name: "email", description: "User's email address" },
    { name: "full_name", description: "User's full name" }
  ],
  "Transaction Variables": [
    { name: "amount", description: "Transaction amount" },
    { name: "transaction_id", description: "Unique transaction ID" },
    { name: "new_balance", description: "Updated wallet balance" },
    { name: "payment_method", description: "Payment method used" },
    { name: "gateway", description: "Payment gateway (CPAY, Payeer)" },
    { name: "rejection_reason", description: "Reason for rejection (if applicable)" }
  ],
  "Referral Variables": [
    { name: "referred_username", description: "New referral's username" },
    { name: "referral_code", description: "User's referral code" },
    { name: "total_referrals", description: "Total referrals count" },
    { name: "milestone_count", description: "Milestone reached (5, 10, 25, etc.)" },
    { name: "total_commission", description: "Total commission earned" },
    { name: "reward_message", description: "Milestone reward message" },
    { name: "next_milestone", description: "Next milestone target" },
    { name: "referrals_to_next", description: "Referrals needed for next milestone" }
  ],
  "Membership Variables": [
    { name: "plan_name", description: "Membership plan name" },
    { name: "expiry_date", description: "Plan expiration date" },
    { name: "days_until_expiry", description: "Days remaining until expiry" },
    { name: "plan_price", description: "Plan cost" },
    { name: "new_plan", description: "New plan name (for upgrades)" },
    { name: "old_plan", description: "Previous plan name (for upgrades)" }
  ],
  "Authentication Variables": [
    { name: "reset_link", description: "Password reset URL" },
    { name: "confirmation_link", description: "Email confirmation URL" },
    { name: "magic_link", description: "Magic link login URL" },
    { name: "token_hash", description: "Security token" },
    { name: "redirect_to", description: "Redirect URL after action" },
    { name: "old_email", description: "Previous email address" },
    { name: "new_email", description: "New email address" }
  ],
  "Platform Variables": [
    { name: "platform_url", description: "Platform homepage URL" },
    { name: "support_email", description: "Support contact email" },
    { name: "company_name", description: "Platform name (FineEarn)" }
  ]
} as const;

// Most commonly used variables
export const MOST_USED_VARIABLES: EmailVariable[] = [
  { name: "username", description: "User's username" },
  { name: "email", description: "User's email address" },
  { name: "full_name", description: "User's full name" }
];

// Helper to get category icon
export const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    "User Information": "👤",
    "Transaction Variables": "💰",
    "Referral Variables": "🤝",
    "Membership Variables": "📊",
    "Authentication Variables": "🔐",
    "Platform Variables": "🌐"
  };
  return iconMap[category] || "📝";
};
