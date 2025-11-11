/**
 * Phase 4: Enhanced error parsing for voucher purchase operations
 * Provides user-friendly error messages based on error codes and patterns
 */

interface ParsedError {
  title: string;
  message: string;
  actionable: boolean;
  suggestion?: string;
}

/**
 * Parse voucher purchase error messages into user-friendly format
 */
export function parseVoucherError(error: string): ParsedError {
  const errorLower = error.toLowerCase();
  
  // Insufficient balance
  if (errorLower.includes('insufficient') || errorLower.includes('balance')) {
    return {
      title: 'Insufficient Balance',
      message: 'You don\'t have enough funds in your deposit wallet to purchase this voucher.',
      actionable: true,
      suggestion: 'Please add funds to your deposit wallet or select a smaller voucher amount.'
    };
  }
  
  // Username not found
  if (errorLower.includes('user not found') || errorLower.includes('username') || errorLower.includes('recipient')) {
    return {
      title: 'Recipient Not Found',
      message: 'The username you entered doesn\'t exist in our system.',
      actionable: true,
      suggestion: 'Please double-check the spelling and try again.'
    };
  }
  
  // Duplicate/race condition
  if (errorLower.includes('duplicate') || errorLower.includes('already exists') || errorLower.includes('unique')) {
    return {
      title: 'Purchase In Progress',
      message: 'A purchase is already being processed. Please wait a moment.',
      actionable: true,
      suggestion: 'If this persists, refresh the page and check your voucher history.'
    };
  }
  
  // Rate limiting
  if (errorLower.includes('rate limit') || errorLower.includes('too many')) {
    return {
      title: 'Too Many Requests',
      message: 'You\'re making purchases too quickly.',
      actionable: true,
      suggestion: 'Please wait a moment before trying again.'
    };
  }
  
  // Database/system errors
  if (errorLower.includes('database') || errorLower.includes('connection') || errorLower.includes('timeout')) {
    return {
      title: 'System Error',
      message: 'We\'re experiencing technical difficulties.',
      actionable: false,
      suggestion: 'Please try again in a few moments. If the problem persists, contact support.'
    };
  }
  
  // Partner config issues
  if (errorLower.includes('partner') && (errorLower.includes('config') || errorLower.includes('commission'))) {
    return {
      title: 'Partner Configuration Error',
      message: 'There\'s an issue with your partner account setup.',
      actionable: false,
      suggestion: 'Please contact support for assistance.'
    };
  }
  
  // Session/auth issues
  if (errorLower.includes('session') || errorLower.includes('unauthorized') || errorLower.includes('authentication')) {
    return {
      title: 'Session Expired',
      message: 'Your session has expired. Please log in again.',
      actionable: true,
      suggestion: 'Refresh the page and log back in to continue.'
    };
  }
  
  // Generic fallback
  return {
    title: 'Purchase Failed',
    message: error || 'An unexpected error occurred while processing your purchase.',
    actionable: false,
    suggestion: 'Please try again. If the problem continues, contact support.'
  };
}

/**
 * Format error for toast display
 */
export function formatVoucherErrorToast(error: string): string {
  const parsed = parseVoucherError(error);
  
  if (parsed.suggestion) {
    return `${parsed.message} ${parsed.suggestion}`;
  }
  
  return parsed.message;
}
