/**
 * Cryptocurrency Configuration Types
 * Defines supported cryptocurrencies, their networks, and processor compatibility
 */

export interface CryptoCurrency {
  id: 'usdt-bep20';
  symbol: string; // 'USDT'
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
 * Note: USDC (Solana) withdrawals are currently disabled. Only USDT (BEP-20) is supported.
 */
export const SUPPORTED_CRYPTOCURRENCIES: CryptoCurrency[] = [
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
    isDefault: true,
    description: 'Low fees on Binance Smart Chain (~$0.10-$0.50)',
    feeInfo: 'Network fee: ~$0.10-$0.50 | Processing: 1-3 minutes'
  }
];

/**
 * Payment processor cryptocurrency support mapping
 * Defines which payment processors support which cryptocurrencies
 * Note: USDC-Solana entries preserved for reference/deposits but not active for withdrawals.
 */
export const PROCESSOR_CRYPTO_SUPPORT: Record<string, string[]> = {
  // All withdrawal processors now support USDT-BEP20 only
  'binance-global': ['usdt-bep20'],
  'coinsph': ['usdt-bep20'],
  'bybit': ['usdt-bep20'],
  'coinbase': ['usdt-bep20'],
  'kucoin': ['usdt-bep20'],
  'gcrypto': ['usdt-bep20'],
  'gcash-ph': ['usdt-bep20'],
  'okx': ['usdt-bep20'],
  'kraken': ['usdt-bep20'],
  'gate-io': ['usdt-bep20'],
  'mexc': ['usdt-bep20'],
  'huobi': ['usdt-bep20'],
  'crypto-com': ['usdt-bep20'],
  
  // CPAY processors
  'cpay': ['usdt-bep20'],
  'cpay-deposit': ['usdt-bep20'],
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
