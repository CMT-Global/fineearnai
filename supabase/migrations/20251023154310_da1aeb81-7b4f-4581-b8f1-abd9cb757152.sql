-- Phase 5: Backfill Existing Records - Link withdrawal requests to payment processors

-- Update existing withdrawals to link to correct processor
-- Match by payment_method name to processor name
UPDATE withdrawal_requests wr
SET payment_processor_id = pp.id
FROM payment_processors pp
WHERE wr.payment_processor_id IS NULL
  AND wr.payment_method = pp.name
  AND pp.processor_type IN ('withdrawal', 'both')
  AND pp.is_active = true;

-- Log backfill results for verification
DO $$
DECLARE
  v_total_requests INTEGER;
  v_with_processor_id INTEGER;
  v_still_null INTEGER;
  v_updated_count INTEGER;
BEGIN
  -- Get counts before showing results
  SELECT COUNT(*) INTO v_total_requests FROM withdrawal_requests;
  SELECT COUNT(*) INTO v_with_processor_id FROM withdrawal_requests WHERE payment_processor_id IS NOT NULL;
  v_still_null := v_total_requests - v_with_processor_id;
  v_updated_count := v_with_processor_id;
  
  -- Log results
  RAISE NOTICE 'Backfill completed:';
  RAISE NOTICE '  - Total withdrawal requests: %', v_total_requests;
  RAISE NOTICE '  - With processor_id (after backfill): %', v_with_processor_id;
  RAISE NOTICE '  - Still NULL (no matching processor): %', v_still_null;
  
  -- If there are still NULLs, show which payment methods couldn't be matched
  IF v_still_null > 0 THEN
    RAISE NOTICE 'Withdrawal requests with NULL payment_processor_id:';
    FOR v_total_requests IN 
      SELECT DISTINCT payment_method 
      FROM withdrawal_requests 
      WHERE payment_processor_id IS NULL
    LOOP
      RAISE NOTICE '  - Payment method with no match: %', v_total_requests;
    END LOOP;
  END IF;
END $$;