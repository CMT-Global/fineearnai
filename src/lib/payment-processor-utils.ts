/**
 * Payment Processor Display Name Mapping Utility
 * 
 * Masks technical payment processor names from regular users while keeping
 * them visible to admins for debugging and support purposes.
 */

/**
 * Processor name mapping for user-friendly display
 */
const PROCESSOR_DISPLAY_NAMES: Record<string, { user: string; admin: string }> = {
  cpay: {
    user: "Crypto",
    admin: "CPAY"
  },
  payeer: {
    user: "Crypto",
    admin: "Payeer"
  },
  // Add more processors as needed
  // Example: stripe: { user: "Card Payment", admin: "Stripe" }
};

/**
 * Get display name for a payment processor based on user role
 * 
 * @param processorName - Raw processor name from database (e.g., "cpay", "payeer")
 * @param isAdmin - Whether the current user is an admin
 * @returns User-friendly display name or actual processor name for admins
 */
export const getDisplayNameForUser = (
  processorName: string | null | undefined,
  isAdmin: boolean
): string => {
  if (!processorName) {
    return "Unknown";
  }

  const normalizedName = processorName.toLowerCase().trim();
  const mapping = PROCESSOR_DISPLAY_NAMES[normalizedName];

  if (!mapping) {
    // If no mapping exists, return the original name capitalized for admins
    // or a generic name for users
    return isAdmin 
      ? processorName.toUpperCase() 
      : "Payment Gateway";
  }

  return isAdmin ? mapping.admin : mapping.user;
};

/**
 * Mask payment processor names in transaction descriptions
 * 
 * @param description - Original transaction description
 * @param isAdmin - Whether the current user is an admin
 * @returns Masked description for users or original for admins
 */
export const maskTransactionDescription = (
  description: string | null | undefined,
  isAdmin: boolean
): string => {
  if (!description) {
    return "";
  }

  // Admins see original descriptions
  if (isAdmin) {
    return description;
  }

  // Apply masking for regular users
  let maskedDescription = description;

  // Replace CPAY references
  maskedDescription = maskedDescription.replace(/CPAY/gi, "Crypto");
  maskedDescription = maskedDescription.replace(/cpay/gi, "crypto");

  // Replace Payeer references
  maskedDescription = maskedDescription.replace(/Payeer/gi, "Crypto");
  maskedDescription = maskedDescription.replace(/payeer/gi, "crypto");

  // Replace technical order IDs pattern (e.g., "Order DEP-xxx" or "Order WD-xxx")
  maskedDescription = maskedDescription.replace(
    /Order (DEP|WD)-[A-Z0-9-]+/gi,
    "Transaction"
  );

  // Clean up common technical terms
  maskedDescription = maskedDescription.replace(/via cpay/gi, "via crypto");
  maskedDescription = maskedDescription.replace(/via payeer/gi, "via crypto");

  return maskedDescription;
};

/**
 * Get display name for withdrawal payment methods
 * 
 * @param method - Raw payment method name from database
 * @param isAdmin - Whether the current user is an admin
 * @returns User-friendly method name or actual method for admins
 */
export const getPaymentMethodDisplayName = (
  method: string | null | undefined,
  isAdmin: boolean
): string => {
  if (!method) {
    return "Unknown";
  }

  // Admins see original method names
  if (isAdmin) {
    return method;
  }

  const normalizedMethod = method.toLowerCase();

  // CPAY withdrawal methods
  if (normalizedMethod.includes("cpay")) {
    return "Cryptocurrency";
  }

  // Payeer withdrawal methods
  if (normalizedMethod.includes("payeer")) {
    if (normalizedMethod.includes("usdt") || normalizedMethod.includes("trc20")) {
      return "Cryptocurrency (USDT)";
    }
    if (normalizedMethod.includes("btc") || normalizedMethod.includes("bitcoin")) {
      return "Cryptocurrency (BTC)";
    }
    return "Cryptocurrency";
  }

  // Generic cryptocurrency patterns
  if (
    normalizedMethod.includes("crypto") ||
    normalizedMethod.includes("usdt") ||
    normalizedMethod.includes("btc") ||
    normalizedMethod.includes("trc20")
  ) {
    return "Cryptocurrency";
  }

  // Fallback: return a generic name for users
  return "Payment Method";
};
