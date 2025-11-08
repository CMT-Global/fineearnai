-- Phase 3: Drop old unused credit_deposit_atomic v1 function
-- This function is no longer used anywhere in the codebase
-- All deposit flows now use credit_deposit_atomic_v2 with tracking_id for idempotency

-- Drop the old v1 function
DROP FUNCTION IF EXISTS public.credit_deposit_atomic(uuid, numeric, text, text, text, jsonb) CASCADE;

-- Add comment to remaining v2 function for clarity
COMMENT ON FUNCTION public.credit_deposit_atomic_v2(uuid, numeric, text, text, text, jsonb) IS 
'Atomic deposit crediting with commission processing and idempotency via tracking_id. 
Used by both CPAY webhooks and direct deposit edge function.
Parameters: p_user_id, p_amount, p_tracking_id (for idempotency), p_payment_id, p_payment_method, p_metadata.
Processes deposit commissions atomically based on upline plan (free uplines cannot earn commissions).';