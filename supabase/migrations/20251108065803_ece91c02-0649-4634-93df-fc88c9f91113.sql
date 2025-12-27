-- Fix Phase 1: Rename USDT-TRC20 to USDT-BEP20 (Binance Smart Chain)
-- This corrects the network from Tron to BSC

-- Rename the column (only if source column exists and target doesn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'usdt_trc20_address'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'usdt_bep20_address'
  ) THEN
    ALTER TABLE profiles 
    RENAME COLUMN usdt_trc20_address TO usdt_bep20_address;
  END IF;
END $$;

-- Drop old index and create new one
DROP INDEX IF EXISTS idx_profiles_crypto_addresses;
CREATE INDEX idx_profiles_crypto_addresses ON profiles(id) 
WHERE usdc_solana_address IS NOT NULL OR usdt_bep20_address IS NOT NULL;

-- Update comment to reflect BSC network
COMMENT ON COLUMN profiles.usdt_bep20_address IS 'User USDT withdrawal address on Binance Smart Chain (BEP-20) network';