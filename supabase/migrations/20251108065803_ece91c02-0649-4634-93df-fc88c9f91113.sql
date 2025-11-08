-- Fix Phase 1: Rename USDT-TRC20 to USDT-BEP20 (Binance Smart Chain)
-- This corrects the network from Tron to BSC

-- Rename the column
ALTER TABLE profiles 
RENAME COLUMN usdt_trc20_address TO usdt_bep20_address;

-- Drop old index and create new one
DROP INDEX IF EXISTS idx_profiles_crypto_addresses;
CREATE INDEX idx_profiles_crypto_addresses ON profiles(id) 
WHERE usdc_solana_address IS NOT NULL OR usdt_bep20_address IS NOT NULL;

-- Update comment to reflect BSC network
COMMENT ON COLUMN profiles.usdt_bep20_address IS 'User USDT withdrawal address on Binance Smart Chain (BEP-20) network';