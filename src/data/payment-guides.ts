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
  },
  {
    id: 'binance-global',
    name: 'Binance',
    displayName: 'Binance Exchange',
    countryCode: 'GLOBAL',
    countryName: 'Worldwide',
    flag: '🌍',
    description: 'Use Binance for secure deposits and withdrawals globally with low fees',
    isGlobal: true,
    category: 'exchange',
    depositSteps: [
      {
        stepNumber: 1,
        instruction: 'Log in to your Binance account → Go to Wallet → Select Spot Wallet.',
        highlights: ['Binance account', 'Wallet', 'Spot Wallet'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'If you don\'t have crypto, click Buy Crypto → Choose your preferred payment method → Purchase cryptocurrency (BTC, ETH, USDC, USDT, TRX, or others supported by FineEarn).',
        highlights: ['Buy Crypto', 'cryptocurrency', 'BTC, ETH, USDC, USDT, TRX'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to your FineEarn account → Open the Deposit page → Enter your deposit amount.',
        highlights: ['FineEarn account', 'Deposit page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select your coin (BTC, ETH, USDC, USDT, etc.) → Choose the network (we recommend Solana for USDC or BEP20 (BSC) for USDT - both have low fees) → Copy the wallet address displayed.',
        highlights: ['coin', 'Solana', 'USDC', 'BEP20 (BSC)', 'USDT', 'low fees'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Return to Binance → Click Withdraw → Select the same coin and network you chose → Paste the FineEarn wallet address.',
        highlights: ['Binance', 'Withdraw', 'same coin and network'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Enter the amount → Complete security verification (2FA/Email) → Confirm the withdrawal.',
        highlights: ['security verification', '2FA'],
        delay: '0.5s'
      }
    ],
    withdrawalSteps: [
      {
        stepNumber: 1,
        instruction: 'Log in to your Binance account → Go to Wallet → Select Spot Wallet → Click Deposit.',
        highlights: ['Binance account', 'Spot Wallet', 'Deposit'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'Select USDC or USDT → Choose the network that matches what FineEarn will send (Solana for USDC or BEP20 (BSC) for USDT).',
        highlights: ['USDC', 'USDT', 'Solana', 'BEP20 (BSC)'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Copy your Binance deposit address for the selected coin and network.',
        highlights: ['Binance deposit address'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'On FineEarn, open the Withdraw page → Enter your withdrawal amount → Select the matching coin and network (USDC-Solana or USDT-BEP20).',
        highlights: ['FineEarn', 'Withdraw page', 'matching coin and network'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Paste your Binance wallet address → Confirm and submit your withdrawal request.',
        highlights: ['Binance wallet address'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Once processed, funds will appear in your Binance Spot Wallet. You can then trade, hold, or withdraw to your bank.',
        highlights: ['Binance Spot Wallet'],
        delay: '0.5s'
      }
    ],
    depositAlertMessage: '✅ Binance deposits typically confirm within 1-5 minutes depending on network congestion.',
    withdrawalAlertMessage: '💰 After admin approval, funds will arrive in your Binance wallet within minutes.'
  },
  {
    id: 'coinbase-global',
    name: 'Coinbase',
    displayName: 'Coinbase Exchange',
    countryCode: 'GLOBAL',
    countryName: 'Worldwide',
    flag: '🌎',
    description: 'Use Coinbase for easy deposits and withdrawals with a user-friendly interface',
    isGlobal: true,
    category: 'exchange',
    depositSteps: [
      {
        stepNumber: 1,
        instruction: 'Log in to your Coinbase account → Navigate to Assets → Select your cryptocurrency.',
        highlights: ['Coinbase account', 'Assets'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'If you need to buy crypto, click Buy → Choose your preferred cryptocurrency (USDC on Solana recommended for lowest fees, or BTC, ETH, USDT on BEP20, etc.) → Complete your purchase.',
        highlights: ['Buy', 'USDC on Solana', 'lowest fees', 'BTC, ETH, USDT'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to FineEarn → Open Deposit page → Enter the amount you want to deposit.',
        highlights: ['FineEarn', 'Deposit page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select your coin (USDC recommended) → Choose Solana network for lowest fees (or BEP20 for USDT) → Copy the wallet address shown.',
        highlights: ['coin', 'USDC', 'Solana', 'lowest fees', 'BEP20'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Return to Coinbase → Click Send → Select USDC → Choose Solana network → Paste the FineEarn address.',
        highlights: ['Coinbase', 'Send', 'Solana network'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Enter the amount → Review the details → Click Send now to complete the transaction.',
        highlights: ['Send now'],
        delay: '0.5s'
      }
    ],
    withdrawalSteps: [
      {
        stepNumber: 1,
        instruction: 'Log in to Coinbase → Go to Assets → Find USDC or your preferred coin → Click Receive.',
        highlights: ['Coinbase', 'Assets', 'Receive'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'Select the network (Solana for USDC recommended) → Copy your Coinbase wallet address.',
        highlights: ['Solana', 'Coinbase wallet address'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'On FineEarn, navigate to Withdraw page → Enter your withdrawal amount.',
        highlights: ['FineEarn', 'Withdraw page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select USDC and Solana network → Paste your Coinbase wallet address you copied.',
        highlights: ['USDC', 'Solana', 'Coinbase wallet address'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Confirm the withdrawal details → Submit your withdrawal request.',
        highlights: [],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Once approved, your funds will arrive in Coinbase. You can then sell for fiat or transfer to your bank.',
        highlights: ['Coinbase', 'sell for fiat'],
        delay: '0.5s'
      }
    ],
    depositAlertMessage: '✅ Deposits via Coinbase are usually confirmed within 2-5 minutes.',
    withdrawalAlertMessage: '💵 Your funds will be available in Coinbase shortly after processing.'
  },
  {
    id: 'trust-wallet-global',
    name: 'Trust Wallet',
    displayName: 'Trust Wallet',
    countryCode: 'GLOBAL',
    countryName: 'Worldwide',
    flag: '🌐',
    description: 'Use Trust Wallet for secure, self-custodial crypto deposits and withdrawals',
    isGlobal: true,
    category: 'crypto_wallet',
    depositSteps: [
      {
        stepNumber: 1,
        instruction: 'Open Trust Wallet app → Make sure you have cryptocurrency available (USDC on Solana recommended for lowest fees, or BTC, ETH, USDT on BEP20, etc.).',
        highlights: ['Trust Wallet app', 'USDC on Solana', 'lowest fees', 'BTC, ETH, USDT on BEP20'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'If you need to buy crypto, tap Buy → Select your preferred coin (USDC, USDT, BTC, ETH, etc.) → Choose the appropriate network (Solana for USDC, BEP20 for USDT) → Complete purchase.',
        highlights: ['Buy', 'preferred coin', 'Solana', 'USDC', 'BEP20', 'USDT'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to FineEarn → Open Deposit page → Enter your deposit amount.',
        highlights: ['FineEarn', 'Deposit page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select your coin → Choose the appropriate network (Solana for USDC, BEP20 for USDT) → Copy the wallet address displayed.',
        highlights: ['coin', 'Solana', 'BEP20'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Return to Trust Wallet → Select USDC (Solana) → Tap Send → Paste the FineEarn wallet address.',
        highlights: ['Trust Wallet', 'Send', 'FineEarn wallet address'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Enter the amount → Review transaction details including network fees → Confirm and send.',
        highlights: ['network fees', 'Confirm'],
        delay: '0.5s'
      }
    ],
    withdrawalSteps: [
      {
        stepNumber: 1,
        instruction: 'Open Trust Wallet → Find USDC on Solana network → Tap Receive.',
        highlights: ['Trust Wallet', 'USDC', 'Solana', 'Receive'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'Make sure you\'re on the Solana network → Copy your Trust Wallet USDC address.',
        highlights: ['Solana network', 'Trust Wallet USDC address'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to FineEarn → Open Withdraw page → Enter your withdrawal amount.',
        highlights: ['FineEarn', 'Withdraw page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select USDC and Solana network → Paste your Trust Wallet address.',
        highlights: ['USDC', 'Solana', 'Trust Wallet address'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Double-check the address matches → Confirm and submit withdrawal request.',
        highlights: ['Double-check', 'submit'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Once processed, USDC will appear in your Trust Wallet. You can swap, trade, or hold it securely.',
        highlights: ['Trust Wallet', 'swap', 'trade'],
        delay: '0.5s'
      }
    ],
    depositAlertMessage: '✅ Trust Wallet transactions are peer-to-peer and confirm quickly on Solana network.',
    withdrawalAlertMessage: '🔐 Your funds will be in your self-custodial Trust Wallet, giving you full control.'
  },
  {
    id: 'metamask-global',
    name: 'MetaMask',
    displayName: 'MetaMask Wallet',
    countryCode: 'GLOBAL',
    countryName: 'Worldwide',
    flag: '🦊',
    description: 'Use MetaMask for decentralized deposits and withdrawals across multiple networks',
    isGlobal: true,
    category: 'crypto_wallet',
    depositSteps: [
      {
        stepNumber: 1,
        instruction: 'Open MetaMask browser extension or mobile app → Ensure you have cryptocurrency available (USDC, USDT, BTC, ETH, or others).',
        highlights: ['MetaMask', 'cryptocurrency', 'USDC, USDT, BTC, ETH'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'If needed, buy crypto using MetaMask\'s Buy feature or bridge tokens to Solana network.',
        highlights: ['Buy feature', 'bridge tokens', 'Solana'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to FineEarn → Open Deposit page → Enter the amount to deposit.',
        highlights: ['FineEarn', 'Deposit page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select your coin (USDC, USDT, BTC, ETH, etc.) → Choose the network (Solana for USDC or BEP20 for USDT recommended for low fees) → Copy the deposit address shown.',
        highlights: ['coin', 'Solana', 'USDC', 'BEP20', 'USDT', 'low fees'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Return to MetaMask → Click Send → Paste FineEarn\'s wallet address → Select correct network and token.',
        highlights: ['MetaMask', 'Send', 'correct network'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Enter amount → Review gas fees and transaction details → Confirm to complete deposit.',
        highlights: ['gas fees', 'Confirm'],
        delay: '0.5s'
      }
    ],
    withdrawalSteps: [
      {
        stepNumber: 1,
        instruction: 'Open MetaMask → Switch to the network you want to receive funds on (Solana recommended for lower fees).',
        highlights: ['MetaMask', 'Solana', 'lower fees'],
        delay: '0s'
      },
      {
        stepNumber: 2,
        instruction: 'Find your USDC/USDT token → Copy your MetaMask wallet address for that specific network.',
        highlights: ['USDC', 'USDT', 'MetaMask wallet address'],
        delay: '0.1s'
      },
      {
        stepNumber: 3,
        instruction: 'Go to FineEarn → Open Withdraw page → Enter withdrawal amount.',
        highlights: ['FineEarn', 'Withdraw page'],
        delay: '0.2s'
      },
      {
        stepNumber: 4,
        instruction: 'Select matching token and network → Paste your MetaMask wallet address.',
        highlights: ['matching token', 'network', 'MetaMask wallet address'],
        delay: '0.3s'
      },
      {
        stepNumber: 5,
        instruction: 'Verify all details are correct → Confirm and submit your withdrawal request.',
        highlights: ['Verify', 'Confirm'],
        delay: '0.4s'
      },
      {
        stepNumber: 6,
        instruction: 'Once approved and processed, tokens will appear in your MetaMask wallet on the selected network.',
        highlights: ['MetaMask wallet'],
        delay: '0.5s'
      }
    ],
    depositAlertMessage: '✅ Always ensure you\'re using the correct network to avoid losing funds.',
    withdrawalAlertMessage: '🦊 MetaMask gives you full control - always double-check addresses and networks before confirming.'
  }
];
