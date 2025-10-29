-- ============================================================================
-- PHASE 2: MANUALLY PROCESS PENDING COMMISSIONS BEFORE QUEUE REMOVAL
-- This ensures no user loses pending commissions during migration
-- ============================================================================

DO $$
DECLARE
  v_commission_record RECORD;
  v_commission_amount NUMERIC(10, 4);
  v_referrer_balance NUMERIC(10, 4);
  v_new_balance NUMERIC(10, 4);
  v_processed_count INTEGER := 0;
  v_total_amount NUMERIC(10, 4) := 0;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 2: Processing % pending/failed commissions', 
    (SELECT COUNT(*) FROM commission_queue WHERE status IN ('pending', 'failed'));
  RAISE NOTICE '============================================================================';

  -- Loop through all pending/failed commissions
  FOR v_commission_record IN 
    SELECT * FROM commission_queue 
    WHERE status IN ('pending', 'failed')
    ORDER BY created_at ASC
  LOOP
    BEGIN
      -- Calculate commission amount
      v_commission_amount := v_commission_record.amount * v_commission_record.commission_rate;
      
      RAISE NOTICE 'Processing commission %: Event=%, Amount=$%, Rate=%, Commission=$%',
        v_commission_record.id,
        v_commission_record.event_type,
        v_commission_record.amount,
        v_commission_record.commission_rate,
        v_commission_amount;
      
      -- Lock referrer profile and get current balance
      SELECT earnings_wallet_balance INTO v_referrer_balance
      FROM profiles
      WHERE id = v_commission_record.referrer_id
      FOR UPDATE;
      
      -- Calculate new balance
      v_new_balance := v_referrer_balance + v_commission_amount;
      
      -- Update referrer balance
      UPDATE profiles
      SET
        earnings_wallet_balance = v_new_balance,
        total_earned = total_earned + v_commission_amount,
        last_activity = NOW()
      WHERE id = v_commission_record.referrer_id;
      
      RAISE NOTICE '  → Updated referrer balance: $% → $%', v_referrer_balance, v_new_balance;
      
      -- Insert transaction record
      INSERT INTO transactions (
        user_id,
        type,
        amount,
        wallet_type,
        status,
        new_balance,
        description,
        metadata
      ) VALUES (
        v_commission_record.referrer_id,
        'referral_commission',
        v_commission_amount,
        'earnings',
        'completed',
        v_new_balance,
        'Commission from referral ' || v_commission_record.event_type || ' (manual migration)',
        jsonb_build_object(
          'referred_user_id', v_commission_record.referred_user_id,
          'base_amount', v_commission_record.amount,
          'commission_rate', v_commission_record.commission_rate,
          'event_type', v_commission_record.event_type,
          'migration_source', 'phase_2_manual_processing',
          'original_queue_id', v_commission_record.id
        )
      );
      
      -- Insert referral_earnings record
      INSERT INTO referral_earnings (
        referrer_id,
        referred_user_id,
        earning_type,
        base_amount,
        commission_amount,
        commission_rate,
        metadata
      ) VALUES (
        v_commission_record.referrer_id,
        v_commission_record.referred_user_id,
        CASE 
          WHEN v_commission_record.event_type = 'task' THEN 'task_commission'
          ELSE 'deposit_commission'
        END,
        v_commission_record.amount,
        v_commission_amount,
        v_commission_record.commission_rate * 100, -- Convert to percentage
        jsonb_build_object(
          'migration_source', 'phase_2_manual_processing',
          'original_queue_id', v_commission_record.id,
          'original_metadata', v_commission_record.metadata
        )
      );
      
      -- Update referrals summary table
      UPDATE referrals
      SET
        total_commission_earned = total_commission_earned + v_commission_amount,
        last_commission_date = NOW()
      WHERE referrer_id = v_commission_record.referrer_id 
      AND referred_id = v_commission_record.referred_user_id;
      
      -- Mark commission as completed in queue
      UPDATE commission_queue
      SET
        status = 'completed',
        processed_at = NOW(),
        error_message = NULL
      WHERE id = v_commission_record.id;
      
      -- Track totals
      v_processed_count := v_processed_count + 1;
      v_total_amount := v_total_amount + v_commission_amount;
      
      RAISE NOTICE '  ✅ Commission % processed successfully', v_commission_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other commissions
      RAISE WARNING '  ❌ Error processing commission %: %', v_commission_record.id, SQLERRM;
      
      -- Mark as failed with error
      UPDATE commission_queue
      SET
        status = 'failed',
        error_message = 'Phase 2 manual processing error: ' || SQLERRM,
        retry_count = retry_count + 1
      WHERE id = v_commission_record.id;
    END;
  END LOOP;
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 2 COMPLETE: Processed % commissions totaling $%', 
    v_processed_count, v_total_amount;
  RAISE NOTICE '============================================================================';
  
  -- Final verification: Check if any commissions are still pending/failed
  IF EXISTS (SELECT 1 FROM commission_queue WHERE status IN ('pending', 'failed')) THEN
    RAISE WARNING 'WARNING: Some commissions are still pending/failed after processing';
  ELSE
    RAISE NOTICE '✅ All commissions successfully processed';
  END IF;
  
END $$;

-- Verification queries
DO $$
DECLARE
  v_admin_balance NUMERIC;
  v_expected_balance NUMERIC := 23.7925;
BEGIN
  -- Get admin's current balance
  SELECT earnings_wallet_balance INTO v_admin_balance
  FROM profiles
  WHERE username = 'admin';
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'BALANCE VERIFICATION';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Admin earnings balance: $%', v_admin_balance;
  RAISE NOTICE 'Expected balance: $%', v_expected_balance;
  
  IF ABS(v_admin_balance - v_expected_balance) < 0.0001 THEN
    RAISE NOTICE '✅ Balance matches expected value (within tolerance)';
  ELSE
    RAISE WARNING '⚠️  Balance mismatch: Expected $%, Got $%, Difference: $%',
      v_expected_balance, v_admin_balance, ABS(v_admin_balance - v_expected_balance);
  END IF;
  
  RAISE NOTICE '============================================================================';
END $$;

-- Display commission queue status
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount * commission_rate) as total_commission_amount
FROM commission_queue
GROUP BY status
ORDER BY status;