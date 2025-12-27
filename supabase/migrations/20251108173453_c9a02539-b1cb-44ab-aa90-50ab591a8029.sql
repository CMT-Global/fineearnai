-- Phase 2: Drop conflicting credit_deposit_atomic_v2 overload
-- This removes the broken 4-parameter version that causes function signature mismatch
-- We keep the working 6-parameter version used by CPAY webhook and now by deposit/index.ts

DO $$
BEGIN
  -- Drop the broken overload with 4 parameters (p_user_id, p_amount, p_payment_method, p_gateway_transaction_id)
  DROP FUNCTION IF EXISTS public.credit_deposit_atomic_v2(uuid, numeric, text, text) CASCADE;

  -- Verify only one version remains
  -- Expected result: Should show only the 6-parameter version with (p_user_id, p_amount, p_tracking_id, p_payment_id, p_payment_method, p_metadata)
  EXECUTE 'COMMENT ON FUNCTION public.credit_deposit_atomic_v2(uuid, numeric, text, text, text, jsonb) IS 
''Atomic deposit crediting with commission processing. Uses tracking_id for idempotency and supports both CPAY webhooks and manual deposits.''';
END $$;