import { PaymentProcessorGuide } from '@/types/payment-guides';

export const PAYMENT_GUIDES: PaymentProcessorGuide[] = [
  {
    id: 'gcash-ph',
    name: 'GCash',
    displayName: 'GCash GCrypto',
    countryCode: 'PH',
    countryName: 'Philippines',
    flag: '🇵🇭',
    description: 'Use GCash GCrypto for instant deposits and withdrawals',
    isGlobal: false,
    category: 'mobile_wallet',
    depositSteps: [
      {
        stepNumber: 1,
        instruction: 'Open your GCash App → Tap GCrypto (under "View All" → "Finance").',
        highlights: ['GCash App', 'GCrypto'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'Tap Buy Crypto → Choose USDC (Solana) (recommended for lowest fees) or any other supported coin → Complete your purchase on GCrypto.',
        highlights: ['Buy Crypto', 'USDC (Solana)', 'recommended for lowest fees'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to your FineEarn account, open the Deposit page → Enter your deposit amount.',
        highlights: ['FineEarn account', 'Deposit page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Choose USDC as the coin → Select Solana as the network → Copy the wallet address shown on FineEarn.',
        highlights: ['USDC', 'Solana'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Go back to GCrypto → Tap Send Crypto → Paste the FineEarn wallet address you copied.',
        highlights: ['GCrypto', 'Send Crypto'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Enter the same amount and confirm the transaction.',
        highlights: [],
        delay: '0.5s'
      }
    ],
    withdrawalSteps: [
      {
        stepNumber: 1,
        instruction: 'In your GCash App, go to GCrypto → Select USDC (Solana) → Tap Receive → Copy your USDC (Solana) wallet address.',
        highlights: ['GCash App', 'GCrypto', 'USDC (Solana)', 'Receive'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'On FineEarn, open the Withdraw page → Enter your withdrawal amount.',
        highlights: ['FineEarn', 'Withdraw page'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Paste the GCrypto USDC (Solana) address you copied earlier → Confirm and submit your withdrawal request.',
        highlights: ['GCrypto USDC (Solana)'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Once processed, you\'ll receive USDC in your GCrypto wallet.',
        highlights: ['USDC', 'GCrypto wallet'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'To convert to PHP, go to GCrypto → Tap Sell USDC → Choose GCash Balance.',
        highlights: ['GCrypto', 'Sell USDC', 'GCash Balance'],
        delay: '0.4s'
      }
    ],
    depositAlertMessage: '✅ Once payment is confirmed on the blockchain, your FineEarn deposit wallet will be credited automatically.',
    withdrawalAlertMessage: '💵 Your funds will reflect instantly in your GCash wallet.'
  }
];
