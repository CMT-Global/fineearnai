-- PHASE 3: Remove deprecated credit_deposit_atomic_v2 function
-- This function is no longer used anywhere in the codebase

DROP FUNCTION IF EXISTS public.credit_deposit_atomic_v2(uuid, numeric, text, text, text, jsonb);