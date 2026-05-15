-- Migration: Add USDT TRC-20 withdrawal address column to profiles
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS usdt_trc20_address TEXT;

-- Confirm
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('usdt_bep20_address', 'usdt_trc20_address');
