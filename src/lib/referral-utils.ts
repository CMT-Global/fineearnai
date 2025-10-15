/**
 * Referral Utilities
 * Helper functions for referral system functionality
 */

export interface ShareUrls {
  whatsapp: string;
  telegram: string;
  twitter: string;
  facebook: string;
}

/**
 * Generate a referral URL from a referral code
 */
export const generateReferralUrl = (code: string): string => {
  return `${window.location.origin}/signup?ref=${code}`;
};

/**
 * Format commission rate as percentage
 */
export const formatCommissionRate = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

/**
 * Generate share URLs for various social platforms
 */
export const getShareUrls = (referralUrl: string, message: string): ShareUrls => {
  const encodedUrl = encodeURIComponent(referralUrl);
  const encodedMessage = encodeURIComponent(message);
  const fullMessage = encodeURIComponent(`${message} ${referralUrl}`);

  return {
    whatsapp: `https://wa.me/?text=${fullMessage}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  };
};

/**
 * Validate referral code format (client-side only)
 * Backend performs full validation
 */
export const validateReferralCode = (code: string): boolean => {
  // Referral codes should be 8 uppercase alphanumeric characters
  return /^[A-Z0-9]{8}$/.test(code);
};

/**
 * Format referral earnings by type
 */
export const formatReferralEarningType = (type: string): string => {
  const typeMap: Record<string, string> = {
    task_commission: "Task Commission",
    deposit_commission: "Deposit Commission",
    signup_bonus: "Signup Bonus",
    referral_bonus: "Referral Bonus",
  };
  return typeMap[type] || type;
};

/**
 * Calculate total referral earnings
 */
export const calculateTotalReferralEarnings = (
  earnings: Array<{ commission_amount: number }>
): number => {
  return earnings.reduce((total, earning) => total + Number(earning.commission_amount), 0);
};

/**
 * Calculate referral commission based on plan settings
 */
export const calculateReferralCommission = (
  baseAmount: number,
  commissionRate: number
): number => {
  return baseAmount * commissionRate;
};

/**
 * Get referral status badge color
 */
export const getReferralStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    active: "default",
    inactive: "secondary",
    suspended: "destructive",
    pending: "outline",
  };
  return statusColors[status] || "secondary";
};

/**
 * Format referral link for display
 */
export const shortenReferralUrl = (url: string, maxLength: number = 40): string => {
  if (url.length <= maxLength) return url;
  return `${url.substring(0, maxLength - 3)}...`;
};

/**
 * Get default referral message
 */
export const getDefaultReferralMessage = (userName?: string): string => {
  const base = "Join me on FineEarn and start earning by training AI! Use my referral link to get started:";
  return userName ? `Hey! ${base}` : base;
};

/**
 * Parse referral code from URL
 */
export const parseReferralCodeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  
  if (ref && validateReferralCode(ref)) {
    return ref;
  }
  
  return null;
};
