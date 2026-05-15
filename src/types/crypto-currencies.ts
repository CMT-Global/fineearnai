/**
 * Cryptocurrency Configuration Types
 * Defines supported cryptocurrencies, their networks, and processor compatibility
 */

export type CryptoCurrencyId = 'usdt-bep20' | 'usdt-trc20';

export interface CryptoCurrency {
  id: CryptoCurrencyId;
  symbol: string;          // 'USDT'
  displayName: string;     // Full display name with network
  network: string;         // Network name
  networkShort: string;    // Short network identifier
  icon: string;            // Emoji icon for UI
  addressPlaceholder: string;   // Input placeholder text
  addressPattern?: RegExp;      // Optional validation pattern
  addressExample?: string;      // Example address for guidance
  isDefault?: boolean;          // Default selection
  description: string;          // User-friendly description
  feeInfo: string;              // Fee information
  /** Profile column where the saved address for this network is stored */
  profileAddressField: 'usdt_bep20_address' | 'usdt_trc20_address';
}

/**
 * Supported cryptocurrencies configuration
 * BEP-20 is the default. TRC-20 is the second option.
 */
export const SUPPORTED_CRYPTOCURRENCIES: CryptoCurrency[] = [
  {
    id: 'usdt-bep20',
    symbol: 'USDT',
    displayName: 'USDT (BEP-20)',
    network: 'Binance Smart Chain (BEP-20)',
    networkShort: 'BSC',
    icon: '🟡',
    addressPlaceholder: 'Enter your USDT BEP-20 wallet address (starts with 0x)',
    addressPattern: /^0x[a-fA-F0-9]{40}$/, // BSC/Ethereum address format
    addressExample: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    isDefault: true,
    description: 'Low fees on Binance Smart Chain (~$0.10–$0.50)',
    feeInfo: 'Network fee: ~$0.10–$0.50 | Processing: 1–3 minutes',
    profileAddressField: 'usdt_bep20_address',
  },
  {
    id: 'usdt-trc20',
    symbol: 'USDT',
    displayName: 'USDT (TRC-20)',
    network: 'TRON Network (TRC-20)',
    networkShort: 'TRC20',
    icon: '🔴',
    addressPlaceholder: 'Enter your USDT TRC-20 wallet address (starts with T)',
    addressPattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, // TRON address format
    addressExample: 'TXbxxxxxxxxxxxxxxxxxxxxxxxxxxxxT',
    isDefault: false,
    description: 'Widely supported on TRON Network (~$1–$3 fee)',
    feeInfo: 'Network fee: ~$1–$3 | Processing: 1–3 minutes',
    profileAddressField: 'usdt_trc20_address',
  },
];

/**
 * Payment processor cryptocurrency support mapping
 * CPay supports both USDT-BEP20 and USDT-TRC20.
 */
export const PROCESSOR_CRYPTO_SUPPORT: Record<string, CryptoCurrencyId[]> = {
  'binance-global': ['usdt-bep20', 'usdt-trc20'],
  'coinsph':        ['usdt-bep20', 'usdt-trc20'],
  'bybit':          ['usdt-bep20', 'usdt-trc20'],
  'coinbase':       ['usdt-bep20', 'usdt-trc20'],
  'kucoin':         ['usdt-bep20', 'usdt-trc20'],
  'gcrypto':        ['usdt-bep20', 'usdt-trc20'],
  'gcash-ph':       ['usdt-bep20', 'usdt-trc20'],
  'okx':            ['usdt-bep20', 'usdt-trc20'],
  'kraken':         ['usdt-bep20', 'usdt-trc20'],
  'gate-io':        ['usdt-bep20', 'usdt-trc20'],
  'mexc':           ['usdt-bep20', 'usdt-trc20'],
  'huobi':          ['usdt-bep20', 'usdt-trc20'],
  'crypto-com':     ['usdt-bep20', 'usdt-trc20'],
  // CPAY processors — both networks supported
  'cpay':           ['usdt-bep20', 'usdt-trc20'],
  'cpay-deposit':   ['usdt-bep20', 'usdt-trc20'],
};

/**
 * Get supported cryptocurrencies for a specific payment processor
 */
export const getSupportedCryptos = (processorId: string): CryptoCurrency[] => {
  const supportedIds = PROCESSOR_CRYPTO_SUPPORT[processorId] ?? ['usdt-bep20', 'usdt-trc20'];
  return SUPPORTED_CRYPTOCURRENCIES.filter(crypto => supportedIds.includes(crypto.id));
};

/**
 * Get cryptocurrency by ID
 */
export const getCryptoById = (cryptoId: string): CryptoCurrency | undefined =>
  SUPPORTED_CRYPTOCURRENCIES.find(crypto => crypto.id === cryptoId);

/**
 * Validate cryptocurrency address format
 */
export const validateCryptoAddress = (cryptoId: string, address: string): boolean => {
  const crypto = getCryptoById(cryptoId);
  if (!crypto?.addressPattern) return true; // Skip if no pattern
  return crypto.addressPattern.test(address.trim());
};

/**
 * Get default cryptocurrency (BEP-20)
 */
export const getDefaultCrypto = (): CryptoCurrency =>
  SUPPORTED_CRYPTOCURRENCIES.find(crypto => crypto.isDefault) ?? SUPPORTED_CRYPTOCURRENCIES[0];

/**
 * Network display helper — short name with icon
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
  const supported = PROCESSOR_CRYPTO_SUPPORT[processorId] ?? ['usdt-bep20', 'usdt-trc20'];
  return supported.includes(cryptoId as CryptoCurrencyId);
};
