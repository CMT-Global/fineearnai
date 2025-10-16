-- Phase 1.3: Create User Detail Aggregation Function
-- This function returns complete user overview data in a single JSON object
-- Optimized for <50ms execution time

CREATE OR REPLACE FUNCTION public.get_user_detail_aggregated(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    -- Core profile data
    'profile', json_build_object(
      'id', p.id,
      'username', p.username,
      'email', p.email,
      'full_name', p.full_name,
      'phone', p.phone,
      'country', p.country,
      'membership_plan', p.membership_plan,
      'account_status', p.account_status,
      'referral_code', p.referral_code,
      'plan_expires_at', p.plan_expires_at,
      'current_plan_start_date', p.current_plan_start_date,
      'auto_renew', p.auto_renew,
      'created_at', p.created_at,
      'last_login', p.last_login,
      'last_activity', p.last_activity
    ),
    
    -- Task & earning statistics
    'stats', json_build_object(
      'total_tasks', COALESCE((
        SELECT COUNT(*) 
        FROM task_completions 
        WHERE user_id = p_user_id
      ), 0),
      'correct_tasks', COALESCE((
        SELECT COUNT(*) 
        FROM task_completions 
        WHERE user_id = p_user_id AND is_correct = true
      ), 0),
      'wrong_tasks', COALESCE((
        SELECT COUNT(*) 
        FROM task_completions 
        WHERE user_id = p_user_id AND is_correct = false
      ), 0),
      'accuracy', COALESCE((
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE is_correct = true) * 100.0) / NULLIF(COUNT(*), 0), 2
        ) 
        FROM task_completions 
        WHERE user_id = p_user_id
      ), 0),
      'total_earned', p.total_earned,
      'tasks_completed_today', p.tasks_completed_today,
      'skips_today', p.skips_today,
      'last_task_date', p.last_task_date,
      'total_referrals', COALESCE((
        SELECT COUNT(*) 
        FROM referrals 
        WHERE referrer_id = p_user_id
      ), 0),
      'active_referrals', COALESCE((
        SELECT COUNT(*) 
        FROM referrals 
        WHERE referrer_id = p_user_id AND status = 'active'
      ), 0),
      'total_referral_earnings', COALESCE((
        SELECT SUM(total_commission_earned) 
        FROM referrals 
        WHERE referrer_id = p_user_id
      ), 0)
    ),
    
    -- Financial overview
    'financial', json_build_object(
      'deposit_wallet_balance', p.deposit_wallet_balance,
      'earnings_wallet_balance', p.earnings_wallet_balance,
      'total_balance', (p.deposit_wallet_balance + p.earnings_wallet_balance),
      'total_deposits', COALESCE((
        SELECT SUM(amount) 
        FROM transactions 
        WHERE user_id = p_user_id 
          AND type = 'deposit' 
          AND status = 'completed'
      ), 0),
      'total_withdrawals', COALESCE((
        SELECT SUM(amount) 
        FROM transactions 
        WHERE user_id = p_user_id 
          AND type = 'withdrawal' 
          AND status = 'completed'
      ), 0),
      'pending_withdrawals', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'pending'
      ), 0),
      'pending_withdrawal_amount', COALESCE((
        SELECT SUM(amount) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'pending'
      ), 0),
      'total_withdrawal_requests', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id
      ), 0),
      'completed_withdrawals', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'completed'
      ), 0),
      'rejected_withdrawals', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'rejected'
      ), 0),
      'total_transactions', COALESCE((
        SELECT COUNT(*) 
        FROM transactions 
        WHERE user_id = p_user_id
      ), 0),
      'lifetime_net_earnings', (
        p.total_earned + COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE user_id = p_user_id 
            AND type = 'deposit' 
            AND status = 'completed'
        ), 0) - COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE user_id = p_user_id 
            AND type = 'withdrawal' 
            AND status = 'completed'
        ), 0)
      )
    ),
    
    -- Upline/referrer information
    'upline', CASE 
      WHEN p.referred_by IS NOT NULL THEN
        (SELECT json_build_object(
          'id', up.id,
          'username', up.username,
          'email', up.email,
          'membership_plan', up.membership_plan,
          'account_status', up.account_status,
          'referral_code', up.referral_code
        )
        FROM profiles up
        WHERE up.id = p.referred_by)
      ELSE NULL
    END,
    
    -- Referral relationship details (if user was referred)
    'referral_details', CASE
      WHEN p.referred_by IS NOT NULL THEN
        (SELECT json_build_object(
          'referral_id', r.id,
          'status', r.status,
          'total_commission_earned', r.total_commission_earned,
          'created_at', r.created_at,
          'last_commission_date', r.last_commission_date,
          'referral_code_used', r.referral_code_used
        )
        FROM referrals r
        WHERE r.referred_id = p_user_id AND r.referrer_id = p.referred_by
        LIMIT 1)
      ELSE NULL
    END,
    
    -- Recent activity summary
    'recent_activity', json_build_object(
      'last_task_completion', (
        SELECT json_build_object(
          'completed_at', tc.completed_at,
          'is_correct', tc.is_correct,
          'earnings_amount', tc.earnings_amount
        )
        FROM task_completions tc
        WHERE tc.user_id = p_user_id
        ORDER BY tc.completed_at DESC
        LIMIT 1
      ),
      'last_transaction', (
        SELECT json_build_object(
          'id', t.id,
          'type', t.type,
          'amount', t.amount,
          'status', t.status,
          'created_at', t.created_at,
          'description', t.description
        )
        FROM transactions t
        WHERE t.user_id = p_user_id
        ORDER BY t.created_at DESC
        LIMIT 1
      ),
      'last_withdrawal_request', (
        SELECT json_build_object(
          'id', wr.id,
          'amount', wr.amount,
          'status', wr.status,
          'payment_method', wr.payment_method,
          'created_at', wr.created_at,
          'processed_at', wr.processed_at
        )
        FROM withdrawal_requests wr
        WHERE wr.user_id = p_user_id
        ORDER BY wr.created_at DESC
        LIMIT 1
      )
    ),
    
    -- Membership plan details
    'plan_info', (
      SELECT json_build_object(
        'name', mp.name,
        'display_name', mp.display_name,
        'account_type', mp.account_type,
        'price', mp.price,
        'daily_task_limit', mp.daily_task_limit,
        'earning_per_task', mp.earning_per_task,
        'min_withdrawal', mp.min_withdrawal,
        'max_daily_withdrawal', mp.max_daily_withdrawal,
        'task_commission_rate', mp.task_commission_rate,
        'deposit_commission_rate', mp.deposit_commission_rate,
        'max_active_referrals', mp.max_active_referrals,
        'features', mp.features
      )
      FROM membership_plans mp
      WHERE mp.name = p.membership_plan
      LIMIT 1
    ),
    
    -- Admin role check
    'is_admin', (
      SELECT EXISTS(
        SELECT 1 
        FROM user_roles 
        WHERE user_id = p_user_id AND role = 'admin'
      )
    )
  )
  INTO result
  FROM profiles p
  WHERE p.id = p_user_id;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_detail_aggregated TO authenticated;

-- Add documentation comment
COMMENT ON FUNCTION public.get_user_detail_aggregated IS 
'Returns complete user detail data in a single JSON object including profile, stats, financial, upline, and recent activity.
Optimized for admin user management. Performance target: <50ms.
Used by admin panel to display comprehensive user details.';

-- Create additional function for batch user detail retrieval
CREATE OR REPLACE FUNCTION public.get_multiple_users_detail(p_user_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    public.get_user_detail_aggregated(id)
  )
  INTO result
  FROM unnest(p_user_ids) AS id;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_multiple_users_detail TO authenticated;

COMMENT ON FUNCTION public.get_multiple_users_detail IS 
'Batch retrieval of user details for multiple users.
Used for bulk operations in admin panel.
Returns array of user detail JSON objects.';