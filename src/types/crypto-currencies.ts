/**
 * Cryptocurrency Configuration Types
 * Defines supported cryptocurrencies, their networks, and processor compatibility
 */

export interface CryptoCurrency {
  id: 'usdc-solana' | 'usdt-bep20';
  symbol: string; // 'USDC' or 'USDT'
  displayName: string; // Full display name with network
  network: string; // Network name
  networkShort: string; // Short network identifier
  icon: string; // Emoji icon for UI
  addressPlaceholder: string; // Input placeholder text
  addressPattern?: RegExp; // Optional validation pattern
  addressExample?: string; // Example address for guidance
  isDefault?: boolean; // Default selection
  description: string; // User-friendly description
  feeInfo: string; // Fee information
}

/**
 * Supported cryptocurrencies configuration
 */
export const SUPPORTED_CRYPTOCURRENCIES: CryptoCurrency[] = [
  {
    id: 'usdc-solana',
    symbol: 'USDC',
    displayName: 'USDC (Solana)',
    network: 'Solana (SPL)',
    networkShort: 'SOL',
    icon: '⚡',
    addressPlaceholder: 'Enter your USDC Solana (SPL) wallet address',
    addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, // Solana base58 address format
    addressExample: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    isDefault: true,
    description: 'Ultra-fast transfers with lowest fees (~$0.001)',
    feeInfo: 'Network fee: ~$0.001 | Processing: Instant'
  },
  {
    id: 'usdt-bep20',
    symbol: 'USDT',
    displayName: 'USDT (BEP-20)',
    network: 'Binance Smart Chain (BEP-20)',
    networkShort: 'BSC',
    icon: '🚀',
    addressPlaceholder: 'Enter your USDT BEP-20 wallet address',
    addressPattern: /^0x[a-fA-F0-9]{40}$/, // BSC/Ethereum address format (0x + 40 hex chars)
    addressExample: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Low fees on Binance Smart Chain (~$0.10-$0.50)',
    feeInfo: 'Network fee: ~$0.10-$0.50 | Processing: 1-3 minutes'
  }
];

/**
 * Payment processor cryptocurrency support mapping
 * Defines which payment processors support which cryptocurrencies
 */
export const PROCESSOR_CRYPTO_SUPPORT: Record<string, string[]> = {
  // GCash only supports USDC Solana (as per payment guide requirements)
  'gcash-ph': ['usdc-solana'],
  
  // All other processors support both USDC-Solana and USDT-BEP20
  'binance-global': ['usdc-solana', 'usdt-bep20'],
  'coinsph': ['usdc-solana', 'usdt-bep20'],
  'bybit': ['usdc-solana', 'usdt-bep20'],
  'coinbase': ['usdc-solana', 'usdt-bep20'],
  'kucoin': ['usdc-solana', 'usdt-bep20'],
  'gcrypto': ['usdc-solana', 'usdt-bep20'],
  'okx': ['usdc-solana', 'usdt-bep20'],
  'kraken': ['usdc-solana', 'usdt-bep20'],
  'gate-io': ['usdc-solana', 'usdt-bep20'],
  'mexc': ['usdc-solana', 'usdt-bep20'],
  'huobi': ['usdc-solana', 'usdt-bep20'],
  'crypto-com': ['usdc-solana', 'usdt-bep20'],
  
  // CPAY processors
  'cpay': ['usdc-solana', 'usdt-bep20'],
  'cpay-deposit': ['usdc-solana', 'usdt-bep20'],
};

/**
 * Get supported cryptocurrencies for a specific payment processor
 */
export const getSupportedCryptos = (processorId: string): CryptoCurrency[] => {
  const supportedIds = PROCESSOR_CRYPTO_SUPPORT[processorId] || ['usdc-solana', 'usdt-bep20'];
  return SUPPORTED_CRYPTOCURRENCIES.filter(crypto => supportedIds.includes(crypto.id));
};

/**
 * Get cryptocurrency by ID
 */
export const getCryptoById = (cryptoId: string): CryptoCurrency | undefined => {
  return SUPPORTED_CRYPTOCURRENCIES.find(crypto => crypto.id === cryptoId);
};

/**
 * Validate cryptocurrency address format
 */
export const validateCryptoAddress = (cryptoId: string, address: string): boolean => {
  const crypto = getCryptoById(cryptoId);
  if (!crypto || !crypto.addressPattern) return true; // Skip validation if no pattern
  
  return crypto.addressPattern.test(address.trim());
};

/**
 * Get default cryptocurrency
 */
export const getDefaultCrypto = (): CryptoCurrency => {
  return SUPPORTED_CRYPTOCURRENCIES.find(crypto => crypto.isDefault) || SUPPORTED_CRYPTOCURRENCIES[0];
};

/**
 * Network display helper - get short network name with icon
 */
export const getNetworkDisplay = (cryptoId: string): string => {
  const crypto = getCryptoById(cryptoId);
  if (!crypto) return '';
  return `${crypto.icon} ${crypto.symbol} (${crypto.networkShort})`;
};

/**
 * Check if processor supports a specific cryptocurrency
 */
export const processorSupportsCrypto = (processorId: string, cryptoId: string): boolean => {
  const supported = PROCESSOR_CRYPTO_SUPPORT[processorId] || ['usdc-solana', 'usdt-bep20'];
  return supported.includes(cryptoId);
};
