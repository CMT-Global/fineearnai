/**
 * Earner Badge System - Centralized Logic
 * 
 * This utility provides a single source of truth for determining user badge status.
 * 
 * Current badges:
 * - Verified Earner: Users with upgraded plans (personal, business, group)
 * - Unverified Earner: Users on the default plan (Trainee)
 * 
 * Future extensibility:
 * - Elite Earner (top performers)
 * - Power Earner (high volume completers)
 * - Streak Master (consecutive day streaks)
 * - Achievement badges (task milestones, referral milestones, etc.)
 */

export interface EarnerBadgeStatus {
  isVerified: boolean;
  badgeText: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  icon: string;
  upgradePrompt?: string;
  description: string;
}

/**
 * Determines the earner badge status based on the user's account type.
 * 
 * @param accountType - The account type from the membership_plans table
 * @returns Badge configuration object with display properties
 */
export function getEarnerBadgeStatus(accountType: string | null | undefined): EarnerBadgeStatus {
  // Normalize account type to lowercase for comparison
  const normalizedType = (accountType || 'free').toLowerCase().trim();

  // Verified Earner: All upgraded plans (personal, business, group)
  if (['personal', 'business', 'group'].includes(normalizedType)) {
    return {
      isVerified: true,
      badgeText: 'Verified Earner',
      badgeVariant: 'success',
      icon: '✓',
      description: 'You are a verified earner with full platform access and benefits.',
    };
  }

  // Unverified Earner: Default plan (Trainee) only
  return {
    isVerified: false,
    badgeText: 'Unverified Earner',
    badgeVariant: 'warning',
    icon: '⚠',
    upgradePrompt: 'Upgrade to a paid plan to become a Verified Earner and unlock higher earnings, more daily tasks, and better referral commissions.',
    description: 'Limited access. Upgrade to unlock full earning potential.',
  };
}

/**
 * Helper function to check if a user is a verified earner
 * 
 * @param accountType - The account type from the membership_plans table
 * @returns True if the user is on an upgraded plan
 */
export function isVerifiedEarner(accountType: string | null | undefined): boolean {
  return getEarnerBadgeStatus(accountType).isVerified;
}

/**
 * Helper function to get a simple badge label for display
 * 
 * @param accountType - The account type from the membership_plans table
 * @returns Simple string label for the badge
 */
export function getEarnerBadgeLabel(accountType: string | null | undefined): string {
  return getEarnerBadgeStatus(accountType).badgeText;
}
