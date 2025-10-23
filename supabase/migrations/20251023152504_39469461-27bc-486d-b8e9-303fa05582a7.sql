-- Phase 5: Delete Obsolete Config - Remove withdrawal_fee_percentage

-- Delete obsolete withdrawal_fee_percentage (now using processor-specific fees)
DELETE FROM public.platform_config WHERE key = 'withdrawal_fee_percentage';

-- Add comment for documentation
COMMENT ON TABLE public.platform_config IS 'Platform-wide configuration. Note: withdrawal_fee_percentage removed - fees now managed per processor in payment_processors table';