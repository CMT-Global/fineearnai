export interface PaymentProcessorGuide {
  id: string;
  name: string;
  displayName: string;
  countryCode: string; // ISO 3166-1 alpha-2 or 'GLOBAL'
  countryName: string;
  flag: string; // emoji flag
  description: string;
  isGlobal: boolean; // true for worldwide processors like Binance
  category: 'mobile_wallet' | 'exchange' | 'bank' | 'crypto_wallet';
  depositSteps: GuideStep[];
  withdrawalSteps: GuideStep[];
  depositAlertMessage?: string;
  withdrawalAlertMessage?: string;
}

export interface GuideStep {
  stepNumber: number;
  instruction: string;
  highlights: string[]; // Words/phrases to highlight with emphasis
  delay?: string; // Animation delay (e.g., '0.1s', '0.2s')
}

export type GuideType = 'deposit' | 'withdrawal';
