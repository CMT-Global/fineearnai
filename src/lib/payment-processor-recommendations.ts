import { PaymentProcessorGuide } from '@/types/payment-guides';

export interface ProcessorRecommendation {
  processor: PaymentProcessorGuide;
  score: number;
  reasons: string[];
  badges: ('lowest-fees' | 'fastest' | 'local' | 'popular')[];
}

/**
 * Calculate recommendation score and reasons for a payment processor based on user's country
 */
export const getProcessorRecommendation = (
  processor: PaymentProcessorGuide,
  userCountry: string | null
): ProcessorRecommendation => {
  let score = 0;
  const reasons: string[] = [];
  const badges: ('lowest-fees' | 'fastest' | 'local' | 'popular')[] = [];

  // Base score for all processors
  score += 50;

  // Country-specific matching (highest priority)
  if (userCountry && processor.countryCode === userCountry) {
    score += 50;
    reasons.push('Available in your country');
    badges.push('local');
  }

  // Global processors (available everywhere)
  if (processor.isGlobal) {
    score += 30;
    reasons.push('Available worldwide');
    badges.push('popular');
  }

  // Category-based scoring
  switch (processor.category) {
    case 'exchange':
      score += 25;
      reasons.push('Low transaction fees');
      badges.push('lowest-fees');
      break;
    case 'crypto_wallet':
      score += 20;
      reasons.push('Fast peer-to-peer transfers');
      badges.push('fastest');
      break;
    case 'mobile_wallet':
      score += 15;
      reasons.push('Convenient mobile access');
      break;
  }

  // Specific processor bonuses
  if (processor.id === 'binance-global') {
    score += 15;
    reasons.push('Industry-leading platform');
  }

  if (processor.id === 'gcash-ph' && userCountry === 'PH') {
    score += 40;
    reasons.push('Instant local transfers');
    reasons.push('No international fees');
    badges.push('fastest', 'local');
  }

  // Crypto wallet bonuses (Solana/BEP20 support)
  if (['trust-wallet-global', 'metamask-global', 'coinbase-global'].includes(processor.id)) {
    reasons.push('Supports low-fee networks (Solana, BEP20)');
  }

  return {
    processor,
    score,
    reasons: [...new Set(reasons)], // Remove duplicates
    badges: [...new Set(badges)] // Remove duplicates
  };
};

/**
 * Get top recommended processors for a user based on their country
 */
export const getRecommendedProcessors = (
  processors: PaymentProcessorGuide[],
  userCountry: string | null,
  limit: number = 3
): ProcessorRecommendation[] => {
  const recommendations = processors.map(processor => 
    getProcessorRecommendation(processor, userCountry)
  );

  // Sort by score (highest first)
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Get country-specific processor (if available)
 */
export const getLocalProcessor = (
  processors: PaymentProcessorGuide[],
  userCountry: string | null
): PaymentProcessorGuide | null => {
  if (!userCountry) return null;
  
  return processors.find(
    processor => processor.countryCode === userCountry && !processor.isGlobal
  ) || null;
};

/**
 * Get badge color and label
 */
export const getBadgeConfig = (badge: 'lowest-fees' | 'fastest' | 'local' | 'popular') => {
  switch (badge) {
    case 'lowest-fees':
      return {
        label: 'Lowest Fees',
        color: 'bg-green-500/10 text-green-600 border-green-500/20',
        icon: '💰'
      };
    case 'fastest':
      return {
        label: 'Fastest',
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        icon: '⚡'
      };
    case 'local':
      return {
        label: 'Local',
        color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        icon: '📍'
      };
    case 'popular':
      return {
        label: 'Popular',
        color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
        icon: '🌟'
      };
  }
};
