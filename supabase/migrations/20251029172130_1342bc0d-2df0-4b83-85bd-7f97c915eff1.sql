-- Phase 1.2: Drop Diagnostic Function
-- Problem: test_commission_logic function references non-existent "executed_at" column
-- Solution: Drop the diagnostic function completely

DROP FUNCTION IF EXISTS public.test_commission_logic(uuid);