-- Phase 1: Add dedicated USDC and USDT address fields to profiles table

-- Add withdrawal address fields (nullable for backward compatibility)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS usdc_solana_address TEXT,
ADD COLUMN IF NOT EXISTS usdt_trc20_address TEXT,
ADD COLUMN IF NOT EXISTS withdrawal_addresses_updated_at TIMESTAMPTZ;

-- Add index for faster lookups when retrieving withdrawal addresses
CREATE INDEX IF NOT EXISTS idx_profiles_crypto_addresses 
ON profiles(id) 
WHERE usdc_solana_address IS NOT NULL OR usdt_trc20_address IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.usdc_solana_address IS 'User USDC withdrawal address on Solana (SPL) network - used for withdrawals with ultra-low fees';
COMMENT ON COLUMN profiles.usdt_trc20_address IS 'User USDT withdrawal address on Tron (TRC20) network - widely supported across exchanges';
COMMENT ON COLUMN profiles.withdrawal_addresses_updated_at IS 'Timestamp when withdrawal addresses were last updated - used for security tracking';